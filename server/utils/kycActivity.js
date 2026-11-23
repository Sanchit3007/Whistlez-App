const KYC_NOTIFICATION_STATUSES = ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Resubmission Required'];

const getLegacyKycActivity = (business) => {
  if (!KYC_NOTIFICATION_STATUSES.includes(business.kycStatus)) return null;
  return {
    status: business.kycStatus,
    occurredAt: business.updatedAt || business.createdAt || null,
    legacy: true
  };
};

const recordKycActivity = (business, status) => {
  if (business.kycActivity.length === 0) {
    const previous = getLegacyKycActivity(business);
    if (previous) business.kycActivity.push(previous);
  }
  business.kycActivity.push({ status, occurredAt: new Date() });
};

module.exports = { KYC_NOTIFICATION_STATUSES, getLegacyKycActivity, recordKycActivity };
