// Synthesize every Wortweg text with Google Cloud Text-to-Speech into audio/<lang>/<key>.mp3
// Usage: GOOGLE_TTS_KEY=... node tools/tts-google.cjs audio [lang ...]
// Already existing files are skipped, so the script can be rerun after an interruption.
// Neural2/WaveNet voices are free up to 1 million bytes per month; all texts together are about 0.55 million.
const fs = require('fs'), path = require('path');
const KEY = process.env.GOOGLE_TTS_KEY, OUT = process.argv[2];
const LANGS = process.argv.slice(3).length ? process.argv.slice(3) : ['en', 'fr', 'ru', 'ko', 'ja'];
const CODES = { en: 'en-US', fr: 'fr-FR', ru: 'ru-RU', ko: 'ko-KR', ja: 'ja-JP' };
const WANT = { en: 'en-US-Neural2-F', fr: 'fr-FR-Neural2-A', ru: 'ru-RU-Wavenet-A', ko: 'ko-KR-Neural2-A', ja: 'ja-JP-Neural2-B' };
const PARALLEL = +(process.env.TTS_PARALLEL || 6), API = 'https://texttospeech.googleapis.com/v1';
if (!KEY || !OUT) { console.error('GOOGLE_TTS_KEY and outDir required'); process.exit(1); }
const texts = require(path.join(__dirname, 'texts.json'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Use the wanted voice if this key offers it, otherwise the best female Neural2/WaveNet voice of the language
async function pickVoice(lang){
  const r = await fetch(`${API}/voices?languageCode=${CODES[lang]}&key=${KEY}`);
  if (!r.ok) throw new Error(`voice list ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const vs = ((await r.json()).voices || []).filter(v => v.languageCodes.includes(CODES[lang]));
  const rank = v => (v.name === WANT[lang] ? 0 : /Neural2/.test(v.name) ? 1 : /Wavenet/.test(v.name) ? 2 : 9) * 2 + (v.ssmlGender === 'FEMALE' ? 0 : 1);
  vs.sort((a, b) => rank(a) - rank(b));
  if (!vs.length || rank(vs[0]) >= 18) throw new Error('no neural voice for ' + lang);
  return vs[0].name;
}
async function synth(lang, voice, text){
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(`${API}/text:synthesize?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { text }, voice: { languageCode: CODES[lang], name: voice }, audioConfig: { audioEncoding: 'MP3', speakingRate: 0.92, sampleRateHertz: 24000 } }) });
    if (r.ok) return Buffer.from((await r.json()).audioContent, 'base64');
    const msg = (await r.text()).slice(0, 200);
    if (r.status === 400 || r.status === 401 || r.status === 403) throw new Error(`HTTP ${r.status}: ${msg}`);
    console.error(`  HTTP ${r.status}, retry`); await sleep(3000 * (attempt + 1));
  }
  throw new Error('synthesis failed: ' + text);
}
(async () => {
  const used = {};
  for (const lang of LANGS) {
    const voice = await pickVoice(lang); used[lang] = voice;
    const dir = path.join(OUT, lang); fs.mkdirSync(dir, { recursive: true });
    const todo = Object.entries(texts[lang]).filter(([k]) => !fs.existsSync(path.join(dir, k + '.mp3')));
    console.log(`${lang}: voice ${voice}, ${todo.length} of ${Object.keys(texts[lang]).length} to do`);
    let next = 0, done = 0;
    await Promise.all(Array.from({ length: PARALLEL }, async () => {
      while (next < todo.length) {
        const [k, t] = todo[next++];
        fs.writeFileSync(path.join(dir, k + '.mp3'), await synth(lang, voice, t));
        if (++done % 250 === 0) console.log(`  ${lang} ${done}/${todo.length}`);
      }
    }));
  }
  const mf = path.join(OUT, 'manifest.json'), manifest = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf)) : {};
  for (const l of Object.keys(CODES)) { const d = path.join(OUT, l); if (fs.existsSync(d) && fs.readdirSync(d).length >= Object.keys(texts[l]).length) manifest[l] = used[l] || manifest[l] || 'google'; }
  fs.writeFileSync(mf, JSON.stringify(manifest)); console.log('manifest', manifest);
})().catch(e => { console.error(e.message); process.exit(1); });
