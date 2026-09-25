import express from 'express';
import { getProviders, createProvider, updateProvider, deleteProvider } from '../controllers/providerController.js';

const router = express.Router();

router.get('/', getProviders);
router.post('/', createProvider);
router.put('/:id', updateProvider);
router.delete('/:id', deleteProvider);

export default router;
