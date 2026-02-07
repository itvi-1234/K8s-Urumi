import express from 'express';
import { storeController } from '../controllers/storeController.js';

const router = express.Router();

router.get('/stores', storeController.listStores);
router.get('/stores/:id', storeController.getStore);
router.post('/stores', storeController.createStore);
router.delete('/stores/:id', storeController.deleteStore);
router.get('/health', storeController.healthCheck);

export default router;
