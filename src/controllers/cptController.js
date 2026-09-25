import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';

export const getCptCodes = async (req, res) => {
  try {
    const codes = await prisma.cptCode.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.status(200).json(codes);
  } catch (error) {
    logger.error('Error fetching CPT codes:', error);
    res.status(500).json({ error: 'Failed to fetch CPT codes' });
  }
};

export const createCptCode = async (req, res) => {
  const { code, description, fee, category, modifiers } = req.body;

  if (!code || !description) {
    return res.status(400).json({ error: 'Code and description are required' });
  }

  try {
    const newCode = await prisma.cptCode.create({
      data: {
        code,
        description,
        fee: fee || '',
        category: category || '',
        modifiers: modifiers || '',
      },
    });

    res.status(201).json(newCode);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'CPT Code already exists' });
    }
    logger.error('Error creating CPT code:', error);
    res.status(500).json({ error: 'Failed to create CPT code' });
  }
};

export const updateCptCode = async (req, res) => {
  const { id } = req.params;
  const { code, description, fee, category, modifiers } = req.body;

  try {
    const updated = await prisma.cptCode.update({
      where: { id },
      data: {
        code,
        description,
        fee,
        category,
        modifiers,
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'CPT Code not found' });
    }
    logger.error('Error updating CPT code:', error);
    res.status(500).json({ error: 'Failed to update CPT code' });
  }
};

export const deleteCptCode = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.cptCode.delete({
      where: { id },
    });

    res.status(200).json({ message: 'CPT Code deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'CPT Code not found' });
    }
    logger.error('Error deleting CPT code:', error);
    res.status(500).json({ error: 'Failed to delete CPT code' });
  }
};
