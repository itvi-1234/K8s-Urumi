import { pool } from '../db/postgres.js';

/**
 * Log an audit event
 * @param {Object} params - Audit log parameters
 * @param {string} params.storeId - Store ID
 * @param {string} params.action - Action performed ('create', 'delete', 'update', 'provision', 'deprovision')
 * @param {Object} params.details - Additional details about the action
 * @param {string} params.ipAddress - IP address of the requester (optional)
 * @param {string} params.userId - User ID (optional, for future use)
 */
export async function logAudit({ storeId, action, details = {}, ipAddress = null, userId = null }) {
    try {
        await pool.query(
            `INSERT INTO audit_log (store_id, user_id, action, details, ip_address, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [storeId, userId, action, JSON.stringify(details), ipAddress]
        );

        console.log(`📝 Audit: ${action} - Store: ${storeId}`);
    } catch (error) {
        // Don't fail the main operation if audit logging fails
        console.error(`⚠️  Audit log failed: ${error.message}`);
    }
}

/**
 * Get audit logs for a specific store
 * @param {string} storeId - Store ID
 * @param {number} limit - Maximum number of logs to return (default: 50)
 * @returns {Promise<Array>} Array of audit log entries
 */
export async function getAuditLogs(storeId, limit = 50) {
    const result = await pool.query(
        `SELECT * FROM audit_log 
         WHERE store_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [storeId, limit]
    );

    return result.rows;
}

/**
 * Get all audit logs (admin view)
 * @param {number} limit - Maximum number of logs to return (default: 100)
 * @returns {Promise<Array>} Array of audit log entries
 */
export async function getAllAuditLogs(limit = 100) {
    const result = await pool.query(
        `SELECT al.*, s.name as store_name 
         FROM audit_log al
         LEFT JOIN stores s ON al.store_id = s.id
         ORDER BY al.created_at DESC 
         LIMIT $1`,
        [limit]
    );

    return result.rows;
}
