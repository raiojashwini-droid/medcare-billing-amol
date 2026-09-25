import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './src/config/db.js';

import authRoutes from './src/routes/authRoutes.js';
import providerRoutes from './src/routes/providerRoutes.js';
import patientRoutes from './src/routes/patientRoutes.js';
import caseRoutes from './src/routes/caseRoutes.js';
import appointmentRoutes from './src/routes/appointmentRoutes.js';
import reminderRoutes from './src/routes/reminderRoutes.js';
import clinicalNoteRoutes from './src/routes/clinicalNoteRoutes.js';
import billingRoutes from './src/routes/billingRoutes.js';
import documentRoutes from './src/routes/documentRoutes.js';
import auditRoutes from './src/routes/auditRoutes.js';
import staffRoutes from './src/routes/staffRoutes.js';
import attorneyRoutes from './src/routes/attorneyRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import settingsRoutes from './src/routes/settingsRoutes.js';
import icdRoutes from './src/routes/icdRoutes.js';
import modalityRoutes from './src/routes/modalityRoutes.js';
import cptRoutes from './src/routes/cptRoutes.js';
import modifierRoutes from './src/routes/modifierRoutes.js';
import holidayRoutes from './src/routes/holidayRoutes.js';
import { logger } from './src/config/logger.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration for local development & deployed frontends
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }
    return callback(null, true); // Allow all valid origins
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Persistent request logger middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} - IP: ${req.ip} - User-Agent: ${req.headers['user-agent'] || 'unknown'}`);
  next();
});

// ──────────────────────────────────────────────────────────
// Route Registrations
// ──────────────────────────────────────────────────────────
app.use('/v1/auth', authRoutes);
app.use('/v1/providers', providerRoutes);
app.use('/v1/patients', patientRoutes);
app.use('/v1/cases', caseRoutes);
app.use('/v1/appointments', appointmentRoutes);
app.use('/v1/reminders', reminderRoutes);
app.use('/v1/notifications', notificationRoutes);
app.use('/v1/clinical-notes', clinicalNoteRoutes);
app.use('/v1/billing', billingRoutes);
app.use('/v1/documents', documentRoutes);
app.use('/v1/audit-logs', auditRoutes);
app.use('/v1/staff', staffRoutes);
app.use('/v1/attorneys', attorneyRoutes);
app.use('/v1/settings', settingsRoutes);
app.use('/v1/icd-codes', icdRoutes);
app.use('/v1/modalities', modalityRoutes);
app.use('/v1/cpt', cptRoutes);
app.use('/v1/modifiers', modifierRoutes);
app.use('/v1/holidays', holidayRoutes);

// Root landing endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ACTIVE',
    service: 'MedCare Billing & Clinical Platform API Server',
    version: '1.0.0',
    timestamp: new Date()
  });
});

// Database Connectivity Check Endpoint
app.get('/v1/status', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'UP',
      database: 'CONNECTED',
      port: PORT,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Database connectivity health check test failed', error);
    res.status(500).json({
      status: 'DOWN',
      database: 'DISCONNECTED',
      error: error.message,
      timestamp: new Date()
    });
  }
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled Exception on ${req.method} ${req.url}`, err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status === 413 ? 'Payload Too Large' : 'Internal server error.',
    message: err.message || 'An unexpected error occurred on the server.'
  });
});

// ──────────────────────────────────────────────────────────
// Start Server with graceful port-in-use handling
// ──────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`🚀 MedCare Billing Backend running at http://localhost:${PORT}`);
  console.log(`📡 Status endpoint:   http://localhost:${PORT}/v1/status`);
  console.log(`🔐 Auth endpoints:    http://localhost:${PORT}/v1/auth/login`);
  console.log(`                      http://localhost:${PORT}/v1/auth/mfa/verify`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Close the other server first, or set a different PORT in .env\n`);
    process.exit(1);
  } else {
    throw err;
  }
});