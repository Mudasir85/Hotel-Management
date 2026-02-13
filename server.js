const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const DB_PATH = path.join(__dirname, 'bookings.db');
const ALLOWED_ROOMS = new Set(['101', '102', '103']);
const BOOKING_ROUTES = ['/api/bookings', '/sitesh/api/bookings'];

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

function ensureSchema() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY,
        guest_name TEXT NOT NULL,
        guest_phone TEXT NOT NULL,
        room_number TEXT NOT NULL,
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL
      )
    `);

    db.all('PRAGMA table_info(bookings)', [], (err, columns) => {
      if (err) {
        console.error('Failed to inspect bookings schema:', err.message);
        return;
      }

      const existing = new Set(columns.map((col) => col.name));
      const required = {
        guest_name: 'TEXT',
        guest_phone: 'TEXT',
        room_number: 'TEXT',
        check_in_date: 'DATE',
        check_out_date: 'DATE'
      };

      for (const [name, type] of Object.entries(required)) {
        if (!existing.has(name)) {
          db.run(`ALTER TABLE bookings ADD COLUMN ${name} ${type}`, (alterErr) => {
            if (alterErr) {
              console.error(`Failed to add missing column ${name}:`, alterErr.message);
            }
          });
        }
      }
    });
  });
}

ensureSchema();

function parseBookingPayload(req) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  return {
    guest_name: String(body.guest_name ?? '').trim(),
    guest_phone: String(body.guest_phone ?? '').trim(),
    room_number: String(body.room_number ?? '').trim(),
    check_in_date: String(body.check_in_date ?? '').trim(),
    check_out_date: String(body.check_out_date ?? '').trim()
  };
}

// GET /api/bookings - List all bookings
app.get(BOOKING_ROUTES, (req, res) => {
  db.all('SELECT * FROM bookings ORDER BY check_in_date ASC', [], (err, rows) => {
    if (err) {
      console.error('Failed to fetch bookings:', err.message);
      return res.status(500).json({ error: 'Failed to fetch bookings' });
    }
    return res.json(rows);
  });
});

// POST /api/bookings - Create a booking
app.post(BOOKING_ROUTES, (req, res) => {
  const { guest_name, guest_phone, room_number, check_in_date, check_out_date } = parseBookingPayload(req);

  // Basic validation
  if (!guest_name || !guest_phone || !room_number || !check_in_date || !check_out_date) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!/^\d{10}$/.test(guest_phone)) {
    return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
  }

  if (!ALLOWED_ROOMS.has(room_number)) {
    return res.status(400).json({ error: 'Room must be one of: 101, 102, 103' });
  }

  const checkIn = new Date(check_in_date);
  const checkOut = new Date(check_out_date);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  if (check_out_date <= check_in_date) {
    return res.status(400).json({ error: 'Check-out date must be after check-in date' });
  }

  // Double-booking prevention: check for overlapping reservations on the same room
  const overlapQuery = `
    SELECT id FROM bookings
    WHERE room_number = ?
      AND check_in_date < ?
      AND check_out_date > ?
    LIMIT 1
  `;

  db.get(overlapQuery, [room_number, check_out_date, check_in_date], (err, row) => {
    if (err) {
      console.error('Failed to check availability:', err.message);
      return res.status(500).json({ error: 'Failed to check availability' });
    }

    if (row) {
      return res.status(409).json({ error: `Room ${room_number} is already booked for the selected dates` });
    }

    const insertQuery = `
      INSERT INTO bookings (guest_name, guest_phone, room_number, check_in_date, check_out_date)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(insertQuery, [guest_name, guest_phone, room_number, check_in_date, check_out_date], function insertBooking(err2) {
      if (err2) {
        console.error('Failed to create booking:', err2.message);
        return res.status(500).json({ error: 'Failed to create booking' });
      }

      return res.status(201).json({
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
app.delete(['/api/bookings/:id', '/sitesh/api/bookings/:id'], (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid booking id' });
  }

  db.run('DELETE FROM bookings WHERE id = ?', [id], function deleteBooking(err) {
    if (err) {
      console.error('Failed to delete booking:', err.message);
      return res.status(500).json({ error: 'Failed to delete booking' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.json({ message: 'Booking deleted' });
  });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  console.error('Unhandled server error:', err.message);
  return res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`Hotel Booking System running at http://${HOST}:${PORT}`);
});

process.on('SIGINT', () => {
  db.close(() => {
    process.exit(0);
  });
});
