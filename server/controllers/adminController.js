const crypto = require('crypto');
const mongoose = require('mongoose');
const Business = require('../models/Business');
const Token = require('../models/Token');
const TimeSlot = require('../models/TimeSlot');
const QRCode = require('qrcode');
const { uploadToCloudinary, isCloudinaryConfigured, sendMediaUploadError } = require('../config/cloudinary');
const { recordKycActivity } = require('../utils/kycActivity');

// Helper to generate a collision-resistant unique code: WHZ-QR-XXXX-XXXX
const generateUniqueCode = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `WHZ-QR-${code.slice(0, 4)}-${code.slice(4)}`;
};

// @desc    Get Business Profile of Logged-in Admin
// @route   GET /api/admin/business
// @access  Private (Admin only)
const getBusinessProfile = async (req, res) => {
  try {
    const business = await Business.findById(req.user.businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business profile not found' });
    }
    res.json({ success: true, business });
  } catch (error) {
    console.error('Get business error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update Business Profile
// @route   PUT /api/admin/business
// @access  Private (Admin only)
const updateBusinessProfile = async (req, res) => {
  try {
    const business = await Business.findById(req.user.businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business profile not found' });
    }

    const {
      name,
      category,
      phone,
      address,
      country,
      state,
      city,
      zipCode,
      logo,
      backgroundImage,
      primaryColor,
      website,
      qrCode,
      queueConfig
    } = req.body;

    if (name) business.name = name;
    if (category) business.category = category;
    if (phone) business.phone = phone;
    if (address) business.address = address;
    if (country) business.country = country;
    if (state) business.state = state;
    if (city) business.city = city;
    if (zipCode) business.zipCode = zipCode;
    if (website !== undefined) business.website = website;
    if (qrCode !== undefined) business.qrCode = qrCode;
    if (logo) {
      business.logo = await uploadToCloudinary(logo, 'logos');
    }
    if (backgroundImage) {
      business.backgroundImage = await uploadToCloudinary(backgroundImage, 'backgrounds');
    }
    if (primaryColor) business.primaryColor = primaryColor;
    if (queueConfig) {
      if (queueConfig.name) business.queueConfig.name = queueConfig.name;
      if (queueConfig.startTime) business.queueConfig.startTime = queueConfig.startTime;
      if (queueConfig.endTime) business.queueConfig.endTime = queueConfig.endTime;
      if (queueConfig.serviceTime) business.queueConfig.serviceTime = Number(queueConfig.serviceTime);
    }

    await business.save();

    const io = req.app.get('io');
    if (io) {
      io.to(business._id.toString()).emit('businessUpdated', { business });
      io.to('superadmin').emit('businessesUpdated');
    }

    res.json({ success: true, message: 'Business updated successfully', business });
  } catch (error) {
    if (sendMediaUploadError(res, error)) return;
    console.error('Update business error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Generate a Unique QR Code for the Business & Save to Collection
// @route   POST /api/admin/business/qr/generate
// @access  Private (Admin only)
const generateQRCode = async (req, res) => {
  try {
    const business = await Business.findById(req.user.businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business profile not found' });
    }

    // Generate unique alphanumeric code
    const uniqueCode = generateUniqueCode();

    // QR Payload: mobile deep link and structured payload
    const qrPayload = JSON.stringify({
      uniqueCode,
      businessId: business._id.toString(),
      name: business.name,
      category: business.category,
      scanUrl: `https://whistleapp.com/scan/${uniqueCode}`,
      app: 'WhistleApp'
    });

    // Generate high-resolution QR code data URL
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      width: 600,
      color: {
        dark: business.primaryColor || '#000000',
        light: '#FFFFFF'
      }
    });

    // Optionally upload to Cloudinary or save data URL directly
    let qrCodeUrl = qrDataUrl;
    try {
      if (isCloudinaryConfigured()) {
        qrCodeUrl = await uploadToCloudinary(qrDataUrl, 'qrcodes', 'image');
      }
    } catch (uploadErr) {
      console.warn('Cloudinary upload skipped, saving data URL:', uploadErr.message);
      qrCodeUrl = qrDataUrl;
    }

    business.qrCode = qrCodeUrl;
    business.uniqueQrCode = uniqueCode;
    business.qrGeneratedAt = new Date();
    await business.save();

    const io = req.app.get('io');
    if (io) {
      io.to(business._id.toString()).emit('businessUpdated', { business });
    }

    res.json({
      success: true,
      message: 'Unique QR Code generated and saved successfully',
      qrCode: qrCodeUrl,
      uniqueQrCode: uniqueCode,
      qrGeneratedAt: business.qrGeneratedAt,
      business
    });
  } catch (error) {
    console.error('Generate QR Code error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error generating QR Code' });
  }
};

// @desc    Update / Upload Custom QR Code for the Business
// @route   PUT /api/admin/business/qr
// @access  Private (Admin only)
const updateQRCode = async (req, res) => {
  try {
    const { qrCode } = req.body;
    if (!qrCode) {
      return res.status(400).json({ success: false, message: 'QR Code data or image is required' });
    }

    const business = await Business.findById(req.user.businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business profile not found' });
    }

    let finalQrUrl = qrCode;
    // Upload if base64 provided
    if (qrCode.startsWith('data:image/')) {
      try {
        if (isCloudinaryConfigured()) {
          finalQrUrl = await uploadToCloudinary(qrCode, 'qrcodes', 'image');
        }
      } catch (uploadErr) {
        console.warn('Cloudinary upload fallback to data URL:', uploadErr.message);
        finalQrUrl = qrCode;
      }
    }

    // Assign unique code if not yet assigned
    if (!business.uniqueQrCode) {
      business.uniqueQrCode = generateUniqueCode();
    }

    business.qrCode = finalQrUrl;
    business.qrGeneratedAt = new Date();
    await business.save();

    const io = req.app.get('io');
    if (io) {
      io.to(business._id.toString()).emit('businessUpdated', { business });
    }

    res.json({
      success: true,
      message: 'QR Code updated successfully',
      qrCode: finalQrUrl,
      uniqueQrCode: business.uniqueQrCode,
      qrGeneratedAt: business.qrGeneratedAt,
      business
    });
  } catch (error) {
    console.error('Update QR Code error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error updating QR Code' });
  }
};

// @desc    Remove / Delete QR Code from the Business Collection
// @route   DELETE /api/admin/business/qr
// @access  Private (Admin only)
const removeQRCode = async (req, res) => {
  try {
    const business = await Business.findById(req.user.businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business profile not found' });
    }

    business.qrCode = '';
    business.uniqueQrCode = undefined;
    business.qrGeneratedAt = undefined;
    await business.save();

    const io = req.app.get('io');
    if (io) {
      io.to(business._id.toString()).emit('businessUpdated', { business });
    }

    res.json({
      success: true,
      message: 'QR Code removed successfully',
      business
    });
  } catch (error) {
    console.error('Remove QR Code error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error removing QR Code' });
  }
};

// @desc    Verify Scanned Unique QR Code from Mobile App
// @route   GET /api/public/qr/verify/:code
// @access  Public
const verifyQRCode = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ success: false, message: 'QR Code identifier is required' });
    }

    const business = await Business.findOne({ uniqueQrCode: code });
    if (!business) {
      return res.status(404).json({ success: false, message: 'Invalid, expired, or unassigned QR Code' });
    }

    res.json({
      success: true,
      message: 'QR Code verified successfully',
      business: {
        _id: business._id,
        name: business.name,
        category: business.category,
        phone: business.phone,
        address: business.address,
        city: business.city,
        state: business.state,
        logo: business.logo,
        primaryColor: business.primaryColor,
        queueConfig: business.queueConfig,
        uniqueQrCode: business.uniqueQrCode,
        qrGeneratedAt: business.qrGeneratedAt
      }
    });
  } catch (error) {
    console.error('Verify QR Code error:', error);
    res.status(500).json({ success: false, message: 'Server error verifying QR code' });
  }
};

// @desc    Get Tokens for Logged-in Admin's Business
// @route   GET /api/admin/tokens
// @access  Private (Admin only)
const getAdminTokens = async (req, res) => {
  try {
    const businessId = req.user.businessId ? req.user.businessId.toString() : null;
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'No business linked to this admin account' });
    }

    const { date, startDate, endDate, all } = req.query;

    const filter = {
      providerId: businessId
    };

    if (all !== 'true') {
      if (startDate || endDate) {
        const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
        if ((startDate && !validDate(startDate)) || (endDate && !validDate(endDate)) || (startDate && endDate && startDate > endDate)) {
          return res.status(400).json({ success: false, message: 'Choose a valid report date range.' });
        }
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
        if (endDate) filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
      } else if (date) {
        const start = new Date(date);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setUTCHours(23, 59, 59, 999);
        filter.$or = [
          { createdAt: { $gte: start, $lte: end } },
          { issuedAt: { $gte: start, $lte: end } }
        ];
      }
    }

    const tokens = await Token.find(filter)
      .select('+visitPurpose +visitAt +visitNotes')
      .sort({ createdAt: 1 });

    // Enrich with user profile (customerName & customerPhone) if missing
    const userIds = tokens.map(t => t.userId).filter(Boolean);
    const userMap = new Map();
    if (userIds.length > 0) {
      const userDocs = await mongoose.connection.db.collection('user').find({
        _id: { $in: userIds }
      }).toArray();
      userDocs.forEach(u => userMap.set(u._id.toString(), u));
    }

    const formattedTokens = tokens.map(t => {
      const tokenObj = t.toObject ? t.toObject() : { ...t };
      const mobileUser = tokenObj.userId ? userMap.get(tokenObj.userId.toString()) : null;

      let status = tokenObj.status;
      if (!status) {
        if (tokenObj.completed) {
          status = 'completed';
        } else if (tokenObj.nowServing && tokenObj.nowServing === tokenObj.tokenNumber) {
          status = 'serving';
        } else {
          status = 'waiting';
        }
      }

      return {
        ...tokenObj,
        customerName: tokenObj.customerName || mobileUser?.profile?.name || 'Walk-in Client',
        customerPhone: tokenObj.customerPhone || mobileUser?.profile?.tagline || '',
        status
      };
    });

    res.json({ success: true, tokens: formattedTokens });
  } catch (error) {
    console.error('Get admin tokens error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error fetching tokens' });
  }
};

// @desc    Get Queue Metrics for Logged-in Admin's Business
// @route   GET /api/admin/metrics
// @access  Private (Admin only)
const getAdminMetrics = async (req, res) => {
  try {
    const businessId = req.user.businessId ? req.user.businessId.toString() : null;
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'No business linked to this admin account' });
    }

    const business = await Business.findById(businessId);
    const { date } = req.query;

    const filter = {
      providerId: businessId
    };

    if (date) {
      const start = new Date(date);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setUTCHours(23, 59, 59, 999);
      filter.$or = [
        { createdAt: { $gte: start, $lte: end } },
        { issuedAt: { $gte: start, $lte: end } }
      ];
    }

    const tokens = await Token.find(filter);

    let waiting = 0;
    let serving = 0;
    let completed = 0;
    let cancelled = 0;
    let totalWaitTimeMs = 0;
    let waitTimeCount = 0;

    tokens.forEach(t => {
      let status = t.status;
      if (!status) {
        if (t.completed) status = 'completed';
        else if (t.nowServing && t.nowServing === t.tokenNumber) status = 'serving';
        else status = 'waiting';
      }

      if (status === 'waiting') waiting++;
      else if (status === 'serving') serving++;
      else if (status === 'completed') completed++;
      else if (status === 'cancelled') cancelled++;

      if (t.calledAt && t.createdAt) {
        totalWaitTimeMs += (new Date(t.calledAt) - new Date(t.createdAt));
        waitTimeCount++;
      } else if (t.completedAt && t.createdAt) {
        totalWaitTimeMs += (new Date(t.completedAt) - new Date(t.createdAt));
        waitTimeCount++;
      }
    });

    const avgWaitTimeMinutes = waitTimeCount > 0
      ? Math.round(totalWaitTimeMs / waitTimeCount / 60000)
      : (business?.queueConfig?.serviceTime || 15);

    res.json({
      success: true,
      metrics: {
        totalTokens: tokens.length,
        waiting,
        serving,
        completed,
        cancelled,
        avgWaitTimeMinutes
      }
    });
  } catch (error) {
    console.error('Get admin metrics error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error calculating metrics' });
  }
};

// @desc    Create Walk-in Token
// @route   POST /api/admin/tokens/add
// @access  Private (Admin only)
const addWalkInToken = async (req, res) => {
  try {
    const businessId = req.user.businessId ? req.user.businessId.toString() : null;
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'No business linked to this admin account' });
    }

    const { customerName, customerPhone, visitPurpose = '', visitAt, visitNotes = '' } = req.body;
    if (typeof customerName !== 'string' || !customerName.trim() ||
        typeof customerPhone !== 'string' || !customerPhone.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name and phone number are required' });
    }
    if (typeof visitPurpose !== 'string' || visitPurpose.trim().length > 100 ||
        typeof visitNotes !== 'string' || visitNotes.trim().length > 300) {
      return res.status(400).json({ success: false, message: 'Use up to 100 characters for the purpose and 300 for notes.' });
    }
    const arrival = typeof visitAt === 'string' ? new Date(visitAt) : null;
    if (visitAt !== undefined && (!arrival || !Number.isFinite(arrival.getTime()) ||
        arrival.toISOString() !== visitAt || arrival.getTime() > Date.now())) {
      return res.status(400).json({ success: false, message: 'Enter a valid arrival date and time at or before now.' });
    }

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    if (business.businessStatus !== 'Active' || business.kycStatus !== 'Approved') {
      return res.status(403).json({ success: false, message: 'KYC not verified. Token generation is disabled.' });
    }

    const prefix = business.queueConfig?.name ? business.queueConfig.name.charAt(0).toUpperCase() : 'A';

    // Calculate today's next sequence number
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const latestToken = await Token.findOne({
      providerId: businessId,
      createdAt: { $gte: todayStart }
    }).sort({ createdAt: -1 });

    let nextSeq = 101;
    if (latestToken && latestToken.tokenNumber) {
      const match = latestToken.tokenNumber.match(/\d+/);
      if (match) {
        nextSeq = parseInt(match[0], 10) + 1;
      }
    }

    const tokenNumber = `${prefix}-${nextSeq}`;
    const waitingCount = await Token.countDocuments({
      providerId: businessId,
      status: 'waiting',
      createdAt: { $gte: todayStart }
    });

    const token = new Token({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      visitPurpose: visitPurpose.trim() || undefined,
      visitAt: arrival || undefined,
      visitNotes: visitNotes.trim() || undefined,
      providerId: businessId,
      providerName: business.name,
      area: `${business.city || ''}, ${business.state || ''}`.trim() || 'Local',
      queueId: `q-${businessId}`,
      queueName: business.queueConfig?.name || 'General OPD',
      tokenNumber,
      nowServing: latestToken?.nowServing || `${prefix}-100`,
      peopleAhead: waitingCount,
      etaMins: (waitingCount + 1) * (business.queueConfig?.serviceTime || 15),
      status: 'waiting',
      completed: false,
      issuedAt: new Date()
    });

    await token.save();

    const io = req.app.get('io');
    if (io) {
      const eventToken = token.toObject();
      delete eventToken.visitPurpose;
      delete eventToken.visitAt;
      delete eventToken.visitNotes;
      io.to(businessId).emit('tokenUpdated', { token: eventToken, action: 'created' });
      io.to('superadmin').emit('tokenUpdated', { token: eventToken, action: 'created' });
    }

    res.json({
      success: true,
      message: `Token ${tokenNumber} created successfully`,
      token
    });
  } catch (error) {
    console.error('Add walk-in token error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error creating token' });
  }
};

// @desc    Update Token Status (Serving, Completed, Waiting, Cancelled)
// @route   PUT /api/admin/tokens/:id/status
// @access  Private (Admin only)
const updateTokenStatus = async (req, res) => {
  try {
    const businessId = req.user.businessId ? req.user.businessId.toString() : null;
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'No business linked to this admin account' });
    }

    const { id } = req.params;
    const { status, expectedStatus } = req.body;

    const validStatuses = ['waiting', 'serving', 'completed', 'cancelled', 'skipped', 'postponed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status '${status}'` });
    }

    let token = await Token.findOne({ _id: id, providerId: businessId });
    if (!token) {
      return res.status(404).json({ success: false, message: 'Token not found' });
    }

    if (status === 'serving' && expectedStatus === 'waiting') {
      token = await Token.findOneAndUpdate(
        {
          _id: id,
          providerId: businessId,
          $or: [
            { status: 'waiting' },
            { status: { $in: [null, ''] }, completed: { $ne: true }, nowServing: { $ne: token.tokenNumber } }
          ]
        },
        { $set: { status, calledAt: new Date(), completed: false, nowServing: token.tokenNumber } },
        { new: true }
      );
      if (!token) {
        return res.status(409).json({ success: false, message: 'This ticket is no longer waiting. Choose the next waiting ticket.' });
      }
    } else {
      token.status = status;
      if (status === 'serving') {
        token.calledAt = new Date();
        token.completed = false;
        token.nowServing = token.tokenNumber;
      } else if (status === 'completed') {
        token.completed = true;
        token.completedAt = new Date();
        token.completedText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (status === 'cancelled') {
        token.completed = true;
      } else if (status === 'waiting') {
        token.completed = false;
        token.calledAt = null;
      }
      await token.save();
    }

    const io = req.app.get('io');
    if (io) {
      io.to(businessId).emit('tokenUpdated', { token, action: 'statusUpdated' });
      io.to('superadmin').emit('tokenUpdated', { token, action: 'statusUpdated' });
    }

    res.json({
      success: true,
      message: `Token #${token.tokenNumber} marked as ${status}`,
      token
    });
  } catch (error) {
    console.error('Update token status error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error updating token' });
  }
};

// @desc    Postpone Token to Future Date
// @route   PUT /api/admin/tokens/:id/postpone
// @access  Private (Admin only)
const postponeToken = async (req, res) => {
  try {
    const businessId = req.user.businessId ? req.user.businessId.toString() : null;
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'No business linked to this admin account' });
    }

    const { id } = req.params;
    const { postponedDate } = req.body;

    const token = await Token.findOne({ _id: id, providerId: businessId });
    if (!token) {
      return res.status(404).json({ success: false, message: 'Token not found' });
    }

    token.postponedDate = postponedDate;
    token.status = 'postponed';
    token.completed = true;
    await token.save();

    const io = req.app.get('io');
    if (io) {
      io.to(businessId).emit('tokenUpdated', { token, action: 'postponed' });
    }

    res.json({
      success: true,
      message: `Token #${token.tokenNumber} postponed to ${postponedDate}`,
      token
    });
  } catch (error) {
    console.error('Postpone token error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error postponing token' });
  }
};

// @desc    Submit KYC Details
// @route   POST /api/admin/business/kyc
// @access  Private (Admin only)
const submitKyc = async (req, res) => {
  try {
    const businessId = req.user.businessId ? req.user.businessId.toString() : null;
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'No business linked to this admin account' });
    }

    const {
      phoneNumber,
      emailAddress,
      canNumber,
      gstNumber,
      panNumber,
      registrationNumber,
      legalName,
      aadhaarOrId,
      documents // array of { docType, fileBase64 }
    } = req.body;

    const business = await Business.findById(businessId).select('+kycActivity');
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    // Process documents if any (assuming they are base64 strings and uploadToCloudinary is available)
    const uploadedDocs = new Map((business.kycDetails?.documents || []).map(doc => [doc.docType, { docType: doc.docType, url: doc.url }]));
    const replacements = new Map();
    if (documents && Array.isArray(documents)) {
      for (const doc of documents) {
        if (doc?.fileBase64) {
          if (!['PAN', 'AddressProof'].includes(doc.docType)) {
            return res.status(400).json({ success: false, message: 'Choose a supported KYC document.' });
          }
          if (typeof doc.fileBase64 !== 'string' || !/^data:(?:image\/[a-z0-9.+-]+|application\/pdf);base64,/i.test(doc.fileBase64)) {
            return res.status(400).json({ success: false, message: 'Choose a new image or PDF for the KYC document.' });
          }
          replacements.set(doc.docType, doc.fileBase64);
        }
      }
    }
    const missing = business.kycDetails?.documentCorrections?.find(doc => !replacements.has(doc.docType));
    if (missing) {
      return res.status(400).json({ success: false, message: `Replace the ${missing.docType === 'PAN' ? 'PAN card' : 'address proof'} before resubmitting.` });
    }
    for (const [docType, file] of replacements) {
      const url = await uploadToCloudinary(file, 'kyc_documents');
      uploadedDocs.set(docType, { docType, url });
    }

    business.kycDetails = {
      phoneNumber,
      emailAddress,
      canNumber,
      gstNumber,
      panNumber,
      companyDetails: {
        registrationNumber,
        legalName
      },
      individualDetails: {
        aadhaarOrId
      },
      documents: [...uploadedDocs.values()],
      documentCorrections: [],
      rejectionReason: null
    };

    recordKycActivity(business, 'Submitted');
    business.kycStatus = 'Submitted';
    await business.save();

    const io = req.app.get('io');
    if (io) {
      io.to('superadmin').emit('kycSubmitted', { businessId: business._id });
    }

    const profile = business.toObject();
    delete profile.kycActivity;
    res.json({
      success: true,
      message: 'KYC submitted successfully',
      business: profile
    });
  } catch (error) {
    if (sendMediaUploadError(res, error)) return;
    console.error('Submit KYC error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error submitting KYC' });
  }
};

// --- Time Slots ---

const createTimeSlot = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { date, startTime, endTime, maxCapacity } = req.body;

    if (!date || !startTime || !endTime || !maxCapacity) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const newSlot = new TimeSlot({
      providerId: businessId,
      date,
      startTime,
      endTime,
      maxCapacity
    });

    await newSlot.save();
    res.status(201).json({ success: true, slot: newSlot });
  } catch (error) {
    console.error('Create TimeSlot error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getTimeSlots = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { date, next, fromDate, fromTime = '00:00' } = req.query;

    const query = { providerId: businessId };
    if (next === 'true') {
      if (!businessId || typeof fromDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
          !Number.isFinite(Date.parse(fromDate)) || typeof fromTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(fromTime)) {
        return res.status(400).json({ success: false, message: 'Choose a valid date and time to find the next available slot.' });
      }
      const slot = await TimeSlot.findOne({
        ...query,
        isActive: { $ne: false },
        $expr: { $lt: [{ $ifNull: ['$bookedCount', 0] }, '$maxCapacity'] },
        $or: [{ date: { $gt: fromDate } }, { date: fromDate, endTime: { $gt: fromTime } }]
      }).sort({ date: 1, startTime: 1 });
      return res.json({ success: true, slot });
    }
    if (date) query.date = date;

    const slots = await TimeSlot.find(query).sort({ startTime: 1 });
    res.json({ success: true, slots });
  } catch (error) {
    console.error('Get TimeSlots error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteTimeSlot = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { id } = req.params;

    const slot = await TimeSlot.findOne({ _id: id, providerId: businessId });
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }

    if (slot.bookedCount > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete slot with bookings' });
    }

    await slot.deleteOne();
    res.json({ success: true, message: 'Slot deleted successfully' });
  } catch (error) {
    console.error('Delete TimeSlot error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateTimeSlot = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { id } = req.params;
    const { startTime, endTime, maxCapacity, isActive } = req.body;

    const slot = await TimeSlot.findOne({ _id: id, providerId: businessId });
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }

    if (maxCapacity !== undefined) {
      if (maxCapacity < slot.bookedCount) {
        return res.status(400).json({ success: false, message: 'Capacity cannot be less than already booked tokens' });
      }
      slot.maxCapacity = maxCapacity;
    }
    
    if (startTime) slot.startTime = startTime;
    if (endTime) slot.endTime = endTime;
    if (isActive !== undefined) slot.isActive = isActive;

    await slot.save();
    res.json({ success: true, slot });
  } catch (error) {
    console.error('Update TimeSlot error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getBusinessProfile,
  updateBusinessProfile,
  generateQRCode,
  updateQRCode,
  removeQRCode,
  verifyQRCode,
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
};
