const path = require('node:path');
require('dotenv').config({ path: [...new Set([path.join(__dirname, '.env'), path.resolve('.env')])] });
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const adRoutes = require('./routes/adRoutes');
const trendingRoutes = require('./routes/trendingRoutes');
const publicRoutes = require('./routes/publicRoutes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Share socket instance globally
app.set('io', io);

// Socket.io Connection Handlers
io.on('connection', (socket) => {
  socket.on('joinBusiness', (businessId) => {
    if (businessId) {
      socket.join(businessId.toString());
      console.log(`Socket connected: client joined business room ${businessId}`);
    }
  });

  socket.on('joinSuperAdmin', () => {
    socket.join('superadmin');
    console.log('Socket connected: client joined superadmin room');
  });

  socket.on('disconnect', () => {
    // disconnected
  });
});

// Connect to Database
connectDB().then(async () => {
  // DB Connected
});

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://whizle-app.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) return callback(null, true);
    
    if (
      origin.startsWith('http://localhost:') || 
      origin.endsWith('.netlify.app') || 
      allowedOrigins.includes(origin)
    ) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // expanded limit for base64 branding images
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Whistlez & Tokens Server is healthy and running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/trending', trendingRoutes);
app.use('/api/public', publicRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'The submission is too large. Use smaller files and try again.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'The server could not read this submission. Refresh the page and try again.' });
  }
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
