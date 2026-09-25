import express from 'express';
import { getSettings, saveSettings, getLogs, simulatePatientResponse } from '../controllers/reminderController.js';

const router = express.Router();

router.get('/settings', getSettings);
router.put('/settings', saveSettings);
router.get('/logs', getLogs);
router.post('/logs/:id/simulate', simulatePatientResponse);

export default router;
