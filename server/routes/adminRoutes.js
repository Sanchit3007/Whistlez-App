const express = require('express');
const router = express.Router();
const {
  getBusinessProfile,
  updateBusinessProfile,
  generateQRCode,
  updateQRCode,
  removeQRCode,
  getAdminTokens,
  getAdminMetrics,
  addWalkInToken,
  updateTokenStatus,
  postponeToken,
  submitKyc,
  createTimeSlot,
  getTimeSlots,
  deleteTimeSlot,
  updateTimeSlot
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { getKycNotifications, getReadNotifications, markNotificationsRead } = require('../controllers/notificationController');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Business Profile & QR
router.get('/business', getBusinessProfile);
router.put('/business', updateBusinessProfile);
router.post('/business/kyc', submitKyc);
router.get('/notifications/kyc', getKycNotifications);
router.get('/notifications/read', getReadNotifications);
router.patch('/notifications/read', markNotificationsRead);
router.post('/business/qr/generate', generateQRCode);
router.put('/business/qr', updateQRCode);
router.delete('/business/qr', removeQRCode);

// Tokens & Live Queue Management
router.get('/tokens', getAdminTokens);
router.get('/metrics', getAdminMetrics);
router.post('/tokens/add', addWalkInToken);
router.put('/tokens/:id/status', updateTokenStatus);
router.put('/tokens/:id/postpone', postponeToken);

// Time Slots Management
router.post('/time-slots', createTimeSlot);
router.get('/time-slots', getTimeSlots);
router.put('/time-slots/:id', updateTimeSlot);
router.delete('/time-slots/:id', deleteTimeSlot);

module.exports = router;

