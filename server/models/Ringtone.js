const mongoose = require('mongoose');

const RingtoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    file: {
      type: String, // Stores base64 audio data or URL path
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    originalDuration: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number,
      default: 15,
      set: v => {
        if (typeof v === 'string') {
          if (v.includes(':')) {
            const match = v.match(/(\d+):(\d+)/);
            if (match) return parseInt(match[1]) * 60 + parseInt(match[2]);
          }
          const num = parseInt(v);
          return isNaN(num) ? 15 : num;
        }
        return v;
      }
    },
    category: {
      type: String,
      enum: ['SOS', 'Notifications', 'Buzz', 'Whistlez Movement', 'General'],
      default: 'General'
    },
    repeatCount: {
      type: Number,
      default: 1,
      min: 1,
      max: 20
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ringtone', RingtoneSchema);
