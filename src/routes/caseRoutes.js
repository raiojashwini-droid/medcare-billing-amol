import express from 'express';
import { getCases, getCaseById, createCase, updateAssignedProviders, updateCase, deleteCase } from '../controllers/caseController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateUser);

router.get('/', getCases);
router.get('/:id', getCaseById);
router.post('/', createCase);
router.put('/:id', updateCase);
router.put('/:id/providers', updateAssignedProviders);
router.delete('/:id', deleteCase);

export default router;
