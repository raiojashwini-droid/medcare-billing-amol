import express from 'express';
import { getCptCodes, createCptCode, updateCptCode, deleteCptCode } from '../controllers/cptController.js';

const router = express.Router();

router.get('/', getCptCodes);
router.post('/', createCptCode);
router.put('/:id', updateCptCode);
router.delete('/:id', deleteCptCode);

export default router;
