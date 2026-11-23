export const PENDING_VERIFICATION = 'Pending Verification';

export const verificationDocuments = [
  { type: 'PAN', id: 'verification-pan-file', label: 'PAN card' },
  { type: 'AddressProof', id: 'verification-address-proof', label: 'Address proof' }
];

export const needsKycReview = (business) => (
  ['Submitted', 'Under Review', 'Resubmission Required'].includes(business.kycStatus)
);
