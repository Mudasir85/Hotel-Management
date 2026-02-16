const AUTH_COOKIE_NAME = 'hotel_booking_token';

module.exports = {
  AUTH_COOKIE_NAME,
  JWT_SECRET: process.env.JWT_SECRET || 'hotel-booking-dev-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '2h',
  DEMO_USER: {
    id: 1,
    username: process.env.AUTH_USERNAME || 'admin',
    password: process.env.AUTH_PASSWORD || 'admin123',
    role: 'admin'
  }
};
