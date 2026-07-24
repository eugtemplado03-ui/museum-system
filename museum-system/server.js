require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const exhibitRoutes = require('./routes/exhibits');
const chatRoutes = require('./routes/chat');
const favoritesRoutes = require('./routes/favorites');
const adminRoutes = require('./routes/admin');
const programsRoutes = require('./routes/programs');
const eventsRoutes = require('./routes/events');
const galleryRoutes = require('./routes/gallery');
const { UPLOAD_DIR } = require('./middleware/upload');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/exhibits', exhibitRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/programs', programsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/gallery', galleryRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Fallback 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.listen(PORT, () => {
  console.log(`Museo Sang Bata sa Negros server running on http://localhost:${PORT}`);
  if (!process.env.OPENROUTER_API_KEY) {
    console.log('NOTE: OPENROUTER_API_KEY is not set — the museum chat assistant will be disabled until you add it to .env.');
  }
});
