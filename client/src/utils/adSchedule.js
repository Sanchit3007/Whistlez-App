export const AD_PLACEMENTS = [
  { id: 'HOME_1', label: 'Home Page 1' },
  { id: 'HOME_2', label: 'Home Page 2' },
  { id: 'SIDEBAR', label: 'Sidebar Ads' },
  { id: 'FOOTER', label: 'Footer Banners' }
];

const normalize = value => String(value || '').trim().toLowerCase();
const same = (left, right) => Boolean(normalize(left)) && normalize(left) === normalize(right);
const placementKey = value => AD_PLACEMENTS.find(placement => same(placement.id, value) || same(placement.label, value))?.id || normalize(value);
const positionsOf = ad => ad.positions?.length ? ad.positions : ad.position ? [ad.position] : [];

export const describeSchedule = ({ startDate, endDate }) =>
  `${startDate || 'Immediately'} → ${endDate || 'No end date'}`;

export const campaignStatus = (ad, today) => {
  if (!ad.isActive) return 'Paused';
  if (ad.endDate && ad.endDate < today) return 'Ended';
  return ad.startDate && ad.startDate > today ? 'Scheduled' : 'Active';
};

const locationsIntersect = (left, right) => {
  if (!same(left.countryCode, right.countryCode)) return false;
  if (left.targetingLevel === 'COUNTRY' || right.targetingLevel === 'COUNTRY') return true;
  if (!same(left.stateCode, right.stateCode)) return false;
  return left.targetingLevel === 'STATE' || right.targetingLevel === 'STATE' || same(left.cityName, right.cityName);
};

const audiencesIntersect = (left, right) => {
  if (left?.type !== 'REGIONAL' || right?.type !== 'REGIONAL') return true;
  return (left.locations || []).some(location => (right.locations || []).some(other => locationsIntersect(location, other)));
};

export const findOverlappingAds = (ads, draft, today) => {
  if ((draft.startDate && draft.endDate && draft.startDate > draft.endDate) ||
      (draft.endDate && draft.endDate < today) ||
      (draft.targeting?.type === 'REGIONAL' && !draft.targeting.locations?.length)) return [];
  const placements = new Set(positionsOf(draft).map(placementKey));
  return ads.filter(ad => ad._id !== draft._id && ad.isActive &&
    (!ad.endDate || ad.endDate >= today) &&
    (!draft.startDate || !ad.endDate || draft.startDate <= ad.endDate) &&
    (!ad.startDate || !draft.endDate || ad.startDate <= draft.endDate) &&
    positionsOf(ad).some(position => placements.has(placementKey(position))) &&
    audiencesIntersect(draft.targeting, ad.targeting));
};

export const businessMatchesAudience = (business, type, locations) => type !== 'REGIONAL' || locations.some(location =>
  (same(business.country, location.countryName) || same(business.country, location.countryCode)) &&
  (location.targetingLevel === 'COUNTRY' || same(business.state, location.stateName) || same(business.state, location.stateCode)) &&
  (location.targetingLevel !== 'CITY' || same(business.city, location.cityName)));
