import PDFDocument from 'pdfkit';
import { PDFDocument as PDFLibDoc } from 'pdf-lib';

/**
 * Helper to generate the Cover Page Buffer using pdfkit
 */
const generateCoverPage = (caseInfo, documents) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);

      // Cover Page
      doc.fontSize(24).text('Master Medical-Legal Packet', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(2);

      // Case Information
      doc.fontSize(18).text('Case Details', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      
      const pName = caseInfo?.patient?.firstName ? `${caseInfo.patient.firstName} ${caseInfo.patient.lastName}` : (caseInfo?.patientName || 'Demo Patient 001');
      const caseNumber = caseInfo?.caseId || caseInfo?.id || 'CASE-001';
      
      doc.text(`Patient Name: ${pName}`);
      doc.text(`Case ID: ${caseNumber}`);
      if (caseInfo?.accidentDate) doc.text(`Accident Date: ${caseInfo.accidentDate}`);
      if (caseInfo?.accidentLocation) doc.text(`Location: ${caseInfo.accidentLocation}`);
      if (caseInfo?.mechanismOfInjury) doc.text(`Mechanism of Injury: ${caseInfo.mechanismOfInjury}`);
      
      doc.moveDown(2);

      // Document Summary
      doc.fontSize(18).text('Included Documents Summary', { underline: true });
      doc.moveDown(0.5);

      if (!documents || documents.length === 0) {
        doc.fontSize(12).text('No documents selected for this packet.', { italic: true });
      } else {
        documents.forEach((d, i) => {
          doc.fontSize(12).font('Helvetica-Bold').text(`${i + 1}. ${d.name || 'Unknown Document'}`);
          doc.font('Helvetica').text(`    Provider: ${d.providerName || 'N/A'}`);
          doc.text(`    Type: ${d.type || d.documentType || 'N/A'}`);
          doc.text(`    Date: ${d.date || 'N/A'}`);
          doc.moveDown(0.5);
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate a Medical-Legal Packet PDF by merging real PDFs
 */
export const generateMasterPacket = async (caseInfo, documents) => {
  try {
    // 1. Generate Cover Page
    const coverPageBuffer = await generateCoverPage(caseInfo, documents);
    
    // 2. Load Cover Page into pdf-lib
    const masterPdf = await PDFLibDoc.load(coverPageBuffer);
    
    // 3. Fetch and merge all real documents
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        if (!doc.url || doc.url === '#' || doc.url.includes('dummy.pdf')) {
          console.warn(`Skipping document ${doc.name} due to invalid URL: ${doc.url}`);
          continue;
        }
        
        try {
          const res = await fetch(doc.url);
          if (!res.ok) {
            console.error(`Failed to fetch ${doc.name} from ${doc.url}. Status: ${res.status}`);
            continue;
          }
          
          const arrayBuffer = await res.arrayBuffer();
          const extPdf = await PDFLibDoc.load(arrayBuffer);
          const copiedPages = await masterPdf.copyPages(extPdf, extPdf.getPageIndices());
          copiedPages.forEach((page) => masterPdf.addPage(page));
        } catch (fetchErr) {
          console.error(`Failed to merge document ${doc.name}:`, fetchErr);
        }
      }
    }
    
    // 4. Save and return
    const finalPdfBytes = await masterPdf.save();
    return Buffer.from(finalPdfBytes);
  } catch (error) {
    console.error('Error generating master packet:', error);
    throw error;
  }
};
