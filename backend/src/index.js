const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { validateEnv, config } = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health');
const eventRoutes = require('./routes/events');
const demoRoutes = require('./routes/demo');
const paymentsRoutes = require('./routes/payments');
const recoveryCasesRoutes = require('./routes/recoveryCases');

// Validate environment variables on startup
validateEnv();

const app = express();

// --------------- Middleware ---------------
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// --------------- Routes ---------------
app.use('/api/health', healthRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/recovery-cases', recoveryCasesRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'RazorRecover API',
      version: '1.0.0',
      description: 'AI Revenue Recovery Agent Backend',
      docs: '/api/health'
    }
  });
});

// --------------- Error Handling ---------------
app.use(notFoundHandler);
app.use(errorHandler);

// --------------- Start Server ---------------
const PORT = config.port;

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ═══════════════════════════════════════════');
  console.log(`   RazorRecover Backend v1.0.0`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Server:      http://localhost:${PORT}`);
  console.log(`   Health:      http://localhost:${PORT}/api/health`);
  console.log(`   AI Service:  ${config.aiServiceUrl}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');
});

module.exports = app;
