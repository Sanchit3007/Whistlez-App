const mongoose = require('mongoose');

const adImpressionSchema = new mongoose.Schema({
  // One server-issued delivery ID per impression, including all retries.
  _id: { type: String, required: true },
  adId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  viewedAt: { type: Date, required: true },
  clickedAt: { type: Date, default: null }
}, { versionKey: false });

module.exports = mongoose.model('AdImpression', adImpressionSchema);
