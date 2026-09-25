import { prisma } from '../config/db.js';

// Get all ICD codes
export const getAllICDCodes = async (req, res) => {
  try {
    const codes = await prisma.iCDCode.findMany({
      orderBy: { code: 'asc' },
    });
    res.status(200).json(codes);
  } catch (error) {
    console.error('Error fetching ICD codes:', error);
    res.status(500).json({ error: 'Failed to fetch ICD codes' });
  }
};

// Create a new ICD code
export const createICDCode = async (req, res) => {
  const { code, description, category } = req.body;
  if (!code || !description) {
    return res.status(400).json({ error: 'Code and description are required' });
  }

  try {
    const newCode = await prisma.iCDCode.create({
      data: {
        code: code.trim().toUpperCase(),
        description: description.trim(),
        category: category?.trim() || 'General',
      },
    });
    res.status(201).json(newCode);
  } catch (error) {
    console.error('Error creating ICD code:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'ICD code already exists' });
    }
    res.status(500).json({ error: 'Failed to create ICD code' });
  }
};

// Update an existing ICD code
export const updateICDCode = async (req, res) => {
  const { id } = req.params;
  const { code, description, category } = req.body;

  try {
    const updatedCode = await prisma.iCDCode.update({
      where: { id },
      data: {
        ...(code && { code: code.trim().toUpperCase() }),
        ...(description && { description: description.trim() }),
        ...(category && { category: category.trim() }),
      },
    });
    res.status(200).json(updatedCode);
  } catch (error) {
    console.error('Error updating ICD code:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'ICD code not found' });
    }
    res.status(500).json({ error: 'Failed to update ICD code' });
  }
};

// Delete an ICD code
export const deleteICDCode = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.iCDCode.delete({
      where: { id },
    });
    res.status(200).json({ message: 'ICD code deleted successfully' });
  } catch (error) {
    console.error('Error deleting ICD code:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'ICD code not found' });
    }
    res.status(500).json({ error: 'Failed to delete ICD code' });
  }
};
