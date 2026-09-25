import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environmental parameters
dotenv.config();

const connectionString = process.env.DATABASE_URL;

// Parse MySQL/MariaDB URL details: mysql://user:password@host:port/database
const parseConnectionString = (url) => {
  if (!url) {
    throw new Error('DATABASE_URL connection string is missing.');
  }

  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 3306,
      user: parsed.username || 'root',
      password: decodeURIComponent(parsed.password) || '',
      database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'medcare_billing',
    };
  } catch (error) {
    console.error('DATABASE_URL parsing error:', error);
    return {
      host: 'localhost',
      port: 3307,
      user: 'root',
      password: '',
      database: 'medcare_billing',
    };
  }
};

const dbConfig = parseConnectionString(connectionString);

// Initialize the Prisma MariaDB adapter for seeding
const adapter = new PrismaMariaDb({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  connectionLimit: 1,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clear existing records to allow re-runs
  await prisma.user.deleteMany({});
  await prisma.provider.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.case.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.clinicalNote.deleteMany({});
  await prisma.bill.deleteMany({});
  await prisma.serviceLine.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.reminderSetting.deleteMany({});
  await prisma.reminderLog.deleteMany({});

  console.log('🧹 Cleared existing database tables.');

  // 2. Hash default password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  // 3. Create demo users
  const usersData = [
    {
      id: 'usr-sa',
      email: 'admin@example.test',
      passwordHash,
      name: 'Sarah Connor',
      role: 'Super Admin',
      title: 'System Administrator',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120',
      status: 'ACTIVE',
    },
    {
      id: 'usr-rec',
      email: 'receptionist@example.test',
      passwordHash,
      name: 'Emily Davis',
      role: 'Receptionist',
      title: 'Front Desk Lead',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=120',
      status: 'ACTIVE',
    },
    {
      id: 'usr-doc',
      email: 'doctor@example.test',
      passwordHash,
      name: 'Dr. Segun Adeoye',
      role: 'Doctor',
      title: 'Attending Physician',
      avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=120',
      status: 'ACTIVE',
    },
    {
      id: 'usr-the',
      email: 'therapist@example.test',
      passwordHash,
      name: 'Alex Rivera',
      role: 'Therapist',
      title: 'Lead ESWT & Laser Therapist',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
      status: 'ACTIVE',
    },
    {
      id: 'usr-cou',
      email: 'counselor@example.test',
      passwordHash,
      name: 'Jordan Miller',
      role: 'Counselor',
      title: 'Mental Health Counselor',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120',
      status: 'ACTIVE',
    },
    {
      id: 'usr-bil',
      email: 'billing@example.test',
      passwordHash,
      name: 'Rachel Green',
      role: 'Billing Staff',
      title: 'Senior Billing Specialist',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120',
      status: 'ACTIVE',
    }
  ];

  for (const user of usersData) {
    await prisma.user.create({ data: user });
  }
  console.log(`👤 Created ${usersData.length} default user profiles.`);

  // 4. Create default providers configuration
  const providersData = [
    {
      id: 'prov-josmic',
      name: 'JOSMIC Wellness Center',
      businessName: 'JOSMIC Wellness Center LLC',
      serviceCategory: 'Pain Management Consultation',
      status: 'ACTIVE',
      address: {
        street: '10101 Harwin Dr.',
        suite: 'Suite 274',
        city: 'Houston',
        state: 'TX',
        zipCode: '77036'
      },
      contact: {
        phone: '713-485-5712',
        cell: '',
        fax: '832-416-1502',
        email: 'contact@josmicwellness.com'
      },
      identifiers: {
        taxId: '993723387',
        npi: '1932847560',
        ssnOrEin: 'EIN'
      },
      renderingProvider: {
        name: 'Adeoye, Segun',
        credentials: 'DC / MD',
        providerId: 'R7637',
        npi: '1932847560'
      },
      serviceFacility: {
        name: 'JOSMIC Wellness Center',
        address: '10101 Harwin Dr, Suite 320, Houston, TX 77036',
        npi: '1932847560'
      },
      billingProvider: {
        name: 'JOSMIC Wellness Center',
        address: '10101 Harwin Dr, Suite 320, Houston, TX 77036',
        phone: '713-485-5712'
      },
      defaultPlaceOfService: '11',
      availableServices: [
        { code: '99204', description: 'Pain Consult', defaultCharge: 1214.00, category: 'Consultation' }
      ],
      availableDiagnoses: [
        { code: 'S13.4', description: 'Cervical sprain/strain' },
        { code: 'S23.3', description: 'Thoracic sprain/strain' },
        { code: 'S33.5', description: 'Lumbar strain' },
        { code: 'M79.1', description: 'Myofascial pain syndrome' }
      ],
      providerServices: [
        {
          providerId: 'prov-josmic',
          serviceId: 'srv-pain-mgmt',
          enabled: true,
          cptCode: '99204',
          price: 1214.00,
          duration: '60 min',
          billingDescription: 'Pain Consult & Evaluation',
          placeOfService: '11',
          clinicalTemplate: 'JOSMIC Pain Evaluation Report',
          configurationStatus: 'COMPLETE'
        }
      ]
    },
    {
      id: 'prov-davs',
      name: "DAV'S Anatomy",
      businessName: "DAV'S Anatomy Shockwave Therapy LLC",
      serviceCategory: 'Shockwave Therapy (ESWT)',
      status: 'ACTIVE',
      address: {
        street: '10101 Harwin Dr.',
        suite: 'Suite 320',
        city: 'Houston',
        state: 'TX',
        zipCode: '77036'
      },
      contact: {
        phone: '713-485-0208',
        cell: '832-815-0959',
        fax: '832-416-1502',
        email: 'Davsanatomy@gmail.com'
      },
      identifiers: {
        taxId: '883049745',
        npi: '1932847561',
        ssnOrEin: 'EIN'
      },
      renderingProvider: {
        name: 'Adeoye, Segun',
        credentials: 'DC',
        providerId: 'R7638',
        npi: '1932847561'
      },
      serviceFacility: {
        name: "DAV'S Anatomy",
        address: '10101 Harwin Dr, Suite 320, Houston, TX 77036',
        npi: '1932847561'
      },
      billingProvider: {
        name: "DAV'S Anatomy",
        address: '10101 Harwin Dr, Houston, TX 77036',
        phone: '832-815-0959'
      },
      defaultPlaceOfService: '10',
      availableServices: [
        { code: '99204', description: 'Initial Visit II', defaultCharge: 250.00, category: 'Evaluation' },
        { code: '0101T', description: 'Shockwave / ESWT', defaultCharge: 1000.00, category: 'Therapy' },
        { code: '10001', description: 'Eye protective glasses', defaultCharge: 50.00, category: 'Supplies' }
      ],
      availableDiagnoses: [
        { code: 'M54.50', description: 'Low back pain' },
        { code: 'M54.2', description: 'Cervicalgia (Neck pain)' }
      ],
      providerServices: [
        {
          providerId: 'prov-davs',
          serviceId: 'srv-shockwave-therapy',
          enabled: true,
          cptCode: '0101T',
          price: 1000.00,
          duration: '30 min',
          billingDescription: 'Shockwave / ESWT Therapy',
          placeOfService: '10',
          clinicalTemplate: "DAV'S ESWT Therapy Record",
          configurationStatus: 'COMPLETE'
        }
      ]
    },
    {
      id: 'prov-anik',
      name: 'ANIK Laser Therapy',
      businessName: 'ANIK Laser Therapy LLC',
      serviceCategory: 'Laser Therapy',
      status: 'ACTIVE',
      address: {
        street: '10101 Harwin Dr.',
        suite: 'Suite 274',
        city: 'Houston',
        state: 'TX',
        zipCode: '77036'
      },
      contact: {
        phone: '713-485-5712',
        cell: '832-815-0959',
        fax: '832-416-1502',
        email: 'Aniklasertherapy@gmail.com'
      },
      identifiers: {
        taxId: '993723387',
        npi: '1932847562',
        ssnOrEin: 'EIN'
      },
      renderingProvider: {
        name: 'Adeoye, Segun',
        credentials: 'DC',
        providerId: 'R7639',
        npi: '1932847562'
      },
      serviceFacility: {
        name: 'ANIK Laser Therapy',
        address: '10101 Harwin Dr, Suite 320, Houston, TX 77036',
        npi: '1932847562'
      },
      billingProvider: {
        name: 'ANIK Laser Therapy',
        address: '10101 Harwin Dr, Suite 274, Houston, TX 77036',
        phone: '832-815-0959'
      },
      defaultPlaceOfService: '11',
      availableServices: [
        { code: '97039', description: 'Laser Therapy', defaultCharge: 2000.00, category: 'Therapy' },
        { code: '10001', description: 'Eye protective glasses', defaultCharge: 50.00, category: 'Supplies' }
      ],
      availableDiagnoses: [
        { code: 'M54.50', description: 'Low back pain' },
        { code: 'M54.2', description: 'Neck pain' }
      ],
      providerServices: [
        {
          providerId: 'prov-anik',
          serviceId: 'srv-laser-therapy',
          enabled: true,
          cptCode: '97039',
          price: 2000.00,
          duration: '45 min',
          billingDescription: 'Laser Therapy Procedure',
          placeOfService: '11',
          clinicalTemplate: 'ANIK Laser Therapy Procedure Form',
          configurationStatus: 'COMPLETE'
        }
      ]
    },
    {
      id: 'prov-counselor',
      name: 'Counselor Practice (Hope Behavioral Health)',
      businessName: 'Hope Behavioral Health & Counseling LLC',
      serviceCategory: 'Counseling & Mental Health',
      status: 'ACTIVE',
      address: { street: '10101 Harwin Dr.', suite: 'Suite 774-C', city: 'Houston', state: 'TX', zipCode: '77036' },
      contact: { phone: '713-555-0188', fax: '832-555-0199', email: 'intake@hopebehavioralhealth.com' },
      identifiers: { taxId: '84-7891234', npi: '1487965213', ssnOrEin: 'EIN' },
      renderingProvider: { name: 'Jordan Miller', credentials: 'LCSW, BCD', providerId: 'R7640', npi: '1487965213' },
      serviceFacility: { name: 'Hope Behavioral Health Clinic', address: '10101 Harwin Dr, Suite 774-C, Houston, TX 77036', npi: '1487965213' },
      billingProvider: { name: 'Hope Behavioral Health LLC', address: '10101 Harwin Dr, Suite 774-C, Houston, TX 77036', phone: '713-555-0188' },
      defaultPlaceOfService: '11',
      availableServices: [
        { code: '90791', description: 'Psychiatric Diagnostic Evaluation', defaultCharge: 350.00, category: 'Evaluation' },
        { code: '90834', description: 'Psychotherapy, 45 minutes', defaultCharge: 180.00, category: 'Therapy' }
      ],
      availableDiagnoses: [
        { code: 'F43.10', description: 'Post-Traumatic Stress Disorder (PTSD)' },
        { code: 'F41.1', description: 'Generalized Anxiety Disorder (GAD)' }
      ],
      providerServices: [
        {
          providerId: 'prov-counselor',
          serviceId: 'srv-counseling',
          enabled: true,
          cptCode: '90834',
          price: 180.00,
          duration: '45 min',
          billingDescription: 'Individual Psychotherapy Session',
          placeOfService: '11',
          clinicalTemplate: 'Behavioral Health Progress Note',
          configurationStatus: 'COMPLETE'
        }
      ]
    },
    {
      id: 'prov-tpi',
      name: 'Trigger Point Injection Practice',
      businessName: 'Trigger Point Injection Practice LLC',
      serviceCategory: 'Trigger Point Injection (TPI)',
      status: 'ACTIVE',
      address: { street: '10101 Harwin Dr.', suite: 'Suite 274', city: 'Houston', state: 'TX', zipCode: '77036' },
      contact: { phone: '713-485-5712', fax: '832-416-1502', email: 'tpi@example.test' },
      identifiers: { taxId: '993723389', npi: '1982347563', ssnOrEin: 'EIN' },
      renderingProvider: { name: 'Adeoye, Segun', credentials: 'DC / MD', providerId: 'R7641', npi: '1982347563' },
      serviceFacility: { name: 'Trigger Point Clinic', address: '10101 Harwin Dr, Suite 320, Houston, TX 77036', npi: '1982347563' },
      billingProvider: { name: 'Trigger Point Practice', address: '10101 Harwin Dr, Suite 320, Houston, TX 77036', phone: '713-485-5712' },
      defaultPlaceOfService: '11',
      availableServices: [
        { code: '20552', description: 'Trigger Point Injection (1-2 muscles)', defaultCharge: 450.00, category: 'Therapy' }
      ],
      availableDiagnoses: [
        { code: 'M79.1', description: 'Myofascial pain syndrome' }
      ],
      providerServices: [
        {
          providerId: 'prov-tpi',
          serviceId: 'srv-trigger-point-proc',
          enabled: true,
          cptCode: '20552',
          price: 450.00,
          duration: '30 min',
          billingDescription: 'Trigger Point Injection Procedure',
          placeOfService: '11',
          clinicalTemplate: 'TPI Procedure Note',
          configurationStatus: 'COMPLETE'
        }
      ]
    },
    {
      id: 'prov-tecar',
      name: 'TECAR Radiofrequency Practice',
      businessName: 'TECAR Radiofrequency LLC',
      serviceCategory: 'TECAR Radiofrequency Therapy',
      status: 'ACTIVE',
      address: { street: '10101 Harwin Dr.', suite: 'Suite 274', city: 'Houston', state: 'TX', zipCode: '77036' },
      contact: { phone: '713-485-5712', fax: '832-416-1502', email: 'tecar@example.test' },
      identifiers: { taxId: '993723390', npi: '1789234560', ssnOrEin: 'EIN' },
      renderingProvider: { name: 'Adeoye, Segun', credentials: 'DC', providerId: 'R7642', npi: '1789234560' },
      serviceFacility: { name: 'TECAR Clinic', address: '10101 Harwin Dr, Suite 320, Houston, TX 77036', npi: '1789234560' },
      billingProvider: { name: 'TECAR Practice', address: '10101 Harwin Dr, Suite 320, Houston, TX 77036', phone: '713-485-5712' },
      defaultPlaceOfService: '11',
      availableServices: [
        { code: '97024', description: 'Diathermy (e.g., microwave)', defaultCharge: 250.00, category: 'Therapy' }
      ],
      availableDiagnoses: [
        { code: 'M54.50', description: 'Low back pain' }
      ],
      providerServices: [
        {
          providerId: 'prov-tecar',
          serviceId: 'srv-tecar-therapy-proc',
          enabled: true,
          cptCode: '97024',
          price: 250.00,
          duration: '30 min',
          billingDescription: 'TECAR Radiofrequency Session',
          placeOfService: '11',
          clinicalTemplate: 'TECAR Therapy Note',
          configurationStatus: 'COMPLETE'
        }
      ]
    }
  ];

  for (const provider of providersData) {
    await prisma.provider.create({ data: provider });
  }
  console.log(`🏥 Created ${providersData.length} default practice providers configs.`);

  // 5. Create default patient data (3 patients)
  const patientsData = [
    {
      id: 'pat-001',
      patientId: '141849159',
      firstName: 'Demo',
      middleName: 'R.',
      lastName: 'Patient 001',
      dob: '1974-10-08',
      sex: 'M',
      phone: '713-555-0199',
      email: 'demopatient001@example.test',
      street: '17650 Carnation Glen Dr',
      suite: '',
      city: 'Richmond',
      state: 'TX',
      zipCode: '77407',
      communicationPref: 'SMS',
      status: 'ACTIVE',
      assignedProviderIds: ['prov-josmic', 'prov-davs', 'prov-anik', 'prov-counselor'],
      consentStatus: 'SIGNED',
      createdAt: '2025-12-28'
    },
    {
      id: 'pat-002',
      patientId: '141849160',
      firstName: 'Jane',
      middleName: 'A.',
      lastName: 'Smith',
      dob: '1985-05-14',
      sex: 'F',
      phone: '832-555-0144',
      email: 'janesmith@example.test',
      street: '1244 Westheimer Rd',
      suite: 'Apt 4B',
      city: 'Houston',
      state: 'TX',
      zipCode: '77006',
      communicationPref: 'EMAIL',
      status: 'ACTIVE',
      assignedProviderIds: ['prov-josmic', 'prov-davs'],
      consentStatus: 'SIGNED',
      createdAt: '2026-01-05'
    },
    {
      id: 'pat-003',
      patientId: '141849161',
      firstName: 'Robert',
      middleName: 'J.',
      lastName: 'Johnson',
      dob: '1990-11-22',
      sex: 'M',
      phone: '281-555-0155',
      email: 'robertjohnson@example.test',
      street: '9820 Richmond Ave',
      suite: 'Suite 100',
      city: 'Houston',
      state: 'TX',
      zipCode: '77042',
      communicationPref: 'SMS',
      status: 'ACTIVE',
      assignedProviderIds: ['prov-josmic', 'prov-counselor'],
      consentStatus: 'SIGNED',
      createdAt: '2026-02-10'
    }
  ];

  for (const patient of patientsData) {
    await prisma.patient.create({ data: patient });
  }
  console.log(`👥 Seeded ${patientsData.length} patient profiles.`);

  // 6. Create default accident case data (3 cases)
  const casesData = [
    {
      id: 'case-001',
      caseId: 'CASE-2025-1227',
      patientId: 'pat-001',
      accidentDate: '2025-12-27',
      initialDate: '2025-12-30',
      dischargeDate: '2026-01-26',
      accidentType: 'AUTO_ACCIDENT',
      accidentState: 'TX',
      mechanismOfInjury: 'Motor Vehicle Accident (Rear-end collision)',
      status: 'ACTIVE',
      attorneyName: 'Sample Attorney (OJ Lawal & Associates)',
      lawFirm: 'OJ Law Firm & Associates',
      attorneyAddress: '11711 Bedford St. Suite 01, Houston, TX 77031',
      attorneyPhone: '713-555-0188',
      insuranceCompany: 'Example Auto Insurance Co.',
      insurancePolicyNumber: 'POL-9928374',
      insuranceClaimNumber: 'CLM-2025-88192',
      referringProviderName: 'Anthony Nguyen',
      referringProviderNpi: '1891726435',
      diagnosisCodes: ['M54.6', 'M54.50', 'S13.4', 'S33.5'],
      assignedProviderIds: ['prov-josmic', 'prov-davs', 'prov-anik', 'prov-counselor']
    },
    {
      id: 'case-002',
      caseId: 'CASE-2026-0105',
      patientId: 'pat-002',
      accidentDate: '2026-01-04',
      initialDate: '2026-01-05',
      dischargeDate: null,
      accidentType: 'SLIP_AND_FALL',
      accidentState: 'TX',
      mechanismOfInjury: 'Slip and fall in commercial grocery store',
      status: 'ACTIVE',
      attorneyName: 'Law Offices of Marcus Vance',
      lawFirm: 'Vance & Associates',
      attorneyAddress: '440 Louisiana St, Houston, TX 77002',
      attorneyPhone: '713-555-0922',
      insuranceCompany: 'Retail Shield Mutual',
      insurancePolicyNumber: 'POL-883712',
      insuranceClaimNumber: 'CLM-2026-00481',
      referringProviderName: 'Sarah Jenkins, MD',
      referringProviderNpi: '1982736450',
      diagnosisCodes: ['M25.562', 'S83.206A'],
      assignedProviderIds: ['prov-josmic', 'prov-davs']
    },
    {
      id: 'case-003',
      caseId: 'CASE-2026-0210',
      patientId: 'pat-003',
      accidentDate: '2026-02-09',
      initialDate: '2026-02-10',
      dischargeDate: null,
      accidentType: 'WORKERS_COMP',
      accidentState: 'TX',
      mechanismOfInjury: 'Heavy lifting at construction warehouse site',
      status: 'ACTIVE',
      attorneyName: 'Robert Cole, Attorney',
      lawFirm: 'Cole Law Firm',
      attorneyAddress: '800 Town and Country Blvd, Houston, TX 77024',
      attorneyPhone: '281-555-0811',
      insuranceCompany: 'Texas Workers Indemnity',
      insurancePolicyNumber: 'POL-554109',
      insuranceClaimNumber: 'CLM-2026-09411',
      referringProviderName: 'David Cho, MD',
      referringProviderNpi: '1762534891',
      diagnosisCodes: ['M54.50', 'S39.012A'],
      assignedProviderIds: ['prov-josmic', 'prov-counselor']
    }
  ];

  for (const caseObj of casesData) {
    await prisma.case.create({ data: caseObj });
  }
  console.log(`💼 Seeded ${casesData.length} patient accident cases.`);

  // 7. Seed Appointments
  const appointmentsData = [];

  for (const apt of appointmentsData) {
    await prisma.appointment.create({ data: apt });
  }
  console.log(`📅 Seeded ${appointmentsData.length} appointments.`);

  // 8. Seed Clinical Notes
  const notesData = [];

  for (const note of notesData) {
    await prisma.clinicalNote.create({ data: note });
  }
  console.log(`📝 Seeded ${notesData.length} clinical documentation reports.`);

  // 9. Seed Bills and Service Lines
  const billsData = [
    {
      id: 'bill-josmic-001',
      caseId: 'case-001',
      providerId: 'prov-josmic',
      invoiceNumber: 'INV-JOS-101',
      statementNumber: '120197',
      statementDate: '2/11/2026',
      billToName: 'OJ LAW FIRM & ASSOCIATES',
      billToAddress: '11711 Bedford St. Suite 01, Houston TX 77031',
      status: 'FINALISED_DEMO',
      totals: { totalCharges: 1214.00, totalPayments: 0, totalAdjustments: 0, balanceDue: 1214.00 },
      aging: { current: 0, past30: 1214.00, past60: 0, past90: 0 }
    },
    {
      id: 'bill-davs-001',
      caseId: 'case-001',
      providerId: 'prov-davs',
      invoiceNumber: 'INV-DAV-102',
      statementNumber: '121559',
      statementDate: '4/13/2026',
      billToName: 'OJ LAWAL REMI ADESHOLA',
      billToAddress: '11711 Bedford St. Suite 1, Houston TX 77031',
      status: 'ISSUED_DEMO',
      totals: { totalCharges: 9870.00, totalPayments: 0, totalAdjustments: 0, balanceDue: 9870.00 },
      aging: { current: 0, past30: 0, past60: 0, past90: 9870.00 }
    },
    {
      id: 'bill-anik-001',
      caseId: 'case-001',
      providerId: 'prov-anik',
      invoiceNumber: 'INV-ANK-103',
      statementNumber: '121560',
      statementDate: '4/13/2026',
      billToName: 'OJ LAWAL REMI ADESHOLA',
      billToAddress: '11711 Bedford St. Suite 1, Houston TX 77031',
      status: 'ISSUED_DEMO',
      totals: { totalCharges: 18920.00, totalPayments: 0, totalAdjustments: 0, balanceDue: 18920.00 },
      aging: { current: 0, past30: 0, past60: 0, past90: 18920.00 }
    },
    {
      id: 'bill-counselor-001',
      caseId: 'case-001',
      providerId: 'prov-counselor',
      invoiceNumber: 'INV-CNS-104',
      statementNumber: '1024-C',
      statementDate: '01/26/2026',
      billToName: 'OJ LAW FIRM & ASSOCIATES',
      billToAddress: '11711 Bedford St. Suite 01, Houston TX 77031',
      status: 'ACTIVE_DEMO',
      totals: { totalCharges: 1140.00, totalPayments: 0, totalAdjustments: 0, balanceDue: 1140.00 },
    },
    {
      id: 'bill-tpi-001',
      caseId: 'case-001',
      providerId: 'prov-tpi',
      invoiceNumber: 'INV-TPI-105',
      statementNumber: '1025-T',
      statementDate: '01/26/2026',
      billToName: 'OJ LAW FIRM & ASSOCIATES',
      billToAddress: '11711 Bedford St. Suite 01, Houston TX 77031',
      status: 'ACTIVE_DEMO',
      totals: { totalCharges: 700.00, totalPayments: 0, totalAdjustments: 0, balanceDue: 700.00 },
      aging: { current: 350.00, past30: 350.00, past60: 0, past90: 0 }
    },
    {
      id: 'bill-tecar-001',
      caseId: 'case-001',
      providerId: 'prov-tecar',
      invoiceNumber: 'INV-TEC-106',
      statementNumber: '1026-C',
      statementDate: '01/26/2026',
      billToName: 'OJ LAW FIRM & ASSOCIATES',
      billToAddress: '11711 Bedford St. Suite 01, Houston TX 77031',
      status: 'ACTIVE_DEMO',
      totals: { totalCharges: 500.00, totalPayments: 0, totalAdjustments: 0, balanceDue: 500.00 },
      aging: { current: 250.00, past30: 250.00, past60: 0, past90: 0 }
    }
  ];

  for (const b of billsData) {
    await prisma.bill.create({ data: b });
  }
  console.log(`💵 Seeded ${billsData.length} parent bills.`);

  const serviceLinesData = [
    // Josmic line
    {
      id: 'srv-l-1',
      billId: 'bill-josmic-001',
      dos: '12/30/2025',
      dateOfService: '12/30/2025',
      cptCode: '99204',
      description: 'PAIN CONSULT',
      units: 1,
      charge: 1214.00,
      payments: { insurance: 0, patient: 0, other: 0 },
      adjustments: 0.00,
      balance: 1214.00,
      lineBalance: 1214.00
    },
    // Davs lines
    { id: 'srv-l-2', billId: 'bill-davs-001', dos: '01/06/2026', dateOfService: '01/06/2026', cptCode: '99204', description: 'INITIAL VISIT II', units: 1, charge: 250.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 250.00, lineBalance: 250.00 },
    { id: 'srv-l-3', billId: 'bill-davs-001', dos: '01/06/2026', dateOfService: '01/06/2026', cptCode: '0101T', description: 'SHOCKWAVE', units: 1, charge: 1000.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 1000.00, lineBalance: 1000.00 },
    { id: 'srv-l-4', billId: 'bill-davs-001', dos: '01/06/2026', dateOfService: '01/06/2026', cptCode: '0101T', description: 'SHOCKWAVE', units: 1, charge: 1000.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 1000.00, lineBalance: 1000.00 },
    { id: 'srv-l-5', billId: 'bill-davs-001', dos: '01/06/2026', dateOfService: '01/06/2026', cptCode: '0101T', description: 'SHOCKWAVE', units: 1, charge: 1000.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 1000.00, lineBalance: 1000.00 },
    { id: 'srv-l-6', billId: 'bill-davs-001', dos: '01/06/2026', dateOfService: '01/06/2026', cptCode: '10001', description: 'Eye protective glasses', units: 1, charge: 50.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 50.00, lineBalance: 50.00 },
    { id: 'srv-l-7', billId: 'bill-davs-001', dos: '01/06/2026', dateOfService: '01/06/2026', cptCode: '97124', description: 'Massage therapy I', units: 1, charge: 90.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 90.00, lineBalance: 90.00 },
    { id: 'srv-l-8', billId: 'bill-davs-001', dos: '01/07/2026', dateOfService: '01/07/2026', cptCode: '0101T', description: 'SHOCKWAVE', units: 1, charge: 1000.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 1000.00, lineBalance: 1000.00 },
    { id: 'srv-l-9', billId: 'bill-davs-001', dos: '01/07/2026', dateOfService: '01/07/2026', cptCode: '0101T', description: 'SHOCKWAVE', units: 1, charge: 1000.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 1000.00, lineBalance: 1000.00 },
    { id: 'srv-l-10', billId: 'bill-davs-001', dos: '01/07/2026', dateOfService: '01/07/2026', cptCode: '0101T', description: 'SHOCKWAVE', units: 1, charge: 1000.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 1000.00, lineBalance: 1000.00 },
    { id: 'srv-l-11', billId: 'bill-davs-001', dos: '01/07/2026', dateOfService: '01/07/2026', cptCode: '10001', description: 'Eye protective glasses', units: 1, charge: 50.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 50.00, lineBalance: 50.00 },
    { id: 'srv-l-12', billId: 'bill-davs-001', dos: '01/07/2026', dateOfService: '01/07/2026', cptCode: '97124', description: 'Massage therapy I', units: 1, charge: 90.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 90.00, lineBalance: 90.00 },
    { id: 'srv-l-13', billId: 'bill-davs-001', dos: '01/08/2026', dateOfService: '01/08/2026', cptCode: '99214', description: 'FINAL VISIT II', units: 1, charge: 200.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 200.00, lineBalance: 200.00 },
    { id: 'srv-l-14', billId: 'bill-davs-001', dos: '01/08/2026', dateOfService: '01/08/2026', cptCode: '0101T', description: 'SHOCKWAVE', units: 1, charge: 1000.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 1000.00, lineBalance: 1000.00 },
    { id: 'srv-l-15', billId: 'bill-davs-001', dos: '01/08/2026', dateOfService: '01/08/2026', cptCode: '0101T', description: 'SHOCKWAVE', units: 1, charge: 1000.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 1000.00, lineBalance: 1000.00 },
    { id: 'srv-l-16', billId: 'bill-davs-001', dos: '01/08/2026', dateOfService: '01/08/2026', cptCode: '0101T', description: 'SHOCKWAVE', units: 1, charge: 1000.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 1000.00, lineBalance: 1000.00 },
    // Anik lines
    { id: 'srv-l-17', billId: 'bill-anik-001', dos: '01/22/2026', dateOfService: '01/22/2026', cptCode: '97039', description: 'LASER THERAPY', units: 1, charge: 2000.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 2000.00, lineBalance: 2000.00 },
    { id: 'srv-l-18', billId: 'bill-anik-001', dos: '01/22/2026', dateOfService: '01/22/2026', cptCode: '97039', description: 'LASER THERAPY', units: 1, charge: 2000.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 2000.00, lineBalance: 2000.00 },
    { id: 'srv-l-19', billId: 'bill-anik-001', dos: '01/22/2026', dateOfService: '01/22/2026', cptCode: '97039', description: 'LASER THERAPY', units: 1, charge: 2000.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 2000.00, lineBalance: 2000.00 },
    { id: 'srv-l-20', billId: 'bill-anik-001', dos: '01/22/2026', dateOfService: '01/22/2026', cptCode: '10001', description: 'Eye protective glasses', units: 1, charge: 50.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 50.00, lineBalance: 50.00 },
    { id: 'srv-l-21', billId: 'bill-anik-001', dos: '01/22/2026', dateOfService: '01/22/2026', cptCode: '97124', description: 'Massage therapy I', units: 1, charge: 90.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 90.00, lineBalance: 90.00 },
    { id: 'srv-l-22', billId: 'bill-anik-001', dos: '01/24/2026', dateOfService: '01/24/2026', cptCode: '97039', description: 'LASER THERAPY', units: 1, charge: 2000.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 2000.00, lineBalance: 2000.00 },
    // Counselor lines
    { id: 'srv-l-23', billId: 'bill-counselor-001', dos: '01/05/2026', dateOfService: '01/05/2026', cptCode: '90791', description: 'PSYCHIATRIC DIAGNOSTIC EVALUATION', units: 1, charge: 350.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 350.00, lineBalance: 350.00 },
    { id: 'srv-l-24', billId: 'bill-counselor-001', dos: '01/12/2026', dateOfService: '01/12/2026', cptCode: '90834', description: 'PSYCHOTHERAPY 45 MIN (POST-TRAUMA)', units: 1, charge: 180.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 180.00, lineBalance: 180.00 },
    // TPI lines
    { id: 'srv-l-25', billId: 'bill-tpi-001', dos: '01/15/2026', dateOfService: '01/15/2026', cptCode: '20552', description: 'Trigger Point Injection (1-2 muscles)', units: 1, charge: 350.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 350.00, lineBalance: 350.00 },
    { id: 'srv-l-26', billId: 'bill-tpi-001', dos: '01/20/2026', dateOfService: '01/20/2026', cptCode: '20552', description: 'Trigger Point Injection (1-2 muscles)', units: 1, charge: 350.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 350.00, lineBalance: 350.00 },
    // TECAR lines
    { id: 'srv-l-27', billId: 'bill-tecar-001', dos: '01/20/2026', dateOfService: '01/20/2026', cptCode: '97024', description: 'Diathermy (e.g., microwave)', units: 1, charge: 250.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 250.00, lineBalance: 250.00 },
    { id: 'srv-l-28', billId: 'bill-tecar-001', dos: '01/25/2026', dateOfService: '01/25/2026', cptCode: '97024', description: 'Diathermy (e.g., microwave)', units: 1, charge: 250.00, payments: { insurance: 0, patient: 0, other: 0 }, adjustments: 0.00, balance: 250.00, lineBalance: 250.00 }
  ];

  for (const line of serviceLinesData) {
    await prisma.serviceLine.create({ data: line });
  }
  console.log(`📋 Seeded ${serviceLinesData.length} itemized CPT service lines.`);

  // 10. Seed Documents (3 documents)
  const documentsData = [
    {
      id: 'doc-001',
      caseId: 'case-001',
      name: 'Initial Pain Evaluation.pdf',
      documentType: 'Medical Records',
      type: 'Medical Records',
      providerName: 'JOSMIC Wellness Center',
      date: '12/30/2025',
      status: 'COMPLETED_DEMO',
      size: '1.4 MB',
      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
    },
    {
      id: 'doc-002',
      caseId: 'case-001',
      name: 'ESWT Treatment Log Session 1-3.pdf',
      documentType: 'Treatment Plans',
      type: 'Treatment Plans',
      providerName: "DAV'S Anatomy",
      date: '01/06/2026',
      status: 'COMPLETED_DEMO',
      size: '980 KB',
      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
    },
    {
      id: 'doc-003',
      caseId: 'case-001',
      name: 'Laser Procedure Log Session 1-3.pdf',
      documentType: 'Treatment Plans',
      type: 'Treatment Plans',
      providerName: 'ANIK Laser Therapy',
      date: '01/22/2026',
      status: 'UPLOADED_DEMO',
      size: '1.1 MB',
      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
    }
  ];

  for (const doc of documentsData) {
    await prisma.document.create({ data: doc });
  }
  console.log(`📂 Seeded ${documentsData.length} document assets.`);

  // 11. Seed Compliance Logs (3 logs)
  const auditLogsData = [];

  for (const log of auditLogsData) {
    await prisma.auditLog.create({ data: log });
  }
  console.log(`🛡️ Seeded ${auditLogsData.length} compliance audit entries.`);

  // 12. Seed Reminder Logs (3 logs)
  const reminderLogsData = [
    {
      id: 'rem-log-001',
      patientName: 'Demo Patient 001',
      channel: 'SMS',
      sentAt: '2026-08-17 08:00 AM',
      recipient: '713-555-0199',
      status: 'Sent - Demo',
      messagePreview: 'Reminder: Hello Demo Patient 001, your appointment is today at 09:00 AM.'
    },
    {
      id: 'rem-log-002',
      patientName: 'Jane Smith',
      channel: 'EMAIL',
      sentAt: '2026-08-17 08:00 AM',
      recipient: 'janesmith@example.test',
      status: 'Delivered - Confirmed',
      messagePreview: 'Dear Jane Smith, your visit is scheduled for 2026-08-17 at 10:30 AM.'
    },
    {
      id: 'rem-log-003',
      patientName: 'Robert Johnson',
      channel: 'SMS',
      sentAt: '2026-08-18 09:00 AM',
      recipient: '281-555-0155',
      status: 'Sent - SMS Queued',
      messagePreview: 'Reminder: Hello Robert Johnson, your appointment is scheduled for tomorrow at 01:30 PM.'
    }
  ];

  for (const log of reminderLogsData) {
    await prisma.reminderLog.create({ data: log });
  }
  console.log(`🗂️ Seeded ${reminderLogsData.length} reminder logs.`);

  // 13. Create default reminder settings
  await prisma.reminderSetting.create({
    data: {
      id: 'default',
      enable24hSms: true,
      enable2hEmail: true,
      enableMissedFollowUp: true,
      smsTemplate: 'Reminder: Hello {PATIENT_NAME}, your upcoming medical appointment is scheduled for {APT_DATE} at {APT_TIME}. Reply 1 to confirm.',
      emailTemplate: 'Dear {PATIENT_NAME},\n\nThis is a reminder for your upcoming medical visit on {APT_DATE} at {APT_TIME}.\n\nPlease contact our office if you need to reschedule.'
    }
  });
  console.log('⏰ Created default SMS/Email reminder settings.');

  console.log('🌱 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
