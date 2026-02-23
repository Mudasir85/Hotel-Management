const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'hotel-booking-secret-key-change-in-production';
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const AVATAR_UPLOAD_DIR = path.join(__dirname, 'public', 'uploads', 'avatars');
const AVATAR_URL_PREFIX = '/sitesh/uploads/avatars/';

if (!fs.existsSync(AVATAR_UPLOAD_DIR)) {
  fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
}

// Middleware
app.use(express.json({ limit: '5mb' }));
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
      avatar_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add profile columns if they don't exist
  db.run(`ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''`, (err) => {});
  db.run(`ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''`, (err) => {});
  db.run(`ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''`, (err) => {});

  db.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      shift TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      duty_status INTEGER NOT NULL DEFAULT 1,
      avatar_icon TEXT NOT NULL DEFAULT 'user'
    )
  `);
  db.run(`ALTER TABLE staff ADD COLUMN name TEXT NOT NULL DEFAULT ''`, (err) => {});
  db.run(`ALTER TABLE staff ADD COLUMN role TEXT NOT NULL DEFAULT ''`, (err) => {});
  db.run(`ALTER TABLE staff ADD COLUMN shift TEXT NOT NULL DEFAULT ''`, (err) => {});
  db.run(`ALTER TABLE staff ADD COLUMN phone TEXT NOT NULL DEFAULT ''`, (err) => {});
  db.run(`ALTER TABLE staff ADD COLUMN email TEXT NOT NULL DEFAULT ''`, (err) => {});
  db.run(`ALTER TABLE staff ADD COLUMN duty_status INTEGER NOT NULL DEFAULT 1`, (err) => {});
  db.run(`ALTER TABLE staff ADD COLUMN avatar_icon TEXT NOT NULL DEFAULT 'user'`, (err) => {});

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
const STAFF_ROLES = new Set(['Manager', 'Chef', 'Waiter', 'Cashier', 'Helper', 'Receptionist']);
const STAFF_SHIFTS = new Set(['Morning', 'Evening', 'Full Day']);
const STAFF_ROLE_ICONS = {
  Manager: '\u{1F464}',
  Chef: '\u{1F373}',
  Waiter: '\u{1F9D1}\u200D\u{1F37C}',
  Cashier: '\u{1F4B5}',
  Helper: '\u{1F6E0}',
  Receptionist: '\u{1F481}'
};

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

function isValidDataImageUrl(value) {
  return typeof value === 'string' && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}

function isValidAvatarUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (isValidDataImageUrl(value)) return true;
  if (value.startsWith(AVATAR_URL_PREFIX)) return true;
  return /^https?:\/\/[^\s]+$/i.test(value);
}

function getAvatarFileExtension(mimeType) {
  const extensionMap = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  return extensionMap[mimeType] || null;
}

function getAvatarDiskPathFromUrl(avatarUrl) {
  if (typeof avatarUrl !== 'string') return '';
  if (!avatarUrl.startsWith(AVATAR_URL_PREFIX)) return '';
  const filename = avatarUrl.slice(AVATAR_URL_PREFIX.length);
  if (!filename || filename.includes('/') || filename.includes('\\')) return '';
  return path.join(AVATAR_UPLOAD_DIR, filename);
}

function isAdminUser(req) {
  return req.user && req.user.username === 'admin';
}

function parseStaffPayload(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const role = typeof body.role === 'string' ? body.role.trim() : '';
  const shift = typeof body.shift === 'string' ? body.shift.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  return { name, role, shift, phone, email };
}

function validateStaffPayload(payload) {
  if (!payload.name || !payload.role || !payload.shift || !payload.phone || !payload.email) {
    return 'All fields are required';
  }

  if (!STAFF_ROLES.has(payload.role)) {
    return 'Invalid role selected';
  }

  if (!STAFF_SHIFTS.has(payload.shift)) {
    return 'Invalid shift selected';
  }

  if (!/^\d{10}$/.test(payload.phone)) {
    return 'Phone must be exactly 10 digits';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return 'Invalid email format';
  }

  return '';
}

function parseMultipartFormData(buffer, boundary) {
  const result = {};
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(boundaryBuffer);

  while (start !== -1) {
    const next = buffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);
    if (next === -1) break;
    const part = buffer.slice(start + boundaryBuffer.length + 2, next - 2);
    if (part.length > 0) parts.push(part);
    start = next;
  }

  for (const part of parts) {
    const splitIndex = part.indexOf(Buffer.from('\r\n\r\n'));
    if (splitIndex === -1) continue;

    const headersRaw = part.slice(0, splitIndex).toString('utf8');
    const content = part.slice(splitIndex + 4);
    const dispositionMatch = headersRaw.match(/name="([^"]+)"/i);
    if (!dispositionMatch) continue;

    const fieldName = dispositionMatch[1];
    const filenameMatch = headersRaw.match(/filename="([^"]*)"/i);
    const contentTypeMatch = headersRaw.match(/content-type:\s*([^\r\n]+)/i);

    if (filenameMatch) {
      result[fieldName] = {
        filename: filenameMatch[1],
        mimeType: contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : 'application/octet-stream',
        buffer: content
      };
      continue;
    }

    result[fieldName] = content.toString('utf8');
  }

  return result;
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
      user: { id: user.id, username: user.username, full_name: user.full_name, email: user.email || '', phone: user.phone || '', avatar_url: user.avatar_url || '' }
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
        user: { id: this.lastID, username, full_name, email: '', phone: '', avatar_url: '' }
      });
    }
  );
});

// GET /api/auth/me - Verify token & get user info
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, full_name, email, phone, avatar_url FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.json({ user: req.user });
    }
    res.json({ user: { id: user.id, username: user.username, full_name: user.full_name, email: user.email || '', phone: user.phone || '', avatar_url: user.avatar_url || '' } });
  });
});

// ─── Profile Routes ─────────────────────────────────────────────

// GET /api/profile - Get user profile
app.get('/api/profile', authenticateToken, (req, res) => {
  db.get('SELECT id, username, full_name, email, phone, avatar_url, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ id: user.id, username: user.username, full_name: user.full_name, email: user.email || '', phone: user.phone || '', avatar_url: user.avatar_url || '', created_at: user.created_at });
  });
});

// POST /api/profile - Update user profile
app.post('/api/profile', authenticateToken, express.raw({ type: 'multipart/form-data', limit: '5mb' }), (req, res) => {
  let body = req.body || {};
  let avatarUrl = '';
  let avatarFile = null;

  const contentType = req.headers['content-type'] || '';
  const isMultipart = contentType.includes('multipart/form-data');

  if (isMultipart && Buffer.isBuffer(req.body)) {
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : '';
    if (!boundary) {
      return res.status(400).json({ error: 'Invalid multipart request boundary' });
    }

    body = parseMultipartFormData(req.body, boundary);
    avatarFile = body.avatar;

    if (avatarFile && avatarFile.buffer && avatarFile.buffer.length > 0) {
      if (!ALLOWED_AVATAR_MIME.has(avatarFile.mimeType)) {
        return res.status(400).json({ error: 'Avatar must be PNG, JPG, JPEG, WEBP, or GIF' });
      }
      if (avatarFile.buffer.length > AVATAR_MAX_BYTES) {
        return res.status(400).json({ error: 'Avatar image is too large (max 2MB)' });
      }
    }
  }

  const full_name = typeof body.full_name === 'string' ? body.full_name : '';
  const email = typeof body.email === 'string' ? body.email : '';
  const phone = typeof body.phone === 'string' ? body.phone : '';
  const rawAvatarUrl = typeof body.avatar_url === 'string' ? body.avatar_url : '';

  if (rawAvatarUrl) {
    if (!isValidAvatarUrl(rawAvatarUrl)) {
      return res.status(400).json({ error: 'Invalid avatar image format' });
    }
    if (isValidDataImageUrl(rawAvatarUrl)) {
      const base64Part = rawAvatarUrl.split(',')[1] || '';
      const decodedBytes = Buffer.byteLength(base64Part, 'base64');
      if (decodedBytes > AVATAR_MAX_BYTES) {
        return res.status(400).json({ error: 'Avatar image is too large (max 2MB)' });
      }
    }
    avatarUrl = rawAvatarUrl;
  }

  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ error: 'Full name is required' });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (phone && !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  }

  db.get('SELECT avatar_url FROM users WHERE id = ?', [req.user.id], (existingErr, existingUser) => {
    if (existingErr) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    const existingAvatarUrl = existingUser && existingUser.avatar_url ? existingUser.avatar_url : '';

    const finishUpdate = (finalAvatarUrl) => {
      db.run(
        'UPDATE users SET full_name = ?, email = ?, phone = ?, avatar_url = ? WHERE id = ?',
        [full_name.trim(), email || '', phone || '', finalAvatarUrl || '', req.user.id],
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
            user: { id: req.user.id, username: req.user.username, full_name: full_name.trim(), email: email || '', phone: phone || '', avatar_url: finalAvatarUrl || '' }
          });
        }
      );
    };

    if (!avatarFile || !avatarFile.buffer || avatarFile.buffer.length === 0) {
      return finishUpdate(avatarUrl || existingAvatarUrl || '');
    }

    const extension = getAvatarFileExtension(avatarFile.mimeType);
    if (!extension) {
      return res.status(400).json({ error: 'Unsupported avatar format' });
    }

    const filename = `${req.user.id}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const diskPath = path.join(AVATAR_UPLOAD_DIR, filename);
    const nextAvatarUrl = `${AVATAR_URL_PREFIX}${filename}`;

    fs.writeFile(diskPath, avatarFile.buffer, (writeErr) => {
      if (writeErr) {
        return res.status(500).json({ error: 'Failed to save avatar image' });
      }

      const oldAvatarDiskPath = getAvatarDiskPathFromUrl(existingAvatarUrl);
      if (oldAvatarDiskPath && oldAvatarDiskPath !== diskPath) {
        fs.unlink(oldAvatarDiskPath, () => {});
      }

      return finishUpdate(nextAvatarUrl);
    });
  });
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

// ─── Admin Reports ──────────────────────────────────────────────

// GET /api/admin/reports/avatars - Count avatar storage types
app.get('/api/admin/reports/avatars', authenticateToken, (req, res) => {
  if (!isAdminUser(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  db.all('SELECT avatar_url FROM users', [], (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to generate avatar report' });
    }

    const report = {
      totalUsers: users.length,
      empty: 0,
      dataUrl: 0,
      localFileUrl: 0,
      httpUrl: 0,
      other: 0
    };

    for (const user of users) {
      const value = typeof user.avatar_url === 'string' ? user.avatar_url.trim() : '';
      if (!value) {
        report.empty += 1;
      } else if (isValidDataImageUrl(value)) {
        report.dataUrl += 1;
      } else if (value.startsWith(AVATAR_URL_PREFIX)) {
        report.localFileUrl += 1;
      } else if (/^https?:\/\/[^\s]+$/i.test(value)) {
        report.httpUrl += 1;
      } else {
        report.other += 1;
      }
    }

    res.json(report);
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

// ─── Staff Routes (Protected) ───────────────────────────────────

// GET /api/staff - List all staff records
app.get('/api/staff', authenticateToken, (req, res) => {
  db.all(`
    SELECT id, name, role, shift, phone, email, duty_status, avatar_icon
    FROM staff
    ORDER BY name COLLATE NOCASE ASC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch staff' });
    }
    const normalized = rows.map((row) => ({
      ...row,
      duty_status: !!row.duty_status
    }));
    res.json(normalized);
  });
});

// GET /api/staff/:id - Get a single staff record
app.get('/api/staff/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get(`
    SELECT id, name, role, shift, phone, email, duty_status, avatar_icon
    FROM staff
    WHERE id = ?
  `, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch staff member' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    res.json({
      ...row,
      duty_status: !!row.duty_status
    });
  });
});

// POST /api/staff - Create a staff record
app.post('/api/staff', authenticateToken, (req, res) => {
  const payload = parseStaffPayload(req.body || {});
  const validationError = validateStaffPayload(payload);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const avatarIcon = STAFF_ROLE_ICONS[payload.role] || '\u{1F464}';
  db.run(
    `INSERT INTO staff (name, role, shift, phone, email, duty_status, avatar_icon) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [payload.name, payload.role, payload.shift, payload.phone, payload.email, avatarIcon],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create staff member' });
      }

      res.status(201).json({
        id: this.lastID,
        ...payload,
        duty_status: true,
        avatar_icon: avatarIcon
      });
    }
  );
});

// PUT /api/staff/:id - Update a staff record
app.put('/api/staff/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const payload = parseStaffPayload(req.body || {});
  const validationError = validateStaffPayload(payload);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const avatarIcon = STAFF_ROLE_ICONS[payload.role] || '\u{1F464}';
  db.run(
    `UPDATE staff SET name = ?, role = ?, shift = ?, phone = ?, email = ?, avatar_icon = ? WHERE id = ?`,
    [payload.name, payload.role, payload.shift, payload.phone, payload.email, avatarIcon, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update staff member' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Staff member not found' });
      }

      db.get(
        `SELECT id, name, role, shift, phone, email, duty_status, avatar_icon FROM staff WHERE id = ?`,
        [id],
        (selectErr, row) => {
          if (selectErr || !row) {
            return res.status(500).json({ error: 'Failed to fetch updated staff member' });
          }
          res.json({
            ...row,
            duty_status: !!row.duty_status
          });
        }
      );
    }
  );
});

// POST /api/staff/:id/toggle-duty - Toggle duty status
app.post('/api/staff/:id/toggle-duty', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get(`SELECT duty_status FROM staff WHERE id = ?`, [id], (err, staffRow) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to update duty status' });
    }
    if (!staffRow) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const nextStatus = staffRow.duty_status ? 0 : 1;
    db.run(`UPDATE staff SET duty_status = ? WHERE id = ?`, [nextStatus, id], (updateErr) => {
      if (updateErr) {
        return res.status(500).json({ error: 'Failed to update duty status' });
      }
      res.json({ id: Number(id), duty_status: !!nextStatus });
    });
  });
});

// DELETE /api/staff/:id - Delete a staff record
app.delete('/api/staff/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM staff WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete staff member' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    res.json({ message: 'Staff member deleted' });
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

app.get('/staff', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'staff.html'));
});

app.get('/dashboard/staff', (req, res) => {
  res.redirect('/sitesh/staff');
});

app.get('/bookings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/rooms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rooms.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gallery.html'));
});

app.get('/blogs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'blogs.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/settings', (req, res) => {
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
  console.log('Hotel Booking System running at /sitesh');
});
