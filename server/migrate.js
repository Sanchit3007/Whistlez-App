const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  try {
    const rawData = await mongoose.connection.db.collection('ringtones').find({}).toArray();
    for (let r of rawData) {
      if (typeof r.duration === 'string') {
        let secs = 15;
        const match = r.duration.match(/(\d+):(\d+)/);
        if (match) {
          secs = parseInt(match[1]) * 60 + parseInt(match[2]);
        } else {
           const num = parseInt(r.duration);
           if (!isNaN(num)) secs = num;
        }
        console.log('Migrating', r.name, 'from', r.duration, 'to', secs);
        await mongoose.connection.db.collection('ringtones').updateOne({ _id: r._id }, { $set: { duration: secs } });
      }
    }
    console.log('Migration complete');
  } catch (err) {
    console.error('Save error:', err);
  }
  process.exit(0);
});
