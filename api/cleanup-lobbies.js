const admin = require('firebase-admin');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getApp() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const app = getApp();
    const db = app.database();
    const snap = await db.ref('lobbies').once('value');
    const lobbies = snap.val() || {};
    const now = Date.now();

    const toDelete = Object.entries(lobbies)
      .filter(([, lobby]) => {
        const referenceTs = lobby.expiresAt || lobby.ts;
        return referenceTs && now - referenceTs > THIRTY_DAYS_MS;
      })
      .map(([code]) => code);

    await Promise.all(toDelete.map((code) => db.ref('lobbies/' + code).remove()));

    res.status(200).json({ deleted: toDelete, count: toDelete.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
