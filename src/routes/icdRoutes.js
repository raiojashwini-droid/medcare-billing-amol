import express from 'express';
import {
  getAllICDCodes,
  createICDCode,
  updateICDCode,
  deleteICDCode
} from '../controllers/icdController.js';

const router = express.Router();

router.get('/', getAllICDCodes);
router.post('/', createICDCode);
router.put('/:id', updateICDCode);
router.delete('/:id', deleteICDCode);

export default router;
