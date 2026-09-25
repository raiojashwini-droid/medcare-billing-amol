import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';

export const getHolidays = async (req, res) => {
  try {
    const holidays = await prisma.holiday.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.status(200).json(holidays);
  } catch (error) {
    logger.error('Error fetching holidays:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
};

export const createHoliday = async (req, res) => {
  const { name, type, month, day, nth, dayOfWeek, last } = req.body;

  if (!name || !type || !month) {
    return res.status(400).json({ error: 'Name, type, and month are required' });
  }

  try {
    const newHoliday = await prisma.holiday.create({
      data: {
        name,
        type,
        month: parseInt(month, 10),
        day: day ? parseInt(day, 10) : null,
        nth: nth ? parseInt(nth, 10) : null,
        dayOfWeek: dayOfWeek !== undefined && dayOfWeek !== null ? parseInt(dayOfWeek, 10) : null,
        last: last || false,
      },
    });

    res.status(201).json(newHoliday);
  } catch (error) {
    logger.error('Error creating holiday:', error);
    res.status(500).json({ error: 'Failed to create holiday' });
  }
};

export const updateHoliday = async (req, res) => {
  const { id } = req.params;
  const { name, type, month, day, nth, dayOfWeek, last } = req.body;

  try {
    const updated = await prisma.holiday.update({
      where: { id },
      data: {
        name,
        type,
        month: month ? parseInt(month, 10) : undefined,
        day: day !== undefined ? (day ? parseInt(day, 10) : null) : undefined,
        nth: nth !== undefined ? (nth ? parseInt(nth, 10) : null) : undefined,
        dayOfWeek: dayOfWeek !== undefined ? (dayOfWeek !== null ? parseInt(dayOfWeek, 10) : null) : undefined,
        last: last !== undefined ? last : undefined,
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Holiday not found' });
    }
    logger.error('Error updating holiday:', error);
    res.status(500).json({ error: 'Failed to update holiday' });
  }
};

export const deleteHoliday = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.holiday.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Holiday deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Holiday not found' });
    }
    logger.error('Error deleting holiday:', error);
    res.status(500).json({ error: 'Failed to delete holiday' });
  }
};
