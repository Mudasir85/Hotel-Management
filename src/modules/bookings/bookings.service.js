const { db } = require('../../database');

const ALLOWED_ROOMS = new Set(['101', '102', '103']);

function parseBookingPayload(body) {
  const safeBody = body && typeof body === 'object' ? body : {};
  return {
    guest_name: String(safeBody.guest_name ?? '').trim(),
    guest_phone: String(safeBody.guest_phone ?? '').trim(),
    room_number: String(safeBody.room_number ?? '').trim(),
    check_in_date: String(safeBody.check_in_date ?? '').trim(),
    check_out_date: String(safeBody.check_out_date ?? '').trim()
  };
}

function validateBookingInput(booking) {
  const { guest_name, guest_phone, room_number, check_in_date, check_out_date } = booking;

  if (!guest_name || !guest_phone || !room_number || !check_in_date || !check_out_date) {
    return 'All fields are required';
  }

  if (!/^\d{10}$/.test(guest_phone)) {
    return 'Phone must be exactly 10 digits';
  }

  if (!ALLOWED_ROOMS.has(room_number)) {
    return 'Room must be one of: 101, 102, 103';
  }

  const checkIn = new Date(check_in_date);
  const checkOut = new Date(check_out_date);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    return 'Invalid date format';
  }

  if (check_out_date <= check_in_date) {
    return 'Check-out date must be after check-in date';
  }

  return null;
}

function getAllBookings() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM bookings ORDER BY check_in_date ASC', [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function checkRoomOverlap(roomNumber, checkInDate, checkOutDate) {
  const overlapQuery = `
    SELECT id FROM bookings
    WHERE room_number = ?
      AND check_in_date < ?
      AND check_out_date > ?
    LIMIT 1
  `;

  return new Promise((resolve, reject) => {
    db.get(overlapQuery, [roomNumber, checkOutDate, checkInDate], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });
  });
}

function createBooking(booking) {
  const insertQuery = `
    INSERT INTO bookings (guest_name, guest_phone, room_number, check_in_date, check_out_date)
    VALUES (?, ?, ?, ?, ?)
  `;

  return new Promise((resolve, reject) => {
    db.run(
      insertQuery,
      [booking.guest_name, booking.guest_phone, booking.room_number, booking.check_in_date, booking.check_out_date],
      function onInsert(err) {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          id: this.lastID,
          ...booking
        });
      }
    );
  });
}

function deleteBookingById(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM bookings WHERE id = ?', [id], function onDelete(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.changes);
    });
  });
}

module.exports = {
  parseBookingPayload,
  validateBookingInput,
  getAllBookings,
  checkRoomOverlap,
  createBooking,
  deleteBookingById
};
