// backend/src/routes/notificationRoutes.js
import express from 'express';
import { testEmailDispatch, getNotificationLogs, getLiveNotifications } from '../controllers/notificationController.js';

const router = express.Router();

router.get('/', getLiveNotifications);
router.get('/live', getLiveNotifications);
router.post('/test-email', testEmailDispatch);
router.get('/logs', getNotificationLogs);

export default router;
