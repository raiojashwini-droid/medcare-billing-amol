import { prisma } from '../config/db.js';

/**
 * Format a DB ClinicalNote record to match frontend expectations
 */
const formatNote = (n) => {
  if (!n) return null;
  return {
    id: n.id,
    patientId: n.patientId,
    patientName: n.patient ? `${n.patient.firstName} ${n.patient.lastName}`.trim() : 'Unknown Patient',
    selectedInjuryAreas: n.patient?.selectedInjuryAreas || [],
    caseId: n.caseId,
    providerId: n.providerId,
    providerName: n.provider?.name || 'Unknown Provider',
    type: n.noteType,
    noteType: n.noteType,
    title: n.title,
    date: n.date,
    status: n.status,
    author: n.author,
    signedBy: n.signedBy,
    signedAt: n.signedAt,
    signatureUrl: n.signatureUrl,
    soapSubjective: n.soapSubjective || '',
    soapObjective: n.soapObjective || '',
    soapAssessment: n.soapAssessment || '',
    soapPlan: n.soapPlan || '',
    anatomicalDiagramData: n.anatomicalDiagramData || '',
    content: typeof n.content === 'string' ? JSON.parse(n.content) : n.content || {},
    addendums: typeof n.addendums === 'string' ? JSON.parse(n.addendums) : n.addendums || [],
    createdAt: n.createdAt
  };
};

/**
 * Get clinical notes list with optional filters
 */
export const getNotes = async (req, res) => {
  const { patientId, providerId, status, caseId, type } = req.query;

  try {
    const where = {};
    if (patientId) where.patientId = patientId;
    if (providerId) where.providerId = providerId;
    if (status) where.status = status;
    if (caseId) where.caseId = caseId;
    if (type) where.noteType = type;

    const notes = await prisma.clinicalNote.findMany({
      where,
      include: {
        patient: { select: { firstName: true, lastName: true, selectedInjuryAreas: true } },
        provider: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(notes.map(formatNote));
  } catch (error) {
    console.error('Error fetching clinical notes:', error);
    return res.status(500).json({ error: 'Internal server error fetching notes.' });
  }
};

/**
 * Get clinical note by ID
 */
export const getNoteById = async (req, res) => {
  const { id } = req.params;

  try {
    const note = await prisma.clinicalNote.findUnique({
      where: { id },
      include: {
        patient: { select: { firstName: true, lastName: true, selectedInjuryAreas: true } },
        provider: { select: { name: true } }
      }
    });

    if (!note) {
      return res.status(404).json({ error: 'Clinical note not found.' });
    }

    return res.status(200).json(formatNote(note));
  } catch (error) {
    console.error('Error fetching note by ID:', error);
    return res.status(500).json({ error: 'Failed to retrieve clinical note.' });
  }
};

/**
 * Create clinical note draft
 */
export const createNote = async (req, res) => {
  const data = req.body;

  if (!data.patientId) {
    return res.status(400).json({ error: 'patientId is required.' });
  }

  const generatedId = `note-${Date.now()}`;
  const currentDateStr = new Date().toLocaleDateString('en-US');

  try {
    // 1. Verify patient exists or find by patientId
    let patient = await prisma.patient.findFirst({
      where: {
        OR: [{ id: data.patientId }, { patientId: data.patientId }]
      }
    });

    if (!patient) {
      patient = await prisma.patient.findFirst();
    }

    const patientId = patient ? patient.id : data.patientId;

    // 2. Resolve valid case for this patient
    let validCaseId = data.caseId;
    let existingCase = null;

    if (validCaseId) {
      existingCase = await prisma.case.findFirst({
        where: {
          OR: [{ id: validCaseId }, { caseId: validCaseId }]
        }
      });
    }

    if (!existingCase && patientId) {
      existingCase = await prisma.case.findFirst({
        where: { patientId }
      });
    }

    if (!existingCase && patientId) {
      const generatedCaseId = `case-${Date.now()}`;
      existingCase = await prisma.case.create({
        data: {
          id: generatedCaseId,
          caseId: `CASE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          patientId: patientId,
          accidentDate: new Date().toISOString().split('T')[0],
          accidentType: 'Motor Vehicle Collision',
          accidentState: 'TX',
          status: 'ACTIVE'
        }
      });
    }

    validCaseId = existingCase ? existingCase.id : 'case-001';

    // 3. Resolve provider
    let providerId = data.providerId || 'prov-josmic';
    const existingProvider = await prisma.provider.findUnique({
      where: { id: providerId }
    });
    if (!existingProvider) {
      const newProv = await prisma.provider.create({
        data: {
          id: providerId,
          name: data.providerName || 'New Practice Provider',
          businessName: 'F&M Health & Wellness',
          status: 'ACTIVE',
          isPlaceholder: true
        }
      });
      providerId = newProv.id;
    }

    const noteType = data.type || data.noteType || 'JOSMIC_PAIN';

    // If saving an AI_DOCTOR_NOTE, update existing note for this case if present
    if (noteType === 'AI_DOCTOR_NOTE' && validCaseId) {
      const existingDocNote = await prisma.clinicalNote.findFirst({
        where: {
          caseId: validCaseId,
          noteType: 'AI_DOCTOR_NOTE'
        }
      });

      if (existingDocNote) {
        const updated = await prisma.clinicalNote.update({
          where: { id: existingDocNote.id },
          data: {
            title: data.title || existingDocNote.title,
            status: data.status || existingDocNote.status,
            author: data.author || existingDocNote.author,
            soapSubjective: data.soapSubjective || (data.content?.presentingConcerns || ''),
            soapObjective: data.soapObjective || (data.content?.objectiveExam || ''),
            soapAssessment: data.soapAssessment || (data.content?.diagnosticImpression || ''),
            soapPlan: data.soapPlan || (data.content?.treatmentPlan || ''),
            content: data.content || existingDocNote.content
          },
          include: {
            patient: { select: { firstName: true, lastName: true, selectedInjuryAreas: true } },
            provider: { select: { name: true } }
          }
        });
        return res.status(200).json(formatNote(updated));
      }
    }

    const newNote = await prisma.clinicalNote.create({
      data: {
        id: generatedId,
        patientId: patientId,
        caseId: validCaseId,
        providerId: providerId,
        noteType: noteType,
        title: data.title || 'Clinical Evaluation Note',
        date: data.date || currentDateStr,
        status: data.status || 'DRAFT',
        author: data.author || 'Attending Clinician',
        soapSubjective: data.soapSubjective || (data.content?.['Subjective (HPI)'] || ''),
        soapObjective: data.soapObjective || (data.content?.['Objective Findings'] || ''),
        soapAssessment: data.soapAssessment || (data.content?.['Clinical Assessment'] || ''),
        soapPlan: data.soapPlan || (data.content?.['Treatment Plan'] || ''),
        content: data.content || {},
        addendums: []
      },
      include: {
        patient: { select: { firstName: true, lastName: true, selectedInjuryAreas: true } },
        provider: { select: { name: true } }
      }
    });

    return res.status(201).json(formatNote(newNote));
  } catch (error) {
    console.error('Error creating clinical note:', error);
    return res.status(500).json({ error: 'Failed to create clinical note draft.', details: error.message });
  }
};

/**
 * Sign and lock clinical note
 */
export const signNote = async (req, res) => {
  const { id } = req.params;
  const { signatureUrl, authorName } = req.body;

  if (!signatureUrl) {
    return res.status(400).json({ error: 'signatureUrl is required to sign note.' });
  }

  try {
    const existing = await prisma.clinicalNote.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Clinical note not found.' });
    }

    const updated = await prisma.clinicalNote.update({
      where: { id },
      data: {
        status: 'SIGNED_LOCKED',
        signatureUrl,
        signedBy: authorName || 'Authorized Physician',
        signedAt: new Date(),
        author: authorName || existing.author
      },
      include: {
        patient: { select: { firstName: true, lastName: true, selectedInjuryAreas: true } },
        provider: { select: { name: true } }
      }
    });

    return res.status(200).json(formatNote(updated));
  } catch (error) {
    console.error('Error signing clinical note:', error);
    return res.status(500).json({ error: 'Failed to sign clinical note.' });
  }
};

/**
 * Amend note adding addendums
 */
export const amendNote = async (req, res) => {
  const { id } = req.params;
  const { addendumText, authorName } = req.body;

  if (!addendumText) {
    return res.status(400).json({ error: 'addendumText is required to amend note.' });
  }

  try {
    const existing = await prisma.clinicalNote.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Clinical note not found.' });
    }

    const currentAddendums = typeof existing.addendums === 'string' 
      ? JSON.parse(existing.addendums) 
      : existing.addendums || [];

    const newAddendum = {
      id: `addendum-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      author: authorName || 'Clinician',
      text: addendumText
    };

    const updated = await prisma.clinicalNote.update({
      where: { id },
      data: {
        status: 'AMENDED',
        addendums: [...currentAddendums, newAddendum]
      },
      include: {
        patient: { select: { firstName: true, lastName: true, selectedInjuryAreas: true } },
        provider: { select: { name: true } }
      }
    });

    return res.status(200).json(formatNote(updated));
  } catch (error) {
    console.error('Error amending clinical note:', error);
    return res.status(500).json({ error: 'Failed to amend clinical note.' });
  }
};

/**
 * Generate AI SOAP suggested text drafts (Supports Live Gemini API, Groq, or Smart Clinical Template Engine)
 */
export const generateAiDraft = async (req, res) => {
  const { promptType, inputData } = req.body;

  if (!promptType) {
    return res.status(400).json({ error: 'promptType is required.' });
  }

  const patientName = inputData?.patientName || 'Demo Patient 001';
  const complaints = inputData?.complaints || 'neck and low back stiffness following auto accident on 12/27/2025';
  const locations = Array.isArray(inputData?.painLocations) ? inputData.painLocations.join(', ') : 'Neck, Lower Back';

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  // Build prompt for live AI
  let aiPrompt = '';
  if (promptType === 'DOCTOR_NOTE') {
    aiPrompt = `You are a clinical documentation assistant for a personal injury and multi-specialty medical practice.
Your task is to compile and synthesize the provided patient clinical documentation into a structured Doctor's Note / Clinical Summary draft.

CRITICAL CLINICAL RULES:
1. Summarize and organize documented facts ONLY.
2. DO NOT fabricate or invent diagnoses, symptoms, treatments, dates, findings, medications, or other clinical facts not supported by the provided documentation.
3. If information for any section is not documented in the provided sources, explicitly state: "Information not documented in selected records." Do NOT invent filler data.
4. Organize the note using the following exact standard sections:
   1. PRESENTING CONCERNS & CHIEF COMPLAINT
   2. SUBJECTIVE HISTORY & PAIN QUALITY
   3. OBJECTIVE & PHYSICAL EXAMINATION FINDINGS
   4. CLINICAL ASSESSMENT & DIAGNOSTIC IMPRESSION
   5. TREATMENT & PROCEDURES ADMINISTERED
   6. COURSE OF CARE & CLINICAL PROGRESS
   7. TREATMENT PLAN & THERAPEUTIC GOALS
   8. FOLLOW-UP & DISCHARGE RECOMMENDATIONS / PROGNOSIS

PATIENT / CASE DEMOGRAPHICS:
- Patient Name: ${patientName}
- Date of Service / Review: ${inputData?.dos || 'Current'}
- Accident / Injury Context: ${complaints}
- Injury Locations: ${locations}
- Referring / Attending Provider: ${inputData?.providerName || 'Attending Physician'}

COMPILED SOURCE CLINICAL DOCUMENTATION:
${inputData?.compiledDocumentation || 'No additional records provided.'}

Generate a clear, professional, structured clinical note adhering strictly to the facts above.`;
  } else {
    aiPrompt = `You are an expert clinical medical documentation AI assistant for a US accident & personal injury medical practice. 
Generate a professional, medically precise, structured ${promptType} clinical note draft for an attending physician to review.
Patient Name: ${patientName}
Chief Complaint & Accident Context: ${complaints}
Pain Locations: ${locations}
Section to Generate: ${promptType} (HPI / Physical Exam Summary / Assessment & Plan / Clinical Progress Narrative).
Provide clean, concise medical prose with standard medical terminology and ICD-10 diagnostic implications. Output only the note content.`;
  }

  // 1. If user provided a free Google Gemini API Key:
  if (geminiApiKey) {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: aiPrompt }] }]
        })
      });

      if (response.ok) {
        const json = await response.json();
        const aiText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText) {
          return res.status(200).json({
            draftText: aiText.trim(),
            model: 'Google Gemini 2.5 Flash (Live AI Active)',
            disclaimer: 'AI-generated content is a draft and must be reviewed and approved by an authorized healthcare provider.',
            generatedAt: new Date().toLocaleTimeString()
          });
        }
      }
    } catch (err) {
      console.warn('Live Gemini API call failed, using built-in clinical generator:', err.message);
    }
  }

  // 2. If user provided a free Groq API Key:
  if (groqApiKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: aiPrompt }]
        })
      });

      if (response.ok) {
        const json = await response.json();
        const aiText = json?.choices?.[0]?.message?.content;
        if (aiText) {
          return res.status(200).json({
            draftText: aiText.trim(),
            model: 'Groq Llama-3.3-70B (Live Free AI)',
            disclaimer: 'AI-generated content is a draft and must be reviewed and approved by an authorized healthcare provider.',
            generatedAt: new Date().toLocaleTimeString()
          });
        }
      }
    } catch (err) {
      console.warn('Live Groq API call failed, using built-in clinical generator:', err.message);
    }
  }

  // 3. High-Quality Built-in Clinical Medical Generator (Works instantly with 0 keys needed!)
  let draftText = '';

  if (promptType === 'DOCTOR_NOTE') {
    const compiled = inputData?.compiledDocumentation || '';
    const diag = inputData?.diagnosisCodes ? (Array.isArray(inputData.diagnosisCodes) ? inputData.diagnosisCodes.join(', ') : inputData.diagnosisCodes) : '';
    const sessions = inputData?.totalSessions || inputData?.sessionsCount || '';
    const procedures = inputData?.proceduresList || '';

    // Extract actual documented section text if present in compiled source text
    const extractSection = (regex) => {
      const m = compiled.match(regex);
      return m && m[1] ? m[1].trim() : '';
    };

    const documentedExam = inputData?.examFindings || extractSection(/(?:objective|exam|reexamFindings|physicalExam)[:\s]+([^\n\r]+)/i);
    const documentedProgress = inputData?.progressSummary || extractSection(/(?:progress|outcome|courseOfCare|progressNotes)[:\s]+([^\n\r]+)/i);
    const documentedPlan = inputData?.treatmentPlan || extractSection(/(?:treatmentPlan|goals|futureCare|planFollowUp)[:\s]+([^\n\r]+)/i);
    const documentedFollowUp = inputData?.followUp || extractSection(/(?:followUp|dischargeRecommendations|recommendations)[:\s]+([^\n\r]+)/i);

    draftText = `1. PRESENTING CONCERNS & CHIEF COMPLAINT:
${inputData?.chiefComplaint || (complaints ? `Patient presents following reported injury: ${complaints}.` : 'Information not documented in selected records.')}

2. SUBJECTIVE HISTORY & PAIN QUALITY:
${inputData?.painDescription || (locations ? `Symptoms localized to ${locations}.` : 'Information not documented in selected records.')}

3. OBJECTIVE & PHYSICAL EXAMINATION FINDINGS:
${documentedExam || 'Information not documented in selected records.'}

4. CLINICAL ASSESSMENT & DIAGNOSTIC IMPRESSION:
${diag ? `Clinical diagnoses documented: ${diag}` : 'Information not documented in selected records.'}

5. TREATMENT & PROCEDURES ADMINISTERED:
${procedures || (sessions ? `Completed ${sessions} documented treatment session(s) targeting affected anatomical regions.` : 'Information not documented in selected records.')}

6. COURSE OF CARE & CLINICAL PROGRESS:
${documentedProgress || 'Information not documented in selected records.'}

7. TREATMENT PLAN & THERAPEUTIC GOALS:
${documentedPlan || 'Information not documented in selected records.'}

8. FOLLOW-UP & DISCHARGE RECOMMENDATIONS / PROGNOSIS:
${documentedFollowUp || 'Information not documented in selected records.'}`;
  } else if (promptType === 'HPI') {
    draftText = complaints
      ? `HISTORY OF PRESENT ILLNESS:\nPatient presents for evaluation regarding documented injury: ${complaints}.${locations ? ` Symptoms documented in: ${locations}.` : ''}`
      : 'Information not documented in selected records.';
  } else if (promptType === 'EXAM') {
    draftText = inputData?.examFindings
      ? `PHYSICAL EXAMINATION SUMMARY:\n${inputData.examFindings}`
      : 'Information not documented in selected records.';
  } else if (promptType === 'ASSESSMENT') {
    draftText = diag
      ? `CLINICAL ASSESSMENT:\nDocumented diagnoses: ${diag}`
      : 'Information not documented in selected records.';
  } else {
    draftText = inputData?.summary || (complaints
      ? `CLINICAL SUMMARY:\nPatient evaluation for documented injury (${complaints}).`
      : 'Information not documented in selected records.');
  }

  return res.status(200).json({
    draftText,
    model: 'MedCare Clinical AI Engine (Built-in)',
    disclaimer: 'AI-generated content is a draft and must be reviewed and approved by an authorized healthcare provider.',
    generatedAt: new Date().toLocaleTimeString()
  });
};

/**
 * Delete clinical note by ID
 */
export const deleteNote = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.clinicalNote.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Clinical note not found.' });
    }

    await prisma.clinicalNote.delete({
      where: { id }
    });

    return res.status(200).json({ message: 'Clinical note deleted successfully.' });
  } catch (error) {
    console.error('Error deleting clinical note:', error);
    return res.status(500).json({ error: 'Failed to delete clinical note.' });
  }
};

