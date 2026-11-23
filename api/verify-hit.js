// Vergelijkt een foto (op afstand, bewogen, voor/achter) met een signalementsomschrijving.
// Focust op kleding en bouw — niet op gezichtsherkenning.
// Geeft { match: boolean, confidence: number, reason: string } terug.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { shotBase64, signalement } = req.body || {};
    if (!shotBase64 || !signalement) {
      return res.status(400).json({ error: 'shotBase64 en signalement zijn verplicht' });
    }

    const shotBase64Clean = shotBase64.replace(/^data:image\/\w+;base64,/, '');

    // Bouw een leesbare signalementsomschrijving
    const sigText = [
      signalement.lengte ? `Lengte: ${signalement.lengte}` : null,
      (signalement.bovenKleur && signalement.bovenType) ? `Bovenkledij: ${signalement.bovenKleur} ${signalement.bovenType}` : null,
      (signalement.onderKleur && signalement.onderType) ? `Onderkledij: ${signalement.onderKleur} ${signalement.onderType}` : null,
      (signalement.hoofd && signalement.hoofd !== 'geen') ? `Hoofddeksel: ${signalement.hoofd}` : null,
      (signalement.baard && signalement.baard !== 'geen') ? `Gezichtsbeharing: ${signalement.baard}` : null,
      signalement.huid ? `Huidskleur: ${signalement.huid}` : null,
    ].filter(Boolean).join(', ');

    const prompt = `Je bent een assistent voor een buitenspel. Een speler heeft iemand gefotografeerd en claimt dat dit hun doelwit is.

Signalementsomschrijving van het doelwit:
${sigText}

Bekijk de foto en beoordeel of de persoon op de foto overeenkomt met dit signalement.

BELANGRIJK:
- De foto kan van ver zijn (5–25 meter), bewogen, of van achteren — dat is normaal
- Kijk ALLEEN naar kleding (kleur, type), lichaamsbouw en eventueel zichtbare kenmerken
- Gezichtsherkenning is NIET nodig en NIET verwacht
- Wees realistisch: als de kleding duidelijk matcht is dat genoeg
- Als de foto te onduidelijk is om te beoordelen, geef confidence laag maar geef een eerlijk oordeel

Geef je antwoord ALLEEN als JSON (geen extra tekst):
{"match": true/false, "confidence": 0.0-1.0, "reason": "1-2 zinnen uitleg in het Nederlands over wat je ziet"}`;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: shotBase64Clean } },
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
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { match: false, confidence: 0, reason: 'Parse fout' };

    res.status(200).json(result);
  } catch (err) {
    console.error('verify-hit error:', err);
    res.status(500).json({ error: err.message });
  }
};
