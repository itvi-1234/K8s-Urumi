import { storeModel } from '../models/store.js';
import { logAudit } from '../utils/audit.js';
import { logEvent } from '../utils/events.js';
import Joi from 'joi';

// Validation schema
const createStoreSchema = Joi.object({
    name: Joi.string().min(3).max(50).pattern(/^[a-zA-Z0-9-]+$/).required(),
    type: Joi.string().valid('woocommerce', 'medusa').required()
});

export const storeController = {
    // GET /api/stores - List all stores
    async listStores(req, res) {
        try {
            const stores = await storeModel.findAll();
            res.json({ success: true, data: stores });
        } catch (error) {
            console.error('Error listing stores:', error);
            res.status(500).json({ success: false, error: 'Failed to list stores' });
        }
    },

    // GET /api/stores/:id - Get store by ID
    async getStore(req, res) {
        try {
            const store = await storeModel.findById(req.params.id);
            if (!store) {
                return res.status(404).json({ success: false, error: 'Store not found' });
            }
            res.json({ success: true, data: store });
        } catch (error) {
            console.error('Error getting store:', error);
            res.status(500).json({ success: false, error: 'Failed to get store' });
        }
    },

    // POST /api/stores - Create new store
    async createStore(req, res) {
        try {
            // Validate input
            const { error, value } = createStoreSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    error: error.details[0].message
                });
            }

            // Check for duplicate name
            const existing = await storeModel.findByNamespace(
                `store-${value.name.toLowerCase()}`
            );
            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: 'Store with this name already exists'
                });
            }

            // Create store
            const store = await storeModel.create(value);

            // Log audit
            await logAudit({
                storeId: store.id,
                action: 'create',
                details: { name: value.name, type: value.type },
                ipAddress: req.ip
            });

            // Log event
            await logEvent({
                storeId: store.id,
                eventType: 'store_created',
                message: `Store '${value.name}' created`,
                details: { type: value.type },
                severity: 'success'
            });

            res.status(201).json({ success: true, data: store });
        } catch (error) {
            console.error('Error creating store:', error);
            res.status(500).json({ success: false, error: 'Failed to create store' });
        }
    },

    // DELETE /api/stores/:id - Delete store
    async deleteStore(req, res) {
        try {
            const store = await storeModel.findById(req.params.id);
            if (!store) {
                return res.status(404).json({ success: false, error: 'Store not found' });
            }

            // Mark as deleting (orchestrator will handle cleanup)
            await storeModel.updateStatus(req.params.id, 'deleting');

            // Log audit
            await logAudit({
                storeId: store.id,
                action: 'delete',
                details: { name: store.name },
                ipAddress: req.ip
            });

            // Log event
            await logEvent({
                storeId: store.id,
                eventType: 'deletion_requested',
                message: `Deletion requested for store '${store.name}'`,
                details: { name: store.name },
                severity: 'warning'
            });

            res.json({ success: true, message: 'Store deletion initiated' });
        } catch (error) {
            console.error('Error deleting store:', error);
            res.status(500).json({ success: false, error: 'Failed to delete store' });
        }
    },

    // GET /api/health - Health check
    async healthCheck(req, res) {
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    }
};
