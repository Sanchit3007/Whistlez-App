const { randomBytes, randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const AdImpression = require('../models/AdImpression');

const audience = 'ad-engagement';
const localSigningKey = randomBytes(32).toString('hex');
const signingKey = () => `${audience}:${process.env.JWT_SECRET || localSigningKey}`;

const issueDeliveryToken = adId => jwt.sign({}, signingKey(), {
  algorithm: 'HS256',
  audience,
  subject: String(adId),
  jwtid: randomUUID(),
  expiresIn: '24h'
});

const verifyDelivery = (token, adId) => {
  if (typeof token !== 'string' || token.length > 1024) return null;
  try {
    const claims = jwt.verify(token, signingKey(), {
      algorithms: ['HS256'], audience, subject: adId
    });
    return claims.jti || null;
  } catch {
    return null;
  }
};

const recordView = async (adId, deliveryId) => {
  try {
    await AdImpression.updateOne(
      { _id: deliveryId, adId },
      { $setOnInsert: { viewedAt: new Date() } },
      { upsert: true }
    );
  } catch (error) {
    // Concurrent retries can race on the unique delivery ID.
    if (error.code !== 11000) throw error;
  }
};

const recordClick = (adId, deliveryId) => AdImpression.findOneAndUpdate(
  { _id: deliveryId, adId },
  [{ $set: { clickedAt: { $ifNull: ['$clickedAt', new Date()] } } }],
  { projection: { _id: 1 } }
);

const withAdEngagement = async ads => {
  if (!ads.length) return [];
  const results = await AdImpression.aggregate([
    { $match: { adId: { $in: ads.map(ad => ad._id) } } },
    {
      $group: {
        _id: '$adId',
        views: { $sum: 1 },
        clicks: { $sum: { $cond: [{ $ifNull: ['$clickedAt', false] }, 1, 0] } }
      }
    }
  ]);
  const countsById = new Map(results.map(counts => [String(counts._id), counts]));
  return ads.map(ad => {
    const counts = countsById.get(String(ad._id));
    return { ...ad, views: counts?.views ?? 0, clicks: counts?.clicks ?? 0 };
  });
};

module.exports = { issueDeliveryToken, verifyDelivery, recordView, recordClick, withAdEngagement };
