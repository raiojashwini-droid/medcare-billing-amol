import express from 'express';
import { getStaff, createStaff, updateStaff, deleteStaff } from '../controllers/staffController.js';

const router = express.Router();

router.get('/', getStaff);
router.post('/', createStaff);
router.put('/:id', updateStaff);
router.patch('/:id', updateStaff);
router.delete('/:id', deleteStaff);

export default router;
