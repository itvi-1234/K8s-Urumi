import { pool } from '../db/postgres.js';
import { logAudit } from '../utils/audit.js';
import { logEvent } from '../utils/events.js';

/**
 * Upgrade a store to a new version
 * Uses Helm upgrade with --atomic flag for automatic rollback on failure
 */
export async function upgradeStore(req, res) {
    const { id } = req.params;
    const { version, values } = req.body;

    if (!version) {
        return res.status(400).json({
            success: false,
            error: 'Version is required'
        });
    }

    try {
        // Get store
        const result = await pool.query('SELECT * FROM stores WHERE id = $1', [id]);
        const store = result.rows[0];

        if (!store) {
            return res.status(404).json({
                success: false,
                error: 'Store not found'
            });
        }

        // Check if store is ready
        if (store.status !== 'ready') {
            return res.status(400).json({
                success: false,
                error: `Cannot upgrade store in ${store.status} status. Store must be ready.`
            });
        }

        // Check if version is different
        if (store.version === version) {
            return res.status(400).json({
                success: false,
                error: `Store is already at version ${version}`
            });
        }

        // Mark store as upgrading
        await pool.query(
            `UPDATE stores 
             SET status = 'upgrading', 
                 updated_at = NOW() 
             WHERE id = $1`,
            [id]
        );

        // Log audit
        await logAudit(pool, {
            storeId: id,
            action: 'upgrade_initiated',
            details: {
                from_version: store.version,
                to_version: version,
                values: values || {}
            },
            ipAddress: req.ip
        });

        // Log event
        await logEvent({
            storeId: id,
            eventType: 'upgrade_started',
            message: `Upgrading from v${store.version} to v${version}`,
            details: { from: store.version, to: version },
            severity: 'info'
        });

        res.json({
            success: true,
            message: `Store upgrade initiated from v${store.version} to v${version}`,
            data: {
                id: store.id,
                name: store.name,
                from_version: store.version,
                to_version: version,
                status: 'upgrading'
            }
        });

        // Note: Actual Helm upgrade will be handled by orchestrator
        // The orchestrator will detect 'upgrading' status and perform the upgrade

    } catch (error) {
        console.error('Upgrade error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initiate store upgrade'
        });
    }
}

/**
 * Rollback a store to previous version
 * Uses Helm rollback command
 */
export async function rollbackStore(req, res) {
    const { id } = req.params;
    const { revision } = req.body;

    try {
        // Get store
        const result = await pool.query('SELECT * FROM stores WHERE id = $1', [id]);
        const store = result.rows[0];

        if (!store) {
            return res.status(404).json({
                success: false,
                error: 'Store not found'
            });
        }

        // Check if store has a helm release
        if (!store.helm_release) {
            return res.status(400).json({
                success: false,
                error: 'Store does not have a Helm release to rollback'
            });
        }

        // Check if store is in a rollback-able state
        if (!['ready', 'failed', 'upgrading'].includes(store.status)) {
            return res.status(400).json({
                success: false,
                error: `Cannot rollback store in ${store.status} status`
            });
        }

        // Determine target revision
        const targetRevision = revision || (store.helm_revision - 1);

        if (targetRevision < 1) {
            return res.status(400).json({
                success: false,
                error: 'No previous revision to rollback to'
            });
        }

        // Mark store as upgrading (rollback is a type of upgrade)
        await pool.query(
            `UPDATE stores 
             SET status = 'upgrading', 
                 updated_at = NOW() 
             WHERE id = $1`,
            [id]
        );

        // Log audit
        await logAudit(pool, {
            storeId: id,
            action: 'rollback_initiated',
            details: {
                current_revision: store.helm_revision,
                target_revision: targetRevision
            },
            ipAddress: req.ip
        });

        // Log event
        await logEvent({
            storeId: id,
            eventType: 'rollback_started',
            message: `Rolling back from revision ${store.helm_revision} to ${targetRevision}`,
            details: { from: store.helm_revision, to: targetRevision },
            severity: 'warning'
        });

        res.json({
            success: true,
            message: `Store rollback initiated to revision ${targetRevision}`,
            data: {
                id: store.id,
                name: store.name,
                current_revision: store.helm_revision,
                target_revision: targetRevision,
                status: 'upgrading'
            }
        });

        // Note: Actual Helm rollback will be handled by orchestrator

    } catch (error) {
        console.error('Rollback error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initiate store rollback'
        });
    }
}

/**
 * Get upgrade history for a store
 */
export async function getUpgradeHistory(req, res) {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `SELECT * FROM audit_log 
             WHERE store_id = $1 
             AND action IN ('upgrade_initiated', 'upgrade_completed', 'upgrade_failed', 'rollback_initiated', 'rollback_completed')
             ORDER BY created_at DESC
             LIMIT 50`,
            [id]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get upgrade history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get upgrade history'
        });
    }
}
