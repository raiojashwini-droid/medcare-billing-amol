import express from 'express';
import { getModifiers, createModifier, updateModifier, deleteModifier } from '../controllers/modifierController.js';

const router = express.Router();

router.get('/', getModifiers);
router.post('/', createModifier);
router.put('/:id', updateModifier);
router.delete('/:id', deleteModifier);

export default router;
