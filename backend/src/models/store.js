import pool from '../db/postgres.js';
import { v4 as uuidv4 } from 'uuid';

export const storeModel = {
    // Get all stores
    async findAll() {
        const result = await pool.query(
            'SELECT * FROM stores ORDER BY created_at DESC'
        );
        return result.rows;
    },

    // Get store by ID
    async findById(id) {
        const result = await pool.query(
            'SELECT * FROM stores WHERE id = $1',
            [id]
        );
        return result.rows[0];
    },

    // Get store by namespace
    async findByNamespace(namespace) {
        const result = await pool.query(
            'SELECT * FROM stores WHERE namespace = $1',
            [namespace]
        );
        return result.rows[0];
    },

    // Get stores by status
    async findByStatus(status) {
        const result = await pool.query(
            'SELECT * FROM stores WHERE status = $1',
            [status]
        );
        return result.rows;
    },

    // Create new store
    async create(data) {
        const id = uuidv4();
        const namespace = `store-${data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${id.substring(0, 8)}`;
        const helmRelease = `${data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

        const result = await pool.query(
            `INSERT INTO stores (id, name, type, status, namespace, helm_release)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [id, data.name, data.type, 'provisioning', namespace, helmRelease]
        );
        return result.rows[0];
    },

    // Update store status
    async updateStatus(id, status, url = null, errorMessage = null) {
        const result = await pool.query(
            `UPDATE stores 
       SET status = $1, url = $2, error_message = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
            [status, url, errorMessage, id]
        );
        return result.rows[0];
    },

    // Delete store
    async delete(id) {
        const result = await pool.query(
            'DELETE FROM stores WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    },

    // Log audit event
    async logAudit(userId, action, storeId, ipAddress, details = {}) {
        await pool.query(
            `INSERT INTO audit_logs (user_id, action, store_id, ip_address, details)
       VALUES ($1, $2, $3, $4, $5)`,
            [userId, action, storeId, ipAddress, JSON.stringify(details)]
        );
    }
};
