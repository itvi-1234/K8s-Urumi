import express from 'express';
import { storeController } from '../controllers/storeController.js';
import { createStoreRateLimiter, deleteStoreRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.get('/stores', storeController.listStores);
router.get('/stores/:id', storeController.getStore);
router.post('/stores', createStoreRateLimiter, storeController.createStore);
router.delete('/stores/:id', deleteStoreRateLimiter, storeController.deleteStore);
router.get('/health', storeController.healthCheck);

export default router;
