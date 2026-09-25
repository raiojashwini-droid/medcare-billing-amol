// backend/src/routes/attorneyRoutes.js
import express from 'express';
import { getAttorneys, createAttorney, updateAttorney } from '../controllers/attorneyController.js';

const router = express.Router();

router.get('/', getAttorneys);
router.post('/', createAttorney);
router.put('/:id', updateAttorney);

export default router;
