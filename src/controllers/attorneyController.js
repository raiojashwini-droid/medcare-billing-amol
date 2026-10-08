// backend/src/controllers/attorneyController.js
import { prisma } from '../config/db.js';

// Default initial seeded attorneys list
let dynamicAttorneys = [
  {
    id: 'atty-1',
    name: 'OJ Lawal, Esq.',
    firm: 'OJ Law Firm & Associates LLC',
    phone: '713-555-0188',
    email: 'attorney@ojlawfirm.com',
    address: '11711 Bedford St. Suite 01, Houston TX 77031',
    caseManager: 'Maria Gonzalez (713-555-0300)',
    lienAgreementType: 'LETTER_OF_PROTECTION',
    status: 'ACTIVE',
    rating: 'Top Tier Partner'
  },
  {
    id: 'atty-2',
    name: 'Marcus Vance, Esq.',
    firm: 'Law Offices of Marcus Vance',
    phone: '713-555-0219',
    email: 'mvance@vancelaw.com',
    address: '2400 Richmond Ave Suite 300, Houston TX 77098',
    caseManager: 'David Chen (713-555-0220)',
    lienAgreementType: 'LETTER_OF_PROTECTION',
    status: 'ACTIVE',
    rating: 'Preferred'
  },
  {
    id: 'atty-3',
    name: 'Robert Cole, Attorney',
    firm: 'Cole & Partners Injury Law',
    phone: '713-555-0442',
    email: 'rcole@colelaw.com',
    address: '5000 Westheimer Rd Suite 450, Houston TX 77056',
    caseManager: 'Jessica Taylor (713-555-0443)',
    lienAgreementType: 'LETTER_OF_PROTECTION',
    status: 'ACTIVE',
    rating: 'Preferred'
  },
  {
    id: 'atty-4',
    name: 'Sarah Jenkins, Esq.',
    firm: 'Davis & Associates Injury Law Group',
    phone: '713-555-0300',
    email: 'sjenkins@davisinjury.com',
    address: '1001 Fannin St Suite 1200, Houston TX 77002',
    caseManager: 'Carlos Ramos (713-555-0301)',
    lienAgreementType: 'LETTER_OF_PROTECTION',
    status: 'ACTIVE',
    rating: 'Top Tier Partner'
  }
];

/**
 * GET /v1/attorneys
 * Retrieve all registered attorneys & law firms in the clinic network
 */
export const getAttorneys = async (req, res) => {
  try {
    const { search } = req.query;

    // Fetch attorneys from DB
    let attorneys = await prisma.attorney.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    // Seed DB if empty
    if (attorneys.length === 0) {
      console.log('Seeding Attorneys...');
      for (const att of dynamicAttorneys) {
         await prisma.attorney.create({
            data: {
               id: att.id,
               name: att.name,
               firm: att.firm,
               phone: att.phone,
               email: att.email,
               address: att.address,
               caseManager: att.caseManager,
               lienAgreementType: att.lienAgreementType,
               status: att.status,
               rating: att.rating
            }
         });
      }
      attorneys = await prisma.attorney.findMany({ orderBy: { createdAt: 'desc' } });
    }

    // Get active cases to compute live active case counts per attorney
    const cases = await prisma.case.findMany({
      select: { attorneyName: true, lawFirm: true, status: true }
    });

    const enriched = attorneys.map(atty => {
      const matchedCases = cases.filter(c => 
        (c.attorneyName && c.attorneyName.toLowerCase().includes(atty.name.toLowerCase())) ||
        (c.lawFirm && c.lawFirm.toLowerCase().includes(atty.firm.toLowerCase()))
      );
      return {
        ...atty,
        activeCasesCount: matchedCases.length,
        hasLopOnFile: true
      };
    });

    if (search) {
      const q = search.toLowerCase();
      const filtered = enriched.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.firm.toLowerCase().includes(q) ||
        (a.email && a.email.toLowerCase().includes(q)) ||
        (a.phone && a.phone.includes(q))
      );
      return res.status(200).json(filtered);
    }

    return res.status(200).json(enriched);
  } catch (error) {
    console.error('Error fetching attorneys:', error);
    return res.status(500).json({ error: 'Failed to retrieve attorneys list.' });
  }
};

/**
 * POST /v1/attorneys
 * Register a new Attorney / Law Firm in the network
 */
export const createAttorney = async (req, res) => {
  try {
    const { name, firm, phone, email, address, caseManager, lienAgreementType } = req.body;

    if (!name || !firm) {
      return res.status(400).json({ error: 'Attorney Name and Law Firm Name are required.' });
    }

    const newAttorney = await prisma.attorney.create({
      data: {
        name: name.trim(),
        firm: firm.trim(),
        phone: phone || '',
        email: email || '',
        address: address || 'Houston, TX',
        caseManager: caseManager || '',
        lienAgreementType: lienAgreementType || 'LETTER_OF_PROTECTION',
        status: 'ACTIVE',
        rating: 'New Network Partner'
      }
    });

    console.log(`⚖️ [NEW ATTORNEY REGISTERED] ${newAttorney.name} (${newAttorney.firm})`);

    return res.status(201).json({ ...newAttorney, activeCasesCount: 0, hasLopOnFile: true });
  } catch (error) {
    console.error('Error creating attorney:', error);
    return res.status(500).json({ error: 'Failed to register new attorney.' });
  }
};

/**
 * PUT /v1/attorneys/:id
 * Update an existing attorney's contact / firm details
 */
export const updateAttorney = async (req, res) => {
  try {
    const { id } = req.params;
    
    const updated = await prisma.attorney.update({
      where: { id },
      data: req.body
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating attorney:', error);
    return res.status(500).json({ error: 'Failed to update attorney record.' });
  }
};
