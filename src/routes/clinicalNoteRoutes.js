import express from 'express';
import { 
  getNotes, getNoteById, createNote, signNote, amendNote, generateAiDraft, deleteNote 
} from '../controllers/clinicalNoteController.js';
import { authenticateUser, restrictDoctorAssessments } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply auth identification and doctor assessment restrictions across clinical notes
router.use(authenticateUser);
router.use(restrictDoctorAssessments);

router.get('/', getNotes);
router.post('/', createNote);
router.post('/ai-suggest', generateAiDraft);
router.post('/ai-draft', generateAiDraft);
router.get('/:id', getNoteById);
router.put('/:id/sign', signNote);
router.put('/:id/amend', amendNote);
router.delete('/:id', deleteNote);

export default router;

