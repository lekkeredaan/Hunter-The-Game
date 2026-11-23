// Vergelijkt een gemaakte foto met een referentie-selfie via Claude Vision.
// Geeft { match: boolean, confidence: number, reason: string } terug.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { shotBase64, referenceUrl } = req.body || {};
    if (!shotBase64 || !referenceUrl) {
      return res.status(400).json({ error: 'shotBase64 en referenceUrl zijn verplicht' });
    }

    // Haal referentie-selfie op als base64
    const refResp = await fetch(referenceUrl);
    if (!refResp.ok) throw new Error('Referentiefoto ophalen mislukt');
    const refArrayBuffer = await refResp.arrayBuffer();
    const refBase64 = Buffer.from(refArrayBuffer).toString('base64');
    const refContentType = refResp.headers.get('content-type') || 'image/jpeg';

    // Strip data URI prefix van de schot-foto
    const shotBase64Clean = shotBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Je krijgt twee foto\'s. De eerste is een referentie-selfie van een persoon. De tweede is een foto die zojuist gemaakt is. Zijn dit dezelfde persoon? Let op: kleding hoeft niet exact hetzelfde te zijn, maar lichaamsbouw, gezicht en algemene verschijning moeten overeenkomen. Geef je antwoord ALLEEN als JSON: {"match": true/false, "confidence": 0.0-1.0, "reason": "korte uitleg in het Nederlands"}',
              },
              {
                type: 'image',
                source: { type: 'base64', media_type: refContentType, data: refBase64 },
              },
              {
                type: 'text',
                text: 'Dit is de zojuist gemaakte foto:',
              },
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: shotBase64Clean },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error('Claude API fout: ' + err);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';

    // Parse JSON uit het antwoord (Claude kan soms extra tekst toevoegen)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { match: false, confidence: 0, reason: 'Parse fout' };

    res.status(200).json(result);
  } catch (err) {
    console.error('verify-hit error:', err);
    res.status(500).json({ error: err.message });
  }
};
