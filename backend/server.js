const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { supabase } = require('./db/supabase');

const app = express();

app.disable('x-powered-by');

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : '*';

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins === '*' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  if (req.url.startsWith('/api/index.js')) {
    req.url = req.url.replace('/api/index.js', '') || '/';
  }
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl || req.url}`);
  next();
});

const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');

app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/orders', orderRoutes);
app.use('/orders', orderRoutes);

const getHealthStatus = async () => {
  let dbStatus = 'Connected';
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) dbStatus = `Error: ${error.message}`;
  } catch (err) {
    dbStatus = `Disconnected: ${err.message}`;
  }

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      type: 'Supabase PostgreSQL',
      status: dbStatus,
      project: 'mjeqguefmmzubtarsoxu',
    },
    environment: process.env.NODE_ENV || 'development',
  };
};

app.get('/api/health', async (req, res) => res.json(await getHealthStatus()));
app.get('/health', async (req, res) => res.json(await getHealthStatus()));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    suggestion: 'Please verify the API path.',
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack || err.message || err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const ensureAdminUser = async () => {
  try {
    const { data } = await supabase.from('users').select('id').eq('email', 'admin@restaurant.com').maybeSingle();
    if (!data) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('admin123', 10);
      await supabase.from('users').insert({
        name: 'Restaurant Owner',
        email: 'admin@restaurant.com',
        password: hash,
        mobile: '9876543210',
        role: 'admin',
      });
      console.log('👑 Default restaurant owner initialized: admin@restaurant.com (password: admin123)');
    }
  } catch (e) {
    console.warn('⚠️ Admin init note:', e.message);
  }
};

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, async () => {
    console.log(`🚀 Breakfast Server running on port ${PORT}`);
    console.log(`⚡ Connected to Supabase PostgreSQL Database`);
    console.log(`📡 CORS allowed origins: ${Array.isArray(allowedOrigins) ? allowedOrigins.join(', ') : allowedOrigins}`);
    await ensureAdminUser();
  });
}

module.exports = app;
