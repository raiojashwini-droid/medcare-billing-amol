import { prisma } from '../config/db.js';
import { generateMasterPacket } from '../services/pdfService.js';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Format document matching frontend expectations
 */
const formatDoc = (d) => {
  if (!d) return null;
  const statusClean = (d.status || 'UPLOADED').replace('_DEMO', '');
  return {
    id: d.id,
    caseId: d.caseId,
    name: d.name,
    type: d.documentType || d.type || 'Other',
    documentType: d.documentType || d.type || 'Other',
    providerName: d.providerName || '',
    date: d.date || '',
    status: statusClean,
    size: d.size || '1.0 MB',
    url: d.url || '',
    uploadedAt: d.uploadedAt
  };
};

/**
 * Get documents list
 */
export const getDocuments = async (req, res) => {
  const { providerName, type, caseId } = req.query;

  try {
    const where = {};
    if (caseId) where.caseId = caseId;
    if (providerName) where.providerName = providerName;
    if (type) {
      where.OR = [
        { type },
        { documentType: type }
      ];
    }

    const docs = await prisma.document.findMany({
      where,
      orderBy: { uploadedAt: 'desc' }
    });

    return res.status(200).json(docs.map(formatDoc));
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).json({ error: 'Internal server error retrieving documents.' });
  }
};

/**
 * Upload/Register document metadata
 */
export const uploadDocument = async (req, res) => {
  const data = req.body;

  if (!data.name) {
    return res.status(400).json({ error: 'name is required.' });
  }

  const generatedId = `doc-${Date.now()}`;
  const currentDateStr = new Date().toLocaleDateString('en-US');
  let targetCaseId = data.caseId || 'case-001';

  try {
    // Ensure valid case exists in DB to prevent foreign key errors
    const matchedCase = await prisma.case.findFirst({
      where: {
        OR: [
          { id: targetCaseId }
        ]
      }
    });

    if (matchedCase) {
      targetCaseId = matchedCase.id;
    } else {
      const defaultCase = await prisma.case.findFirst();
      if (defaultCase) targetCaseId = defaultCase.id;
    }

    let finalUrl = data.url || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

    // If frontend sent a base64 string, upload it to Cloudinary from the backend
    if (data.base64File) {
      const uploadRes = await cloudinary.uploader.upload(data.base64File, {
        resource_type: 'auto',
        folder: 'medcare_docs'
      });
      finalUrl = uploadRes.secure_url;
    }

    const newDoc = await prisma.document.create({
      data: {
        id: generatedId,
        caseId: targetCaseId,
        name: data.name,
        documentType: data.documentType || data.type || 'Medical Records',
        type: data.type || data.documentType || 'Medical Records',
        providerName: data.providerName || 'JOSMIC Wellness Center',
        date: data.date || currentDateStr,
        status: data.status || 'UPLOADED',
        size: data.size || '1.2 MB',
        url: finalUrl
      }
    });

    return res.status(201).json(formatDoc(newDoc));
  } catch (error) {
    console.error('Error saving document details:', error);
    return res.status(500).json({ error: 'Failed to upload document.' });
  }
};

/**
 * Delete document by ID
 */
export const deleteDocument = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.document.delete({
      where: { id }
    });
    return res.status(200).json({ success: true, message: 'Document deleted successfully.' });
  } catch (error) {
    console.error('Error deleting document:', error);
    return res.status(500).json({ error: 'Failed to delete document.' });
  }
};

/**
 * Bundle patient document packet
 */
export const buildPatientPacket = async (req, res) => {
  const { selectedDocIds, caseId } = req.body;

  if (!Array.isArray(selectedDocIds) || !caseId) {
    return res.status(400).json({ error: 'selectedDocIds (array) and caseId are required.' });
  }

  try {
    // Fetch case information
    const caseInfo = await prisma.case.findUnique({
      where: { id: caseId },
      include: { patient: true }
    });

    // Fetch document metadata
    const documents = await prisma.document.findMany({
      where: {
        id: { in: selectedDocIds }
      }
    });

    // Generate the PDF packet
    const pdfBuffer = await generateMasterPacket(caseInfo, documents);

    // Send the generated PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Master_Legal_Packet_${caseId}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error building patient packet:', error);
    return res.status(500).json({ error: 'Failed to build patient packet.' });
  }
};
