import express from 'express';
import { upgradeStore, rollbackStore, getUpgradeHistory } from '../controllers/upgradeController.js';

const router = express.Router();

// Upgrade a store to a new version
router.post('/stores/:id/upgrade', upgradeStore);

// Rollback a store to a previous version
router.post('/stores/:id/rollback', rollbackStore);

// Get upgrade history for a store
router.get('/stores/:id/upgrade-history', getUpgradeHistory);

export default router;
