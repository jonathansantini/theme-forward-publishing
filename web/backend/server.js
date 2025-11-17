import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import compression from 'compression';
import { shopify } from './services/shopify-api.js';
import { ShopifyGraphQLClient } from './services/shopify-api.js';
import { MetafieldStorage } from './services/metafield-storage.js';
import { ThemeModifier } from './services/theme-modifier.js';
import { Scheduler } from './services/scheduler.js';
import { ScheduleProcessor } from './jobs/schedule-processor.js';
import { MemorySessionStorage } from '@shopify/shopify-app-session-storage-memory';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Import routes
import authRoutes from './routes/auth.js';
import schedulesRoutes from './routes/schedules.js';
import themesRoutes from './routes/themes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Configure session storage (in-memory for MVP, should use Redis/Postgres in production)
const sessionStorage = new MemorySessionStorage();
shopify.config.sessionStorage = sessionStorage;

// Track active shops for schedule processing (MVP approach)
global.activeShops = new Map(); // Map of shop domain -> session

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    processor: global.scheduleProcessor?.getStatus() || { running: false },
  });
});

// Auth routes
app.use('/', authRoutes);

// API routes
app.use('/api/schedules', schedulesRoutes);
app.use('/api/themes', themesRoutes);

// Shop info endpoint
app.get('/api/shop', async (req, res) => {
  try {
    const sessionId = await shopify.session.getCurrentId({
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });

    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await shopify.config.sessionStorage.loadSession(sessionId);

    if (!session) {
      return res.status(401).json({ error: 'Session not found' });
    }

    const graphqlClient = new ShopifyGraphQLClient(session);
    const shopInfo = await graphqlClient.getShopInfo();

    res.json({ shop: shopInfo });
  } catch (error) {
    console.error('Get shop info error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger endpoint for testing schedule processor
app.post('/api/processor/trigger', async (req, res) => {
  try {
    if (!global.scheduleProcessor) {
      return res.status(503).json({ error: 'Schedule processor not initialized' });
    }

    const results = await global.scheduleProcessor.triggerManually();
    res.json({ success: true, results });
  } catch (error) {
    console.error('Manual trigger error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Processor status endpoint
app.get('/api/processor/status', (req, res) => {
  if (!global.scheduleProcessor) {
    return res.json({ running: false, message: 'Processor not initialized' });
  }

  const status = global.scheduleProcessor.getStatus();
  res.json(status);
});

// Serve frontend
if (process.env.NODE_ENV === 'production') {
  // Production: serve built files
  app.use(express.static('web/frontend/dist'));

  app.get('*', (req, res) => {
    res.sendFile('web/frontend/dist/index.html', { root: '.' });
  });
} else {
  // Development: proxy to Vite dev server
  app.use(
    '/',
    createProxyMiddleware({
      target: 'http://localhost:5173',
      changeOrigin: true,
      ws: true, // Proxy websockets for HMR
      // Don't proxy API routes
      filter: (pathname) => {
        return !pathname.startsWith('/api') &&
               !pathname.startsWith('/auth') &&
               pathname !== '/health';
      },
    })
  );
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📅 Schedule processor will start monitoring for scheduled changes\n`);

  // Initialize schedule processor
  // Note: This will be initialized per-shop in a multi-tenant setup
  // For MVP, we'll use a simplified approach
  initializeScheduleProcessor();
});

/**
 * Initialize the schedule processor
 * In production, this should be per-shop with proper session management
 */
async function initializeScheduleProcessor() {
  try {
    console.log('⏰ Initializing schedule processor...');

    // Create a multi-tenant scheduler that processes all shops
    const multiTenantScheduler = {
      async processPendingSchedules() {
        const results = [];

        // Get all active shops
        if (!global.activeShops || global.activeShops.size === 0) {
          // No active shops yet, silently return
          return results;
        }

        console.log(`Processing schedules for ${global.activeShops.size} shop(s)`);

        // Process each shop's schedules
        for (const [shopDomain, session] of global.activeShops.entries()) {
          try {
            if (!session || !session.accessToken) {
              console.log(`Skipping invalid session for shop: ${shopDomain}`);
              continue;
            }

            // Initialize services for this shop
            const graphqlClient = new ShopifyGraphQLClient(session);
            const metafieldStorage = new MetafieldStorage(graphqlClient);
            const themeModifier = new ThemeModifier(graphqlClient, metafieldStorage);
            const scheduler = new Scheduler(graphqlClient, metafieldStorage, themeModifier);

            // Process this shop's pending schedules
            const shopResults = await scheduler.processPendingSchedules();

            if (shopResults.length > 0) {
              console.log(`Processed ${shopResults.length} schedule(s) for ${shopDomain}`);
            }

            results.push(...shopResults);

          } catch (error) {
            console.error(`Error processing shop ${shopDomain}:`, error);
          }
        }

        return results;
      }
    };

    // Create and start the processor
    const processor = new ScheduleProcessor(multiTenantScheduler);
    processor.start();

    global.scheduleProcessor = processor;

    console.log('✓ Schedule processor started successfully');
  } catch (error) {
    console.error('Failed to initialize schedule processor:', error);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');

  if (global.scheduleProcessor && global.scheduleProcessor.stop) {
    global.scheduleProcessor.stop();
  }

  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');

  if (global.scheduleProcessor && global.scheduleProcessor.stop) {
    global.scheduleProcessor.stop();
  }

  process.exit(0);
});

export default app;
