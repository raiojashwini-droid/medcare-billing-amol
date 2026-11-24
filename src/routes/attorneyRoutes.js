// backend/src/routes/attorneyRoutes.js
import express from 'express';
import { getAttorneys, createAttorney, updateAttorney, deleteAttorney } from '../controllers/attorneyController.js';

const router = express.Router();

router.get('/', getAttorneys);
router.post('/', createAttorney);
router.put('/:id', updateAttorney);
router.delete('/:id', deleteAttorney);

export default router;
