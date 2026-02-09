import express from 'express';
import { pool } from '../db/postgres.js';

const router = express.Router();

// GET /api/metrics - Get platform metrics
router.get('/metrics', async (req, res) => {
    try {
        // Get store counts by status
        const statusCounts = await pool.query(`
            SELECT status, COUNT(*) as count
            FROM stores
            GROUP BY status
        `);

        // Get total stores
        const totalStores = await pool.query(`
            SELECT COUNT(*) as count FROM stores
        `);

        // Get stores created in last 24 hours
        const recentStores = await pool.query(`
            SELECT COUNT(*) as count
            FROM stores
            WHERE created_at > NOW() - INTERVAL '24 hours'
        `);

        // Get average provisioning time (from created to ready)
        const avgProvisionTime = await pool.query(`
            SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
            FROM stores
            WHERE status = 'ready'
            AND updated_at > NOW() - INTERVAL '7 days'
        `);

        // Get failure rate (last 24 hours)
        const failureRate = await pool.query(`
            SELECT 
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
                COUNT(*) as total_count
            FROM stores
            WHERE created_at > NOW() - INTERVAL '24 hours'
        `);

        // Get stores by type
        const storesByType = await pool.query(`
            SELECT type, COUNT(*) as count
            FROM stores
            GROUP BY type
        `);

        // Calculate success rate
        const failedCount = parseInt(failureRate.rows[0].failed_count) || 0;
        const totalCount = parseInt(failureRate.rows[0].total_count) || 0;
        const successRate = totalCount > 0
            ? ((totalCount - failedCount) / totalCount * 100).toFixed(2)
            : 100;

        res.json({
            success: true,
            data: {
                total_stores: parseInt(totalStores.rows[0].count),
                stores_by_status: statusCounts.rows.reduce((acc, row) => {
                    acc[row.status] = parseInt(row.count);
                    return acc;
                }, {}),
                stores_by_type: storesByType.rows.reduce((acc, row) => {
                    acc[row.type] = parseInt(row.count);
                    return acc;
                }, {}),
                recent_24h: parseInt(recentStores.rows[0].count),
                avg_provision_time_seconds: parseFloat(avgProvisionTime.rows[0].avg_seconds) || 0,
                success_rate_24h: parseFloat(successRate),
                failure_rate_24h: totalCount > 0
                    ? (failedCount / totalCount * 100).toFixed(2)
                    : 0
            }
        });
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch metrics'
        });
    }
});

// GET /api/metrics/timeline - Get store creation timeline
router.get('/metrics/timeline', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;

        const timeline = await pool.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count,
                COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready_count,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
            FROM stores
            WHERE created_at > NOW() - INTERVAL '${days} days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);

        res.json({
            success: true,
            data: timeline.rows
        });
    } catch (error) {
        console.error('Error fetching timeline:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch timeline'
        });
    }
});

export default router;
