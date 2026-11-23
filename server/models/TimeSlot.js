const mongoose = require('mongoose');

const TimeSlotSchema = new mongoose.Schema(
  {
    providerId: {
      type: String,
      required: true,
      index: true
    },
    date: {
      type: String, // Format: YYYY-MM-DD
      required: true,
      index: true
    },
    startTime: {
      type: String, // Format: HH:MM (24-hour)
      required: true
    },
    endTime: {
      type: String, // Format: HH:MM (24-hour)
      required: true
    },
    maxCapacity: {
      type: Number,
      required: true,
      default: 1
    },
    bookedCount: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('TimeSlot', TimeSlotSchema);
