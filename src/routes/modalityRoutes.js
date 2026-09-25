import express from 'express';
import {
  getAllModalities,
  createModality,
  updateModality,
  deleteModality
} from '../controllers/modalityController.js';

const router = express.Router();

router.get('/', getAllModalities);
router.post('/', createModality);
router.put('/:id', updateModality);
router.delete('/:id', deleteModality);

export default router;
