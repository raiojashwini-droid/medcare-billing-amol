import express from 'express';
import { 
  getAppointments, createAppointment, getAvailableSlots, autoBookAppointment,
  updateStatus, reschedule, cancel, updateAppointment, deleteAppointment 
} from '../controllers/appointmentController.js';

const router = express.Router();

router.get('/', getAppointments);
router.post('/', createAppointment);
router.get('/available-slots', getAvailableSlots);
router.post('/auto-book', autoBookAppointment);
router.patch('/:id/status', updateStatus);
router.patch('/:id/reschedule', reschedule);
router.patch('/:id/cancel', cancel);
router.put('/:id', updateAppointment);
router.delete('/:id', deleteAppointment);

export default router;
