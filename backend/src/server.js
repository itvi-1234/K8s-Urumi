import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db/postgres.js';
import storeRoutes from './routes/stores.js';
import eventsRoutes from './routes/events.js';
import metricsRoutes from './routes/metrics.js';
import upgradeRoutes from './routes/upgrades.js';
import { apiRateLimiter } from './middleware/rateLimit.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Apply general rate limiting to all API routes
app.use('/api', apiRateLimiter);

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api', storeRoutes);
app.use('/api', eventsRoutes);
app.use('/api', metricsRoutes);
app.use('/api', upgradeRoutes);

// Error handling
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
async function start() {
    try {
        // Initialize database
        await initDatabase();

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Backend API running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

start();
