import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';

/**
 * Format DB User matching frontend staff profile schema
 */
const formatStaff = (u) => {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name || u.fullName || 'Staff User',
    role: u.role,
    title: u.title || 'Specialist',
    status: u.status || 'ACTIVE',
    avatar: u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120'
  };
};

/**
 * Get staff registry
 */
export const getStaff = async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json(staff.map(formatStaff));
  } catch (error) {
    console.error('Error fetching staff directory:', error);
    return res.status(500).json({ error: 'Failed to retrieve staff directory.' });
  }
};

/**
 * Register new staff account
 */
export const createStaff = async (req, res) => {
  const data = req.body;

  if (!data.email || !data.role || !data.name) {
    return res.status(400).json({ error: 'email, role, and name are required fields.' });
  }

  const generatedId = `usr-${Date.now()}`;

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password || 'password123', salt);

    const newStaff = await prisma.user.create({
      data: {
        id: generatedId,
        email: data.email,
        passwordHash,
        name: data.name,
        fullName: data.name,
        role: data.role,
        title: data.title || 'Staff Specialist',
        avatar: data.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
        status: data.status || 'ACTIVE'
      }
    });

    return res.status(201).json(formatStaff(newStaff));
  } catch (error) {
    console.error('Error creating staff profile:', error);
    return res.status(500).json({ error: 'Failed to register staff profile.' });
  }
};

/**
 * Update existing staff profile
 */
export const updateStaff = async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    const updateData = {
      ...(data.name ? { name: data.name, fullName: data.name } : {}),
      ...(data.email ? { email: data.email } : {}),
      ...(data.role ? { role: data.role } : {}),
      ...(data.title ? { title: data.title } : {}),
      ...(data.avatar !== undefined ? { avatar: data.avatar } : {}),
      ...(data.status ? { status: data.status } : {})
    };

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(data.password, salt);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData
    });

    return res.status(200).json(formatStaff(updated));
  } catch (error) {
    console.error('Error updating staff member:', error);
    return res.status(500).json({ error: 'Failed to update staff member.' });
  }
};

/**
 * Delete staff member
 */
export const deleteStaff = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.user.delete({
      where: { id }
    });
    return res.status(200).json({ success: true, message: 'Staff member removed from database.' });
  } catch (error) {
    console.error('Error deleting staff member:', error);
    return res.status(500).json({ error: 'Failed to delete staff member.' });
  }
};

