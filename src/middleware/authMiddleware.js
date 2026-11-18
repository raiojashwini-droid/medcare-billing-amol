import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'medcare_billing_super_secret_key';

export const RESTRICTED_DOCTOR_PROVIDERS = ['prov-anik', 'prov-davs', 'prov-tpi', 'prov-tecar'];
export const ALLOWED_DOCTOR_PROVIDERS = ['prov-josmic', 'prov-counselor'];

export const RESTRICTED_DOCTOR_NOTE_TYPES = [
  'LASER_THERAPY',
  'LASER_PROCEDURE',
  'ESWT',
  'ESWT_SHOCKWAVE',
  'TPI',
  'TRIGGER_POINT_INJECTION',
  'TECAR',
  'TECAR_THERAPY'
];

/**
 * Extract authenticated user info from JWT header or x-user-role header
 */
export const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // Token might be invalid or expired
    }
  }

  // Fallback to custom role header if passed by client
  if (!req.user && req.headers['x-user-role']) {
    req.user = {
      role: req.headers['x-user-role'],
      id: req.headers['x-user-id'] || 'demo-user'
    };
  }

  next();
};

/**
 * Middleware: Strictly block Doctor role from accessing or modifying restricted assessment forms
 */
export const restrictDoctorAssessments = async (req, res, next) => {
  const userRole = req.user?.role;

  // Only apply restrictions if user is a Doctor
  if (userRole !== 'Doctor') {
    return next();
  }

  // 1. Check providerId in query or body
  const targetProviderId = req.query.providerId || req.body?.providerId;
  if (targetProviderId && RESTRICTED_DOCTOR_PROVIDERS.includes(targetProviderId)) {
    return res.status(403).json({
      error: 'Access forbidden: Doctor role is restricted to Pain Management and Counseling assessment forms only.',
      code: 'DOCTOR_ASSESSMENT_FORBIDDEN'
    });
  }

  // 2. Check noteType in query or body
  const targetNoteType = (req.query.type || req.body?.type || req.body?.noteType || '').toUpperCase();
  if (targetNoteType && RESTRICTED_DOCTOR_NOTE_TYPES.some(rt => targetNoteType.includes(rt))) {
    return res.status(403).json({
      error: 'Access forbidden: Doctor role is restricted to Pain Management and Counseling assessment forms only.',
      code: 'DOCTOR_ASSESSMENT_FORBIDDEN'
    });
  }

  // 3. For route params with note ID (GET /:id, PUT /:id/sign, PUT /:id/amend, DELETE /:id)
  if (req.params?.id) {
    try {
      const note = await prisma.clinicalNote.findUnique({
        where: { id: req.params.id },
        select: { providerId: true, noteType: true }
      });

      if (note) {
        const isRestrictedProvider = RESTRICTED_DOCTOR_PROVIDERS.includes(note.providerId);
        const isRestrictedType = RESTRICTED_DOCTOR_NOTE_TYPES.some(rt => (note.noteType || '').toUpperCase().includes(rt));

        if (isRestrictedProvider || isRestrictedType) {
          return res.status(403).json({
            error: 'Access forbidden: Doctor role is restricted to Pain Management and Counseling assessment forms only.',
            code: 'DOCTOR_ASSESSMENT_FORBIDDEN'
          });
        }
      }
    } catch (e) {
      console.error('Error in assessment permission check:', e);
    }
  }

  // 4. For list query without providerId: automatically filter to allowed providers if Doctor
  if (req.method === 'GET' && !req.query.providerId && !req.params?.id) {
    req.doctorFilterAllowedOnly = true;
  }

  next();
};
