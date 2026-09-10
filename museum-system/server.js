require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes = require('./routes/auth');
const exhibitRoutes = require('./routes/exhibits');
const chatRoutes = require('./routes/chat');
const ttsRoutes = require('./routes/tts');
const favoritesRoutes = require('./routes/favorites');
const adminRoutes = require('./routes/admin');
const programsRoutes = require('./routes/programs');
const eventsRoutes = require('./routes/events');
const galleryRoutes = require('./routes/gallery');
const visitorsRoutes = require('./routes/visitors');
const artifactLogsRoutes = require('./routes/artifact-logs');
const museumInfoRoutes = require('./routes/museum-info');
const { UPLOAD_DIR } = require('./middleware/upload');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Security Headers with Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https:",
        "http:",
        "https://res.cloudinary.com",
        "https://museosangbata.org",
        "https://*.tile.openstreetmap.org"
      ],
      mediaSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://res.cloudinary.com",
        "https://*.cloudinary.com"
      ],
      frameSrc: [
        "'self'",
        "https://www.youtube.com",
        "https://www.youtube-nocookie.com",
        "https://player.vimeo.com"
      ],
      connectSrc: [
        "'self'",
        "https://openrouter.ai",
        "https://api.fish.audio",
        "https://*.tile.openstreetmap.org",
        "https://nominatim.openstreetmap.org"
      ]
    }
  }
}));

// Configurable CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
  : null;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (!allowedOrigins || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Cross-Origin Request Blocked by CORS policy'));
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.get(['/login', '/login.html'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get(['/checkin', '/checkin.html'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/exhibits', exhibitRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/programs', programsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/visitors', visitorsRoutes);
app.use('/api/artifact-logs', artifactLogsRoutes);
app.use('/api/museum-info', museumInfoRoutes);

const mongoose = require('mongoose');

app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ ok: true, database: dbStatus });
});

// Auto-seed initial catalog if database is empty on fresh deployment
async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri) {
      console.log('Connecting to MongoDB...');
      await mongoose.connect(mongoUri);
      console.log('Connected to MongoDB successfully.');
    } else {
      console.warn('MONGODB_URI is not set. Using in-memory MongoDB for local development.');
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());
        console.log('Connected to local in-memory MongoDB successfully.');
      } catch (e) {
        console.warn('Failed to start in-memory MongoDB. Please install mongodb-memory-server or set MONGODB_URI.');
      }
    }
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
  }

  try {
    const exhibits = require('./db/exhibits');
    const exhibitCount = await exhibits.countDocuments ? await exhibits.countDocuments() : (await exhibits.all()).length;
    if (exhibitCount === 0) {
      console.log('Database is empty — auto-seeding exhibits, programs, events, and gallery...');
      require('./scripts/seed');
    }
  } catch (e) {
    console.warn('Auto-seed skipped:', e.message);
  }

  app.listen(PORT, () => {
    console.log(`Museo Sang Bata sa Negros server running on http://localhost:${PORT}`);
    if (!process.env.OPENROUTER_API_KEY) {
      console.log('NOTE: OPENROUTER_API_KEY is not set — the museum chat assistant will be disabled until you add it to .env.');
    }
  });
}

startServer();
