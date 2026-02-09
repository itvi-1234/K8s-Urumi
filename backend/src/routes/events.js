import express from 'express';
import { getStoreEvents, getRecentEvents, getEventStats } from '../utils/events.js';

const router = express.Router();

// GET /api/stores/:id/events - Get events for a specific store
router.get('/stores/:id/events', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const events = await getStoreEvents(req.params.id, limit);

        res.json({
            success: true,
            data: events
        });
    } catch (error) {
        console.error('Error fetching store events:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch store events'
        });
    }
});

// GET /api/events - Get recent events across all stores
router.get('/events', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const events = await getRecentEvents(limit);

        res.json({
            success: true,
            data: events
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch events'
        });
    }
});

// GET /api/events/stats - Get event statistics
router.get('/events/stats', async (req, res) => {
    try {
        const stats = await getEventStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching event stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch event statistics'
        });
    }
});

export default router;
