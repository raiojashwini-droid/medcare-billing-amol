import { prisma } from '../config/db.js';

/**
 * Get all providers
 */
export const getProviders = async (req, res) => {
  try {
    const providers = await prisma.provider.findMany();
    // Return key-value dictionary to match current frontend layout if needed,
    // or return array. The frontend expected an object key-mapped by provider ID.
    // Let's format it as an object key-mapped by ID.
    const providerMap = {};
    providers.forEach(p => {
      providerMap[p.id] = {
        id: p.id,
        name: p.name,
        businessName: p.businessName,
        serviceCategory: p.serviceCategory,
        status: p.status,
        address: typeof p.address === 'string' ? JSON.parse(p.address) : p.address,
        contact: typeof p.contact === 'string' ? JSON.parse(p.contact) : p.contact,
        identifiers: typeof p.identifiers === 'string' ? JSON.parse(p.identifiers) : p.identifiers,
        renderingProvider: typeof p.renderingProvider === 'string' ? JSON.parse(p.renderingProvider) : p.renderingProvider,
        serviceFacility: typeof p.serviceFacility === 'string' ? JSON.parse(p.serviceFacility) : p.serviceFacility,
        billingProvider: typeof p.billingProvider === 'string' ? JSON.parse(p.billingProvider) : p.billingProvider,
        defaultPlaceOfService: p.defaultPlaceOfService,
        availableServices: typeof p.availableServices === 'string' ? JSON.parse(p.availableServices) : p.availableServices,
        availableDiagnoses: typeof p.availableDiagnoses === 'string' ? JSON.parse(p.availableDiagnoses) : p.availableDiagnoses,
        providerServices: typeof p.providerServices === 'string' ? JSON.parse(p.providerServices) : p.providerServices
      };
    });
    
    return res.status(200).json(providerMap);
  } catch (error) {
    console.error('Error fetching providers:', error);
    return res.status(500).json({ error: 'Internal server error fetching providers.' });
  }
};

/**
 * Register new provider
 */
export const createProvider = async (req, res) => {
  const {
    name, businessName, serviceCategory,
    street, suite, city, state, zipCode,
    phone, email, taxId, npi, renderingName, renderingCredentials,
    availableDiagnoses
  } = req.body;

  if (!name || !businessName || !npi || !taxId) {
    return res.status(400).json({ error: 'name, businessName, npi, and taxId are required fields.' });
  }

  const generatedId = `prov-${Date.now()}`;

  try {
    const address = { street, suite, city, state, zipCode };
    const contact = { phone, email, cell: '', fax: '' };
    const identifiers = { taxId, npi, ssnOrEin: 'EIN' };
    const renderingProvider = { name: renderingName, credentials: renderingCredentials, npi };
    const serviceFacility = { name, address: `${street}, ${suite}, ${city}, ${state} ${zipCode}`, npi };
    const billingProvider = { name, address: `${street}, ${city}, ${state} ${zipCode}`, phone };

    const newProvider = await prisma.provider.create({
      data: {
        id: generatedId,
        name,
        businessName,
        serviceCategory: serviceCategory || 'General Medicine',
        status: 'ACTIVE',
        address,
        contact,
        identifiers,
        renderingProvider,
        serviceFacility,
        billingProvider,
        defaultPlaceOfService: '11',
        availableServices: [],
        availableDiagnoses: availableDiagnoses || [],
        providerServices: []
      }
    });

    return res.status(201).json({
      id: newProvider.id,
      name: newProvider.name,
      status: newProvider.status
    });
  } catch (error) {
    console.error('Error registering provider:', error);
    return res.status(500).json({ error: 'Failed to register provider.' });
  }
};

/**
 * Update provider profile settings
 */
export const updateProvider = async (req, res) => {
  const { id } = req.params;
  const updateFields = req.body;

  try {
    const existing = await prisma.provider.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Provider not found.' });
    }

    // Parse existing JSON fields
    let existingContact = typeof existing.contact === 'string' ? JSON.parse(existing.contact) : existing.contact || {};
    let existingAddress = typeof existing.address === 'string' ? JSON.parse(existing.address) : existing.address || {};
    let existingIdentifiers = typeof existing.identifiers === 'string' ? JSON.parse(existing.identifiers) : existing.identifiers || {};
    let existingRendering = typeof existing.renderingProvider === 'string' ? JSON.parse(existing.renderingProvider) : existing.renderingProvider || {};
    let existingServiceFacility = typeof existing.serviceFacility === 'string' ? JSON.parse(existing.serviceFacility) : existing.serviceFacility || {};
    let existingBillingProvider = typeof existing.billingProvider === 'string' ? JSON.parse(existing.billingProvider) : existing.billingProvider || {};

    const name = updateFields.name || existing.name;
    const businessName = updateFields.businessName || existing.businessName;
    const serviceCategory = updateFields.serviceCategory || existing.serviceCategory;
    const street = updateFields.street ?? existingAddress.street;
    const suite = updateFields.suite ?? existingAddress.suite;
    const city = updateFields.city ?? existingAddress.city;
    const state = updateFields.state ?? existingAddress.state;
    const zipCode = updateFields.zipCode ?? existingAddress.zipCode;
    const phone = updateFields.phone ?? existingContact.phone;
    const email = updateFields.email ?? existingContact.email;
    const taxId = updateFields.taxId ?? existingIdentifiers.taxId;
    const npi = updateFields.npi ?? existingIdentifiers.npi;
    const renderingName = updateFields.renderingName ?? existingRendering.name;
    const renderingCredentials = updateFields.renderingCredentials ?? existingRendering.credentials;

    const updatedAddress = { street, suite, city, state, zipCode };
    const updatedContact = { ...existingContact, phone, email };
    const updatedIdentifiers = { ...existingIdentifiers, taxId, npi };
    const updatedRendering = { ...existingRendering, name: renderingName, credentials: renderingCredentials, npi };
    const updatedServiceFacility = { ...existingServiceFacility, name, address: `${street}, ${suite}, ${city}, ${state} ${zipCode}`, npi };
    const updatedBillingProvider = { ...existingBillingProvider, name, address: `${street}, ${city}, ${state} ${zipCode}`, phone };
    
    // Use the passed availableDiagnoses, or keep existing ones if not provided
    const availableDiagnoses = updateFields.availableDiagnoses !== undefined ? updateFields.availableDiagnoses : (typeof existing.availableDiagnoses === 'string' ? JSON.parse(existing.availableDiagnoses || '[]') : existing.availableDiagnoses || []);

    const updated = await prisma.provider.update({
      where: { id },
      data: {
        name,
        businessName,
        serviceCategory,
        address: updatedAddress,
        contact: updatedContact,
        identifiers: updatedIdentifiers,
        renderingProvider: updatedRendering,
        serviceFacility: updatedServiceFacility,
        billingProvider: updatedBillingProvider,
        status: updateFields.status || existing.status,
        availableDiagnoses: availableDiagnoses,
      }
    });

    return res.status(200).json({
      id: updated.id,
      name: updated.name,
      contact: typeof updated.contact === 'string' ? JSON.parse(updated.contact) : updated.contact
    });
  } catch (error) {
    console.error('Error updating provider:', error);
    return res.status(500).json({ error: 'Failed to update provider settings.' });
  }
};

/**
 * Delete provider
 */
export const deleteProvider = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.provider.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Provider not found.' });
    }

    await prisma.provider.delete({
      where: { id }
    });

    return res.status(200).json({ message: 'Provider deleted successfully.' });
  } catch (error) {
    console.error('Error deleting provider:', error);
    return res.status(500).json({ error: 'Failed to delete provider.' });
  }
};
