import express from 'express';
import { getLogs, logAction } from '../controllers/auditController.js';

const router = express.Router();

router.get('/', getLogs);
router.post('/', logAction);

export default router;
