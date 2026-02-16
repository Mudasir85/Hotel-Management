const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

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

// Create bookings table
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

// GET /api/bookings - List all bookings
app.get('/api/bookings', (req, res) => {
  db.all('SELECT * FROM bookings ORDER BY check_in_date ASC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch bookings' });
    }
    res.json(rows);
  });
});

// POST /api/bookings - Create a booking
app.post('/api/bookings', (req, res) => {
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
app.delete('/api/bookings/:id', (req, res) => {
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

// Start server
app.listen(PORT, () => {
  console.log(`Hotel Booking System running at http://localhost:${PORT}`);
});
