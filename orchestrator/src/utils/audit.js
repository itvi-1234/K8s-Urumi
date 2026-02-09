import pg from 'pg';

/**
 * Log an audit event from the orchestrator
 * @param {Object} pool - PostgreSQL pool
 * @param {Object} params - Audit log parameters
 */
export async function logAudit(pool, { storeId, action, details = {} }) {
    try {
        await pool.query(
            `INSERT INTO audit_log (store_id, action, details, created_at)
             VALUES ($1, $2, $3, NOW())`,
            [storeId, action, JSON.stringify(details)]
        );

        console.log(`📝 Audit: ${action} - Store: ${storeId}`);
    } catch (error) {
        // Don't fail the main operation if audit logging fails
        console.error(`⚠️  Audit log failed: ${error.message}`);
    }
}
