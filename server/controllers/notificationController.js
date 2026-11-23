const Business = require('../models/Business');
const { KYC_NOTIFICATION_STATUSES, getLegacyKycActivity } = require('../utils/kycActivity');

const getKycNotifications = async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    if (!isSuperAdmin && !req.user.businessId) return res.json({ success: true, notifications: [] });
    const filter = isSuperAdmin
      ? { $or: [{ kycStatus: { $in: KYC_NOTIFICATION_STATUSES } }, { 'kycActivity.0': { $exists: true } }] }
      : { _id: req.user.businessId };
    const businesses = await Business.find(filter).select('name kycStatus createdAt updatedAt kycActivity').lean();
    const notifications = businesses.flatMap(business => {
      const previous = getLegacyKycActivity(business);
      const history = business.kycActivity?.length ? business.kycActivity : previous ? [previous] : [];
      return history.map(event => ({
        id: event.legacy ? `kyc:${business._id}:previous:${event.status}` : `kyc:${business._id}:${event._id}`,
        businessId: business._id,
        businessName: business.name,
        status: event.status,
        occurredAt: event.occurredAt
      }));
    });
    res.json({ success: true, notifications });
  } catch (error) {
    console.error('Could not load KYC notifications:', error.message);
    res.status(500).json({ success: false, message: 'Could not load KYC notifications.' });
  }
};

module.exports = { getKycNotifications };
