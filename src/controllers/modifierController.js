import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';

export const getModifiers = async (req, res) => {
  try {
    const modifiers = await prisma.modifier.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.status(200).json(modifiers);
  } catch (error) {
    logger.error('Error fetching modifiers:', error);
    res.status(500).json({ error: 'Failed to fetch modifiers' });
  }
};

export const createModifier = async (req, res) => {
  const { code, description } = req.body;

  if (!code || !description) {
    return res.status(400).json({ error: 'Code and description are required' });
  }

  try {
    const newModifier = await prisma.modifier.create({
      data: {
        code,
        description,
      },
    });

    res.status(201).json(newModifier);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Modifier already exists' });
    }
    logger.error('Error creating modifier:', error);
    res.status(500).json({ error: 'Failed to create modifier' });
  }
};

export const updateModifier = async (req, res) => {
  const { id } = req.params;
  const { code, description } = req.body;

  try {
    const updated = await prisma.modifier.update({
      where: { id },
      data: {
        code,
        description,
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Modifier not found' });
    }
    logger.error('Error updating modifier:', error);
    res.status(500).json({ error: 'Failed to update modifier' });
  }
};

export const deleteModifier = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.modifier.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Modifier deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Modifier not found' });
    }
    logger.error('Error deleting modifier:', error);
    res.status(500).json({ error: 'Failed to delete modifier' });
  }
};
