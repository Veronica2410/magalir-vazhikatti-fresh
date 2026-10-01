require('dotenv').config();
const express = require('express');
const path = require('path');
const { SCHEMES, LANGS, buildSystem } = require('./scheme');

const app = express();
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/ask', async (req, res) => {
  const question = String(req.body.question || '').trim().slice(0, 500);
  const scheme = SCHEMES[req.body.scheme] ? req.body.scheme : 'magalir';
  const lang = LANGS[req.body.lang] ? req.body.lang : 'ta';
  if (!question) return res.status(400).json({ error: 'empty' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'missing_key' });
  try {
    const send = cfg => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystem(scheme, lang) }] },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        generationConfig: cfg
      })
    });
    let r = await send({ temperature: 0.3, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } });
    let d = await r.json();
    if (!r.ok && /think/i.test(d.error?.message || '')) {
      r = await send({ temperature: 0.3, maxOutputTokens: 4096 });
      d = await r.json();
    }
    if (!r.ok) return res.status(502).json({ error: d.error?.message || 'gemini_error' });
    const answer = (d.candidates?.[0]?.content?.parts || []).map(p => p.text).join('').trim();
    res.json({ answer });
  } catch (e) {
    res.status(502).json({ error: 'network' });
  }
});

const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview';
function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
app.post('/api/tts', async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 1500);
  if (!text || !process.env.GEMINI_API_KEY) return res.status(400).end();
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } }
      })
    });
    const d = await r.json();
    const b64 = d.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!r.ok || !b64) { console.error('TTS failed:', d.error?.message || 'no audio'); return res.status(502).end(); }
    res.type('audio/wav').send(wav(Buffer.from(b64, 'base64')));
  } catch (e) { console.error('TTS error:', e.message); res.status(502).end(); }
});

app.get('/api/test', async (req, res) => {
  const out = { key_loaded: !!process.env.GEMINI_API_KEY, model: MODEL, voice_model: TTS_MODEL };
  if (!out.key_loaded) return res.json({ ...out, problem: 'GEMINI_API_KEY is empty. Check the .env file and restart npm start.' });
  const call = async (model, body) => {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body: JSON.stringify(body)
    });
    const d = await r.json();
    return r.ok ? 'OK' : (d.error?.message || 'failed');
  };
  try {
    out.text_test = await call(MODEL, { contents: [{ parts: [{ text: 'Say hi' }] }] });
    out.voice_test = await call(TTS_MODEL, { contents: [{ parts: [{ text: 'vanakkam' }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } } });
  } catch (e) { out.problem = e.message; }
  res.json(out);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Open http://localhost:${PORT}`));
