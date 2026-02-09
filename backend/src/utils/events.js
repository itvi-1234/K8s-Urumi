import { pool } from '../db/postgres.js';

/**
 * Log a store event
 * @param {Object} params - Event parameters
 * @param {string} params.storeId - Store ID
 * @param {string} params.eventType - Event type ('created', 'provisioning_started', 'provisioning_completed', etc.)
 * @param {string} params.message - Human-readable message
 * @param {Object} params.details - Additional details (optional)
 * @param {string} params.severity - Severity level ('info', 'warning', 'error', 'success')
 */
export async function logEvent({ storeId, eventType, message, details = {}, severity = 'info' }) {
    try {
        await pool.query(
            `INSERT INTO store_events (store_id, event_type, message, details, severity, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [storeId, eventType, message, JSON.stringify(details), severity]
        );

        console.log(`📋 Event: ${eventType} - ${message}`);
    } catch (error) {
        // Don't fail the main operation if event logging fails
        console.error(`⚠️  Event log failed: ${error.message}`);
    }
}

/**
 * Get events for a specific store
 * @param {string} storeId - Store ID
 * @param {number} limit - Maximum number of events to return (default: 50)
 * @returns {Promise<Array>} Array of event entries
 */
export async function getStoreEvents(storeId, limit = 50) {
    const result = await pool.query(
        `SELECT id, event_type, message, details, severity, created_at 
         FROM store_events 
         WHERE store_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [storeId, limit]
    );

    return result.rows;
}

/**
 * Get recent events across all stores
 * @param {number} limit - Maximum number of events to return (default: 100)
 * @returns {Promise<Array>} Array of event entries with store info
 */
export async function getRecentEvents(limit = 100) {
    const result = await pool.query(
        `SELECT e.*, s.name as store_name, s.type as store_type
         FROM store_events e
         LEFT JOIN stores s ON e.store_id = s.id
         ORDER BY e.created_at DESC 
         LIMIT $1`,
        [limit]
    );

    return result.rows;
}

/**
 * Get event statistics
 * @returns {Promise<Object>} Event statistics
 */
export async function getEventStats() {
    const result = await pool.query(`
        SELECT 
            event_type,
            severity,
            COUNT(*) as count
        FROM store_events
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY event_type, severity
        ORDER BY count DESC
    `);

    return result.rows;
}
