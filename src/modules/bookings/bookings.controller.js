const {
  parseBookingPayload,
  validateBookingInput,
  getAllBookings,
  checkRoomOverlap,
  createBooking,
  deleteBookingById
} = require('./bookings.service');

async function listBookings(_req, res) {
  try {
    const rows = await getAllBookings();
    return res.json(rows);
  } catch (err) {
    console.error('Failed to fetch bookings:', err.message);
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
}

async function addBooking(req, res) {
  const payload = parseBookingPayload(req.body);
  const validationError = validateBookingInput(payload);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const overlappingBooking = await checkRoomOverlap(payload.room_number, payload.check_in_date, payload.check_out_date);
    if (overlappingBooking) {
      return res.status(409).json({
        error: `Room ${payload.room_number} is already booked for the selected dates`
      });
    }

    const booking = await createBooking(payload);
    return res.status(201).json(booking);
  } catch (err) {
    console.error('Failed to create booking:', err.message);
    return res.status(500).json({ error: 'Failed to create booking' });
  }
}

async function removeBooking(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid booking id' });
  }

  try {
    const changes = await deleteBookingById(id);
    if (changes === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.json({ message: 'Booking deleted' });
  } catch (err) {
    console.error('Failed to delete booking:', err.message);
    return res.status(500).json({ error: 'Failed to delete booking' });
  }
}

module.exports = {
  listBookings,
  addBooking,
  removeBooking
};
