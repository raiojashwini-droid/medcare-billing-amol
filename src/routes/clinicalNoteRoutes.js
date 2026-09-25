import express from 'express';
import { 
  getNotes, getNoteById, createNote, signNote, amendNote, generateAiDraft, deleteNote 
} from '../controllers/clinicalNoteController.js';

const router = express.Router();

router.get('/', getNotes);
router.post('/', createNote);
router.post('/ai-suggest', generateAiDraft);
router.get('/:id', getNoteById);
router.put('/:id/sign', signNote);
router.put('/:id/amend', amendNote);
router.delete('/:id', deleteNote);

export default router;

