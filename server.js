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
app.use(express.static(path.join(__dirname, 'public')));

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
      check_out_date DATE NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed a default admin user (password: admin123)
  const defaultPassword = bcrypt.hashSync('admin123', 10);
  db.run(
    `INSERT OR IGNORE INTO users (username, password, full_name) VALUES (?, ?, ?)`,
    ['admin', defaultPassword, 'Administrator']
  );
});

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
      user: { id: user.id, username: user.username, full_name: user.full_name }
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
  res.json({ user: req.user });
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
    const roomsOccupied = new Set(
      bookings.filter(b => b.check_in_date <= today && b.check_out_date >= today)
        .map(b => b.room_number)
    ).size;
    const totalRooms = 3;

    res.json({
      totalBookings,
      activeBookings,
      roomsOccupied,
      availableRooms: totalRooms - roomsOccupied,
      totalRooms
    });
  });
});

// ─── Booking Routes (Protected) ──────────────────────────────────

// GET /api/bookings - List all bookings
app.get('/api/bookings', authenticateToken, (req, res) => {
  db.all('SELECT * FROM bookings ORDER BY check_in_date ASC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch bookings' });
    }
    res.json(rows);
  });
});

// POST /api/bookings - Create a booking
app.post('/api/bookings', authenticateToken, (req, res) => {
  const { guest_name, guest_phone, room_number, check_in_date, check_out_date } = req.body;

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
      INSERT INTO bookings (guest_name, guest_phone, room_number, check_in_date, check_out_date)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(insertQuery, [guest_name, guest_phone, room_number, check_in_date, check_out_date], function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create booking' });
      }
      res.status(201).json({
        id: this.lastID,
        guest_name,
        guest_phone,
        room_number,
        check_in_date,
        check_out_date
      });
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

// ─── SPA Fallback ─────────────────────────────────────────────────
// Serve login.html for unauthenticated root access
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Hotel Booking System running at http://localhost:${PORT}`);
});
