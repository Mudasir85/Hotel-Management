const express = require('express');
const path = require('path');

const { initDatabase, closeDatabase } = require('./src/database');
const { requireAuth } = require('./src/middleware/jwt-auth.guard');
const authRoutes = require('./src/modules/auth/auth.routes');
const bookingsRoutes = require('./src/modules/bookings/bookings.routes');
const viewRoutes = require('./src/modules/views/views.routes');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const PROJECT_INFO = {
  project: 'Hotel Booking & Reservation System',
  architecture: {
    backend: ['Node.js', 'Express 4.x'],
    auth: ['JWT', 'Route Guard Middleware'],
    database: ['SQLite 3 (bookings.db)'],
    frontend: ['Multi-page HTML/CSS/JS', 'Shared layout components']
  }
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

app.use('/api/auth', authRoutes);
app.use(['/api/bookings', '/sitesh/api/bookings'], requireAuth, bookingsRoutes);
app.use('/', viewRoutes);

app.get(['/api/project-info', '/sitesh/api/project-info'], (_req, res) => {
  res.json(PROJECT_INFO);
});

app.use((err, req, res, _next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  console.error('Unhandled server error:', err.message);
  if (req.originalUrl.startsWith('/api/') || req.originalUrl.includes('/sitesh/api/')) {
    return res.status(500).json({ error: 'Internal server error' });
  }

  return res.status(500).send('Internal server error');
});

app.use((_req, res) => {
  return res.redirect('/');
});

async function bootstrap() {
  try {
    await initDatabase();
    app.listen(PORT, HOST, () => {
      console.log(`Hotel Booking System running at http://${HOST}:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

bootstrap();

process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});
