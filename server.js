const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'hotel-booking-secret-key-change-in-production';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Database setup
const db = new sqlite3.Database('./bookings.db', (err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_name TEXT NOT NULL,
      guest_phone TEXT NOT NULL,
      room_number TEXT NOT NULL,
      check_in_date DATE NOT NULL,
      check_out_date DATE NOT NULL,
      members INTEGER NOT NULL DEFAULT 1
    )
  `);

  // Ensure bookings.members exists and is enforced as INTEGER NOT NULL DEFAULT 1.
  db.all(`PRAGMA table_info(bookings)`, (err, columns) => {
    if (err) {
      console.error('Failed to inspect bookings schema:', err.message);
      return;
    }

    const membersCol = columns.find((col) => col.name === 'members');

    if (!membersCol) {
      db.run(`ALTER TABLE bookings ADD COLUMN members INTEGER NOT NULL DEFAULT 1`, (alterErr) => {
        if (alterErr) {
          console.error('Failed to add members column:', alterErr.message);
          return;
        }
        db.run(`UPDATE bookings SET members = 1 WHERE members IS NULL`);
      });
      return;
    }

    db.run(`UPDATE bookings SET members = 1 WHERE members IS NULL`);

    const defaultVal = String(membersCol.dflt_value ?? '').replace(/[()'"]/g, '').trim();
    const needsRebuild = membersCol.notnull !== 1 || defaultVal !== '1';

    if (!needsRebuild) {
      return;
    }

    db.run(`BEGIN TRANSACTION`);
    db.run(`
      CREATE TABLE IF NOT EXISTS bookings_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guest_name TEXT NOT NULL,
        guest_phone TEXT NOT NULL,
        room_number TEXT NOT NULL,
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL,
        members INTEGER NOT NULL DEFAULT 1
      )
    `);
    db.run(`
      INSERT INTO bookings_new (id, guest_name, guest_phone, room_number, check_in_date, check_out_date, members)
      SELECT id, guest_name, guest_phone, room_number, check_in_date, check_out_date, COALESCE(members, 1)
      FROM bookings
    `);
    db.run(`DROP TABLE bookings`);
    db.run(`ALTER TABLE bookings_new RENAME TO bookings`);
    db.run(`COMMIT`);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add email and phone columns if they don't exist
  db.run(`ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''`, (err) => {});
  db.run(`ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''`, (err) => {});

  // Seed a default admin user (password: admin123)
  const defaultPassword = bcrypt.hashSync('admin123', 10);
  db.run(
    `INSERT OR IGNORE INTO users (username, password, full_name) VALUES (?, ?, ?)`,
    ['admin', defaultPassword, 'Administrator']
  );
});

// Room capacity map
const ROOM_CAPACITY = {
  '101': 2,  // Standard
  '102': 3,  // Deluxe
  '103': 4,  // Suite
  '201': 5,  // Family
  '202': 3,  // Executive
  '203': 4   // Penthouse
};

const TOTAL_ROOMS = 6;

// ─── Auth Middleware ───────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

// ─── Auth Routes ──────────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Login failed' });
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, full_name: user.full_name, email: user.email || '', phone: user.phone || '' }
    });
  });
});

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  const { username, password, full_name } = req.body;

  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (username, password, full_name) VALUES (?, ?, ?)',
    [username, hashedPassword, full_name],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(409).json({ error: 'Username already exists' });
        }
        return res.status(500).json({ error: 'Registration failed' });
      }

      const token = jwt.sign(
        { id: this.lastID, username, full_name },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        token,
        user: { id: this.lastID, username, full_name }
      });
    }
  );
});

// GET /api/auth/me - Verify token & get user info
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, full_name, email, phone FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.json({ user: req.user });
    }
    res.json({ user: { id: user.id, username: user.username, full_name: user.full_name, email: user.email || '', phone: user.phone || '' } });
  });
});

// ─── Profile Routes ─────────────────────────────────────────────

// GET /api/profile - Get user profile
app.get('/api/profile', authenticateToken, (req, res) => {
  db.get('SELECT id, username, full_name, email, phone, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ id: user.id, username: user.username, full_name: user.full_name, email: user.email || '', phone: user.phone || '', created_at: user.created_at });
  });
});

// POST /api/profile - Update user profile
app.post('/api/profile', authenticateToken, (req, res) => {
  const { full_name, email, phone } = req.body;

  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ error: 'Full name is required' });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (phone && !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  }

  db.run(
    'UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?',
    [full_name.trim(), email || '', phone || '', req.user.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update profile' });
      }

      // Re-issue token with updated name
      const token = jwt.sign(
        { id: req.user.id, username: req.user.username, full_name: full_name.trim() },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Profile updated successfully',
        token,
        user: { id: req.user.id, username: req.user.username, full_name: full_name.trim(), email: email || '', phone: phone || '' }
      });
    }
  );
});

// ─── Settings Routes ────────────────────────────────────────────

// POST /api/settings/password - Change password
app.post('/api/settings/password', authenticateToken, (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;

  if (!current_password || !new_password || !confirm_password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  if (new_password !== confirm_password) {
    return res.status(400).json({ error: 'New passwords do not match' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: 'Failed to verify user' });
    }

    if (!bcrypt.compareSync(current_password, user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = bcrypt.hashSync(new_password, 10);

    db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id], function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to change password' });
      }
      res.json({ message: 'Password changed successfully' });
    });
  });
});

// ─── Dashboard Stats ─────────────────────────────────────────────

// GET /api/dashboard/stats - Protected
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  db.all('SELECT * FROM bookings', [], (err, bookings) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }

    const totalBookings = bookings.length;
    const activeBookings = bookings.filter(b => b.check_out_date >= today).length;
    const occupiedRoomSet = new Set(
      bookings.filter(b => b.check_in_date <= today && b.check_out_date >= today)
        .map(b => b.room_number)
    );
    const roomsOccupied = occupiedRoomSet.size;
    const totalRooms = TOTAL_ROOMS;

    res.json({
      totalBookings,
      activeBookings,
      roomsOccupied,
      availableRooms: totalRooms - roomsOccupied,
      totalRooms
    });
  });
});

// ─── Room Capacity Route ────────────────────────────────────────

// GET /api/rooms/capacity - Get room capacities
app.get('/api/rooms/capacity', authenticateToken, (req, res) => {
  res.json(ROOM_CAPACITY);
});

// ─── Booking Routes (Protected) ──────────────────────────────────

// GET /api/bookings - List all bookings
app.get('/api/bookings', authenticateToken, (req, res) => {
  db.all(`
    SELECT id, guest_name, guest_phone, room_number, check_in_date, check_out_date, COALESCE(members, 1) AS members
    FROM bookings
    ORDER BY check_in_date ASC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch bookings' });
    }
    res.json(rows);
  });
});

// POST /api/bookings - Create a booking
app.post('/api/bookings', authenticateToken, (req, res) => {
  const { guest_name, guest_phone, room_number, check_in_date, check_out_date, members } = req.body;

  // Basic validation
  if (!guest_name || !guest_phone || !room_number || !check_in_date || !check_out_date) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!/^\d{10}$/.test(guest_phone)) {
    return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  }

  if (check_out_date <= check_in_date) {
    return res.status(400).json({ error: 'Check-out date must be after check-in date' });
  }

  const memberCount = parseInt(members) || 1;
  const maxCapacity = ROOM_CAPACITY[room_number] || 2;

  if (memberCount < 1 || memberCount > maxCapacity) {
    return res.status(400).json({ error: `Members must be between 1 and ${maxCapacity} for Room ${room_number}` });
  }

  // Double-booking check: find overlapping bookings for the same room
  const overlapQuery = `
    SELECT id FROM bookings
    WHERE room_number = ?
      AND check_in_date < ?
      AND check_out_date > ?
  `;

  db.get(overlapQuery, [room_number, check_out_date, check_in_date], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to check availability' });
    }

    if (row) {
      return res.status(409).json({ error: `Room ${room_number} is already booked for the selected dates` });
    }

    // Insert the booking
    const insertQuery = `
      INSERT INTO bookings (guest_name, guest_phone, room_number, check_in_date, check_out_date, members)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(insertQuery, [guest_name, guest_phone, room_number, check_in_date, check_out_date, memberCount], function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create booking' });
      }
      res.status(201).json({
        id: this.lastID,
        guest_name,
        guest_phone,
        room_number,
        check_in_date,
        check_out_date,
        members: memberCount
      });
    });
  });
});

// GET /api/bookings/:id - Get a single booking
app.get('/api/bookings/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get(`
    SELECT id, guest_name, guest_phone, room_number, check_in_date, check_out_date, COALESCE(members, 1) AS members
    FROM bookings
    WHERE id = ?
  `, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch booking' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(row);
  });
});

// PUT /api/bookings/:id - Update a booking
app.put('/api/bookings/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { guest_name, guest_phone, room_number, check_in_date, check_out_date, members } = req.body;

  if (!guest_name || !guest_phone || !room_number || !check_in_date || !check_out_date) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!/^\d{10}$/.test(guest_phone)) {
    return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  }

  if (check_out_date <= check_in_date) {
    return res.status(400).json({ error: 'Check-out date must be after check-in date' });
  }

  const memberCount = parseInt(members) || 1;
  const maxCapacity = ROOM_CAPACITY[room_number] || 2;

  if (memberCount < 1 || memberCount > maxCapacity) {
    return res.status(400).json({ error: `Members must be between 1 and ${maxCapacity} for Room ${room_number}` });
  }

  // Double-booking check (exclude current booking)
  const overlapQuery = `
    SELECT id FROM bookings
    WHERE room_number = ?
      AND check_in_date < ?
      AND check_out_date > ?
      AND id != ?
  `;

  db.get(overlapQuery, [room_number, check_out_date, check_in_date, id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to check availability' });
    }

    if (row) {
      return res.status(409).json({ error: `Room ${room_number} is already booked for the selected dates` });
    }

    const updateQuery = `
      UPDATE bookings
      SET guest_name = ?, guest_phone = ?, room_number = ?, check_in_date = ?, check_out_date = ?, members = ?
      WHERE id = ?
    `;

    db.run(updateQuery, [guest_name, guest_phone, room_number, check_in_date, check_out_date, memberCount, id], function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update booking' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      res.json({ id: Number(id), guest_name, guest_phone, room_number, check_in_date, check_out_date, members: memberCount });
    });
  });
});

// DELETE /api/bookings/:id - Delete a booking
app.delete('/api/bookings/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM bookings WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete booking' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json({ message: 'Booking deleted' });
  });
});

// ─── Page Routes ─────────────────────────────────────────────────

// Public routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Protected dashboard routes (auth checked client-side via app.js)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard/bookings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard/rooms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rooms.html'));
});

app.get('/dashboard/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/dashboard/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gallery.html'));
});

app.get('/dashboard/blogs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'blogs.html'));
});

app.get('/dashboard/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/dashboard/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/dashboard/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/bookings/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'booking-detail.html'));
});

// Root redirects to login
app.get('/', (req, res) => {
  res.redirect('/sitesh/login');
});

// Start server
app.listen(PORT, () => {
  console.log(`Hotel Booking System running at http://localhost:${PORT}`);
});
