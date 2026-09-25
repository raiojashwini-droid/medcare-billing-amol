import express from 'express';
import { login, verifyMfa, getCurrentUser, updateProfile } from '../controllers/authController.js';

const router = express.Router();

// Auth route bindings
router.post('/login', login);
router.post('/mfa/verify', verifyMfa);
router.get('/me', getCurrentUser);
router.put('/profile', updateProfile);
router.patch('/profile', updateProfile);

export default router;
