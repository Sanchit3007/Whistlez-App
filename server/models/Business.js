const mongoose = require('mongoose');
const { KYC_NOTIFICATION_STATUSES } = require('../utils/kycActivity');

const BusinessSchema = new mongoose.Schema(
  {
    domain: {
      type: String,
      required: true,
      enum: ['Salon', 'Clinic', 'Restaurant', 'Retail', 'Education', 'Bank', 'Others', 'Health Care', 'Banking', 'Eating', 'Services', 'Beauty', 'Diagnostics', 'Other']
    },
    name: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    address: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    logo: {
      type: String,
      default: ''
    },
    backgroundImage: {
      type: String,
      default: ''
    },
    primaryColor: {
      type: String,
      default: '#007bff'
    },
    website: {
      type: String,
      default: ''
    },
    qrCode: {
      type: String,
      default: ''
    },
    uniqueQrCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    qrGeneratedAt: {
      type: Date
    },
    maxCapacity: {
      type: Number,
      default: 100
    },
    queueConfig: {
      name: { type: String, required: true },
      startTime: { type: String, required: true }, // e.g. "09:00"
      endTime: { type: String, required: true }, // e.g. "17:00"
      serviceTime: { type: Number, required: true, default: 15 } // in minutes
    },
    businessType: {
      type: String,
      enum: ['Company', 'Individual'],
      default: 'Company'
    },
    businessStatus: {
      type: String,
      enum: ['Pending Verification', 'Active', 'Suspended'],
      default: 'Pending Verification'
    },
    kycStatus: {
      type: String,
      enum: ['Pending', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Resubmission Required'],
      default: 'Pending'
    },
    kycActivity: {
      type: [{
        status: { type: String, enum: KYC_NOTIFICATION_STATUSES, required: true },
        occurredAt: Date,
        legacy: { type: Boolean, default: false }
      }],
      default: [],
      select: false
    },
    kycDetails: {
      phoneNumber: { type: String },
      emailAddress: { type: String },
      canNumber: { type: String },
      gstNumber: { type: String },
      panNumber: { type: String },
      companyDetails: {
        registrationNumber: { type: String },
        legalName: { type: String }
      },
      individualDetails: {
        aadhaarOrId: { type: String }
      },
      documents: [{
        docType: { type: String },
        url: { type: String }
      }],
      documentCorrections: [{
        _id: false,
        docType: { type: String, enum: ['PAN', 'AddressProof'] },
        reason: { type: String, maxlength: 1000 }
      }],
      rejectionReason: { type: String, default: null }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Business', BusinessSchema);
