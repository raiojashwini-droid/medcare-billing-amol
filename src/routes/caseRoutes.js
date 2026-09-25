import express from 'express';
import { getCases, getCaseById, createCase, updateAssignedProviders, updateCase, deleteCase } from '../controllers/caseController.js';

const router = express.Router();

router.get('/', getCases);
router.get('/:id', getCaseById);
router.post('/', createCase);
router.put('/:id', updateCase);
router.put('/:id/providers', updateAssignedProviders);
router.delete('/:id', deleteCase);

export default router;
