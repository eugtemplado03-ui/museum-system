require('dotenv').config();
const express = require('express');
const cors = require('cors');
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
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));
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

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Fallback 404 for unknown API routes
// Auto-seed initial catalog if database is empty on fresh deployment
try {
  const exhibits = require('./db/exhibits');
  if (exhibits.all().length === 0) {
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
