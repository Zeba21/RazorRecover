const express = require('express');
const { testConnection } = require('../config/supabase');
const { config } = require('../config/env');

const router = express.Router();

/**
 * GET /api/health
 * Returns system health status including database connectivity
 * and AI service reachability.
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();

  // Check Supabase connectivity
  const dbStatus = await testConnection();

  // Check AI service connectivity
  let aiServiceStatus = { connected: false, error: 'Not checked' };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${config.aiServiceUrl}/health`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (response.ok) {
      aiServiceStatus = { connected: true };
    } else {
      aiServiceStatus = { connected: false, error: `HTTP ${response.status}` };
    }
  } catch (err) {
    aiServiceStatus = { connected: false, error: 'AI service unreachable' };
  }

  const responseTime = Date.now() - startTime;

  const allHealthy = dbStatus.connected;
  // AI service being down is a warning, not a failure for the backend health check

  res.status(allHealthy ? 200 : 503).json({
    success: true,
    data: {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      version: '1.0.0',
      services: {
        database: {
          status: dbStatus.connected ? 'connected' : 'disconnected',
          ...(dbStatus.error && { error: dbStatus.error })
        },
        aiService: {
          status: aiServiceStatus.connected ? 'connected' : 'disconnected',
          url: config.aiServiceUrl,
          ...(aiServiceStatus.error && { error: aiServiceStatus.error })
        }
      },
      environment: config.nodeEnv
    }
  });
});

module.exports = router;
