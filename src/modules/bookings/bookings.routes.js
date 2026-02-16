const express = require('express');
const { listBookings, addBooking, removeBooking } = require('./bookings.controller');

const router = express.Router();

router.get('/', listBookings);
router.post('/', addBooking);
router.delete('/:id', removeBooking);

module.exports = router;
