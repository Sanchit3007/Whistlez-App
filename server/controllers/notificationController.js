const Business = require('../models/Business');
const User = require('../models/User');
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

const getReadNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('readNotificationIds').lean();
    res.json({ success: true, ids: user?.readNotificationIds || [] });
  } catch (error) {
    console.error('Could not load read notifications:', error.message);
    res.status(500).json({ success: false, message: 'Could not load read notifications.' });
  }
};

const markNotificationsRead = async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 ||
      ids.some(id => typeof id !== 'string' || id.length === 0 || id.length > 128)) {
    return res.status(400).json({ success: false, message: 'Invalid notification IDs.' });
  }

  try {
    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { readNotificationIds: { $each: ids } } },
      { timestamps: false }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Could not save read notifications:', error.message);
    res.status(500).json({ success: false, message: 'Could not save read notifications.' });
  }
};

module.exports = { getKycNotifications, getReadNotifications, markNotificationsRead };
