const isValidDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const validateAdSchedule = (startDate, endDate) => {
  if ([startDate, endDate].some(value => value !== null && value !== '' && !isValidDate(value))) {
    return 'Enter valid campaign dates.';
  }
  return startDate && endDate && startDate > endDate ? 'Choose an end date on or after the start date.' : '';
};

const activeAdsOn = date => ({
  isActive: true,
  $and: [
    { $or: [{ startDate: null }, { startDate: { $lte: date } }] },
    { $or: [{ endDate: null }, { endDate: { $gte: date } }] }
  ]
});

module.exports = { activeAdsOn, validateAdSchedule };
