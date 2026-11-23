const { put } = require('@vercel/blob');

// Maximale bestandsgrootte: 4MB (base64 → ~3MB foto)
const MAX_SIZE = 4 * 1024 * 1024;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, lobbyCode, playerNumber } = req.body || {};
    if (!imageBase64 || !lobbyCode || !playerNumber) {
      return res.status(400).json({ error: 'imageBase64, lobbyCode en playerNumber zijn verplicht' });
    }

    // Strip data URI prefix indien aanwezig
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > MAX_SIZE) {
      return res.status(413).json({ error: 'Foto te groot (max 4MB)' });
    }

    const filename = `hunter/${lobbyCode}/${playerNumber}-selfie.jpg`;
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/jpeg',
      addRandomSuffix: false,
    });

    res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error('upload-photo error:', err);
    res.status(500).json({ error: err.message });
  }
};
