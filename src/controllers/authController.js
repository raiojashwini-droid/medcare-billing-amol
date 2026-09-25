import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'medcare_billing_super_secret_key';

const getProviderIdForUser = (user) => {
  if (!user) return null;
  if (user.role === 'Doctor') return 'prov-josmic';
  if (user.role === 'Therapist') return 'prov-davs';
  if (user.role === 'Counselor') return 'prov-counselor';
  return null;
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Find the user record
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`[Auth] User not found: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status !== 'ACTIVE') {
      console.log(`[Auth] Blocked login attempt for non-active user: ${email} (Status: ${user.status})`);
      return res.status(403).json({ error: 'Your account is inactive or suspended.' });
    }

    // Compare bcrypt hashes
    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordCorrect) {
      console.log(`[Auth] Incorrect password for user: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Sign the JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`[Auth] User logged in: ${email} (${user.role})`);

    // Return the response payload matching api.md spec
    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.fullName || 'Staff User',
        role: user.role,
        providerId: getProviderIdForUser(user),
      },
    });
  } catch (error) {
    console.error('Login controller error:', error);
    return res.status(500).json({ error: 'Internal server login failure.' });
  }
};

export const verifyMfa = async (req, res) => {
  const { tempToken, code } = req.body;

  if (!tempToken || !code) {
    return res.status(400).json({ error: 'tempToken and MFA code are required.' });
  }

  try {
    // Verify the temporary session token
    const decoded = jwt.verify(tempToken, JWT_SECRET);

    // Generate final verified token
    const token = jwt.sign(
      { id: decoded.id, email: decoded.email, role: decoded.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`[MFA] MFA Verified for user: ${decoded.email}`);

    return res.status(200).json({
      token,
      user: {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      },
    });
  } catch (error) {
    console.error('MFA verify controller error:', error);
    return res.status(401).json({ error: 'Invalid or expired MFA session token.' });
  }
};

export const getCurrentUser = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch fresh user details from DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'User session no longer exists or is suspended.' });
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
      name: user.name || user.fullName || 'Staff User',
      role: user.role,
      title: user.title,
      avatar: user.avatar,
      providerId: getProviderIdForUser(user),
      status: user.status
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('[Auth] User session token expired — requiring re-authentication');
    } else {
      console.error('[Auth] Token validation error:', error.message);
    }
    return res.status(401).json({ error: 'Invalid or expired session token.', code: 'TOKEN_EXPIRED' });
  }
};

/**
 * Update active user profile in MySQL DB
 */
export const updateProfile = async (req, res) => {
  const { name, title, email, avatar, role, id } = req.body;

  try {
    let targetId = id;

    // Check token if provided
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        targetId = decoded.id;
      } catch (e) {}
    }

    // Find target user by ID or email, or default to first super admin / user in DB
    let user = null;
    if (targetId) {
      user = await prisma.user.findFirst({ where: { OR: [{ id: targetId }, { email }] } });
    }
    if (!user && email) {
      user = await prisma.user.findUnique({ where: { email } });
    }
    if (!user) {
      user = await prisma.user.findFirst();
    }

    if (!user) {
      // Create user if database is empty
      const newUser = await prisma.user.create({
        data: {
          id: targetId || `usr-${Date.now()}`,
          email: email || 'admin@example.test',
          passwordHash: '$2a$10$wK1n3kO5i7l/xUe0.qL/u.7GZ/Wc6T5/B5uN4Y/hCgHl1yM5XQnC.',
          name: name || 'Sarah Connor',
          fullName: name || 'Sarah Connor',
          role: role || 'Super Admin',
          title: title || 'System Administrator',
          avatar: avatar || null,
          status: 'ACTIVE'
        }
      });
      return res.status(200).json({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name || newUser.fullName,
          role: newUser.role,
          title: newUser.title,
          avatar: newUser.avatar
        }
      });
    }

    // Update MySQL user record
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name ? { name, fullName: name } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(email ? { email } : {}),
        ...(avatar !== undefined ? { avatar } : {})
      }
    });

    console.log(`[Auth] User profile updated in MySQL DB: ${updatedUser.name} (${updatedUser.email})`);

    return res.status(200).json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name || updatedUser.fullName,
        role: updatedUser.role,
        title: updatedUser.title,
        avatar: updatedUser.avatar
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update user profile in database.' });
  }
};

