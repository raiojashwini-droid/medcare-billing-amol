import { prisma } from '../config/db.js';

export const getAllModalities = async (req, res) => {
  try {
    const modalities = await prisma.serviceModality.findMany({
      orderBy: { createdAt: 'asc' },
    });
    
    // Dynamically strip (Confirmed) and (Pending) if they exist in the DB
    const cleanedModalities = modalities.map(mod => {
      if (mod.cptCode) {
        mod.cptCode = mod.cptCode.replace(' (Confirmed)', '').replace(' (Pending)', '');
      }
      return mod;
    });
    
    res.status(200).json(cleanedModalities);
  } catch (error) {
    console.error('Error fetching modalities:', error);
    res.status(500).json({ error: 'Failed to fetch modalities' });
  }
};

export const createModality = async (req, res) => {
  const { name, providerId, enabled, cptCode, fee, duration, template, status } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const newModality = await prisma.serviceModality.create({
      data: {
        name,
        providerId: providerId || null,
        enabled: enabled || false,
        cptCode: cptCode || '',
        fee: fee || '',
        duration: duration || '',
        template: template || '',
        status: status || 'ACTIVE',
      },
    });
    res.status(201).json(newModality);
  } catch (error) {
    console.error('Error creating modality:', error);
    res.status(500).json({ error: 'Failed to create modality' });
  }
};

export const updateModality = async (req, res) => {
  const { id } = req.params;
  const { name, providerId, enabled, cptCode, fee, duration, template, status } = req.body;

  try {
    const data = {};
    if (name !== undefined) data.name = name;
    if (providerId !== undefined) data.providerId = providerId || null;
    if (enabled !== undefined) data.enabled = enabled;
    if (cptCode !== undefined) data.cptCode = cptCode;
    if (fee !== undefined) data.fee = fee;
    if (duration !== undefined) data.duration = duration;
    if (template !== undefined) data.template = template;
    if (status !== undefined) data.status = status;

    const updatedModality = await prisma.serviceModality.update({
      where: { id },
      data,
    });
    res.status(200).json(updatedModality);
  } catch (error) {
    console.error('Error updating modality:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Modality not found' });
    }
    res.status(500).json({ error: 'Failed to update modality' });
  }
};

export const deleteModality = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.serviceModality.delete({
      where: { id },
    });
    res.status(200).json({ message: 'Modality deleted successfully' });
  } catch (error) {
    console.error('Error deleting modality:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Modality not found' });
    }
    res.status(500).json({ error: 'Failed to delete modality' });
  }
};
