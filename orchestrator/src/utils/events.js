import pg from 'pg';

/**
 * Log a store event from the orchestrator
 * @param {Object} pool - PostgreSQL pool
 * @param {Object} params - Event parameters
 */
export async function logEvent(pool, { storeId, eventType, message, details = {}, severity = 'info' }) {
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
