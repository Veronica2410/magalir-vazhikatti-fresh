const $ = id => document.getElementById(id);
const mic = $('mic'), statusEl = $('status'), box = $('answerBox'), ans = $('answer');
let scheme = 'magalir', lang = 'ta', lastAnswer = '', rec = null;
const VOICE = { ta: 'ta-IN', hi: 'hi-IN', en: 'en-IN' };
const QUESTIONS = {
  ta: ['இந்த திட்டம் என்ன?', 'யார் விண்ணப்பிக்கலாம்?', 'என்ன ஆவணங்கள் வேண்டும்?', 'எங்கே விண்ணப்பிக்க வேண்டும்?'],
  hi: ['यह योजना क्या है?', 'कौन आवेदन कर सकता है?', 'कौन से दस्तावेज़ चाहिए?', 'कहाँ आवेदन करें?'],
  en: ['What is this scheme?', 'Who can apply?', 'Which documents do I need?', 'Where do I apply?']
};
const MSG = {
  ta: { idle: ['மீண்டும் பேச அழுத்துங்கள்', 'Press to ask again'], listen: ['கேட்கிறேன்... பேசுங்கள்', 'Listening... speak now'], think: ['யோசிக்கிறேன்...', 'Thinking...'], speak: ['பதில் சொல்கிறேன்...', 'Speaking...'], fail: ['மன்னிக்கவும், மீண்டும் முயற்சி செய்யுங்கள்', 'Something went wrong. Try again.'], key: ['API key இல்லை (.env கோப்பைப் பாருங்கள்)', 'Missing API key in .env'], nohear: ['சரியாகக் கேட்கவில்லை. மீண்டும் அழுத்துங்கள்', 'Could not hear. Press again.'], novoice: ['இந்த உலாவியில் குரல் இல்லை. Chrome பயன்படுத்துங்கள் அல்லது எழுதுங்கள்', 'Voice needs Chrome. You can type.'] }
};
const t = k => MSG.ta[k];

function setStatus([a, b], cls = '') { statusEl.innerHTML = `${a}<br><small>${b}</small>`; mic.className = 'mic ' + cls; }

function renderChips() {
  $('chips').innerHTML = '';
  QUESTIONS[lang].forEach(q => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = q;
    b.onclick = () => ask(q); $('chips').appendChild(b);
  });
}
function pick(groupId, attr, cb) {
  $(groupId).onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    [...$(groupId).children].forEach(x => x.classList.toggle('on', x === b));
    cb(b.dataset[attr]);
  };
}
pick('schemes', 's', v => { scheme = v; box.hidden = true; speechSynthesis.cancel(); if (audio) audio.pause(); ei = -1; ea = []; renderElig(); });
pick('langs', 'l', v => { lang = v; renderChips(); if (rec) rec.lang = VOICE[lang]; });
renderChips();

async function ask(question) {
  speechSynthesis.cancel(); if (audio) audio.pause();
  setStatus(t('think'), 'busy');
  note('⏳ ' + t('think')[0]);
  try {
    const r = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, scheme, lang }) });
    const d = await r.json();
    if (!r.ok || !d.answer) throw new Error(d.error || 'error');
    note('');
    lastAnswer = d.answer; ans.textContent = d.answer; box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    speak(d.answer);
  } catch (e) { const m = e.message === 'missing_key' ? t('key') : t('fail'); setStatus(m); note('⚠ ' + m[0] + ' — ' + e.message); }
}

let audio = null;
async function speak(text) {
  if (audio) { audio.pause(); audio = null; }
  setStatus(t('speak'), 'busy');
  try {
    const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!r.ok) throw new Error('tts');
    audio = new Audio(URL.createObjectURL(await r.blob()));
    audio.onended = () => setStatus(t('idle'));
    await audio.play();
  } catch (e) { browserSpeak(text); }
}
function browserSpeak(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = VOICE[lang];
  const v = speechSynthesis.getVoices().find(v => v.lang.startsWith(lang));
  if (v) u.voice = v;
  u.onend = () => setStatus(t('idle'));
  speechSynthesis.speak(u);
}
speechSynthesis.onvoiceschanged = () => {};
$('replay').onclick = () => lastAnswer && speak(lastAnswer);
$('textForm').onsubmit = e => { e.preventDefault(); const v = $('textInput').value.trim(); if (v) ask(v); };

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR) { mic.onclick = () => setStatus(t('novoice')); }
else {
  rec = new SR(); rec.lang = VOICE[lang]; rec.interimResults = false;
  rec.onstart = () => setStatus(t('listen'), 'listening');
  rec.onresult = e => ask(e.results[0][0].transcript);
  rec.onerror = () => setStatus(t('nohear'));
  mic.onclick = () => { speechSynthesis.cancel(); try { rec.start(); } catch (e) { rec.stop(); } };
}

$('statusHelp').onclick = () => ask({ ta: 'என் விண்ணப்ப நிலையை எப்படிச் சரிபார்ப்பது?', hi: 'मैं अपना आवेदन स्टेटस कैसे देखूँ?', en: 'How do I check my application status?' }[lang]);

function note(txt) { $('msg').textContent = txt; }

// ---- In-app eligibility check (indicative only; no ID numbers are collected)
const ELIG = [
  { ta: 'நீங்கள் குடும்பத் தலைவி ஆ? (குடும்ப அட்டையில் உங்கள் பெயர் உள்ளதா?)', en: 'Are you the woman head of the family (name on the family card)?', ok: true },
  { ta: 'உங்கள் குடும்பத்தின் ஆண்டு வருமானம் 2.5 லட்சத்துக்குக் குறைவா?', en: 'Is your family income below ₹2.5 lakh a year?', ok: true },
  { ta: 'உங்கள் குடும்பத்தின் நிலம் 5 ஏக்கர் நன்செய் அல்லது 10 ஏக்கர் புன்செய்க்குள் உள்ளதா?', en: 'Is your family land within 5 acres wet or 10 acres dry?', ok: true },
  { ta: 'உங்கள் குடும்பம் ஆண்டுக்கு 3,600 யூனிட்டுக்குக் குறைவாக மின்சாரம் பயன்படுத்துகிறதா?', en: 'Does your family use less than 3,600 units of electricity a year?', ok: true },
  { ta: 'குடும்பத்தில் யாராவது அரசு வேலையில் இருக்கிறார்களா, அல்லது வருமான வரி கட்டுகிறார்களா?', en: 'Does anyone in the family have a government job or pay income tax?', ok: false }
];
let ei = -1, ea = [];
function renderElig(say) {
  const el = $('eligBox');
  if (scheme !== 'magalir') {
    el.innerHTML = '<p>ஆயுஷ்மான் பாரத் தகுதி அரசின் பட்டியலைப் பொறுத்தது. கேள்விகளால் சொல்ல முடியாது. ஆதார் மற்றும் குடும்ப அட்டையுடன் அரசு மருத்துவமனையில் உறுதி செய்யுங்கள்.<br><small>PM-JAY eligibility depends on a government list, so questions cannot decide it. Confirm at a government hospital with your Aadhaar and family card.</small></p>';
    return;
  }
  if (ei < 0) {
    el.innerHTML = '<p>5 எளிய கேள்விகள். எண்கள் எதுவும் தேவையில்லை.<br><small>5 simple questions. No ID numbers needed.</small></p><button class="go" id="eStart" type="button">தொடங்கு <small>Start</small></button>';
    $('eStart').onclick = () => { ei = 0; ea = []; renderElig(true); };
    return;
  }
  if (ei >= ELIG.length) {
    const bad = ELIG.some((q, i) => ea[i] !== q.ok);
    const ta = bad ? 'இந்த விதிகளின்படி தகுதி இல்லாமல் போகலாம். ஆனால் இறுதி முடிவு அரசு அலுவலகத்தில் மட்டுமே.' : 'உங்களுக்குத் தகுதி இருக்கலாம். ஆவணங்களுடன் அருகிலுள்ள அலுவலகத்தில் விண்ணப்பியுங்கள்.';
    const en = bad ? 'You may not qualify under these rules, but only the government office can decide.' : 'You may be eligible. Take your documents to the nearest office.';
    el.innerHTML = `<p class="res ${bad ? 'no' : 'yes'}">${ta}<br><small>${en}</small></p><p><small>This is only a guide. Rules can change, so confirm at the official office.</small></p><div class="yn"><button id="eDocs" type="button">என்ன ஆவணங்கள் வேண்டும்? <small>Documents</small></button><button id="eAgain" type="button">மீண்டும் <small>Again</small></button></div>`;
    $('eDocs').onclick = () => ask(QUESTIONS[lang][2]);
    $('eAgain').onclick = () => { ei = -1; ea = []; renderElig(); };
    speak(ta);
    return;
  }
  const q = ELIG[ei];
  el.innerHTML = `<p class="q"><small>${ei + 1} / ${ELIG.length}</small><br>${q.ta}<br><small>${q.en}</small></p><div class="yn"><button data-a="1" type="button">ஆம் <small>Yes</small></button><button data-a="0" type="button">இல்லை <small>No</small></button></div><button class="help" id="eSay" type="button">🔊 கேள்வியைக் கேட்க <small>Hear it</small></button>`;
  el.querySelectorAll('.yn button').forEach(b => b.onclick = () => { ea.push(b.dataset.a === '1'); ei++; renderElig(true); });
  $('eSay').onclick = () => speak(q.ta);
  if (say) speak(q.ta);
}
renderElig();
