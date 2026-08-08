require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.disable('x-powered-by');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://venkateswara23bce9443_db_user:IoL9MrbbJ53rF9wr@cluster0.bjrapl5.mongodb.net/hotel?retryWrites=true&w=majority';

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 3000,
      maxPoolSize: 10,
      socketTimeoutMS: 20000,
    };

    cached.promise = mongoose.connect(MONGO_URI, opts).then((m) => {
      console.log('✅ Connected to MongoDB Atlas');
      return m;
    }).catch(err => {
      cached.promise = null;
      console.warn('⚠️ MongoDB Atlas Connection Warning:', err.message);
      return null;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

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

app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.warn('⚠️ DB Connection Middleware Note:', err.message);
  }
  next();
});

const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');

app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/orders', orderRoutes);
app.use('/orders', orderRoutes);

const getHealthStatus = () => {
  const states = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      state: states[mongoose.connection.readyState] || 'Unknown',
      readyState: mongoose.connection.readyState,
    },
    environment: process.env.NODE_ENV || 'development',
  };
};

app.get('/api/health', (req, res) => res.json(getHealthStatus()));
app.get('/health', (req, res) => res.json(getHealthStatus()));

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

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Strong Express Server running on port ${PORT}`);
    console.log(`📡 CORS allowed origins: ${Array.isArray(allowedOrigins) ? allowedOrigins.join(', ') : allowedOrigins}`);
  });
}

module.exports = app;
