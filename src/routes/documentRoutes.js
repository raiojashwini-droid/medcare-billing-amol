import express from 'express';
import { getDocuments, uploadDocument, deleteDocument, buildPatientPacket } from '../controllers/documentController.js';

const router = express.Router();

router.get('/', getDocuments);
router.post('/', uploadDocument);
router.delete('/:id', deleteDocument);
router.post('/packet', buildPatientPacket);

export default router;
