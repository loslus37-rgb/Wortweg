// Synthesize every Wortweg text with Azure neural voices into audio/<lang>/<key>.mp3
// Usage: AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=westeurope node tts.cjs <outDir> [lang ...]
// Free tier (F0) allows 20 requests per minute, so texts are spoken in batches separated by
// long pauses and the result is cut at the silences. Batches that do not split cleanly are
// redone one text at a time. Already existing files are skipped, so the script can be rerun.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const KEY = process.env.AZURE_SPEECH_KEY, REGION = process.env.AZURE_SPEECH_REGION || 'westeurope';
const OUT = process.argv[2], LANGS = process.argv.slice(3).length ? process.argv.slice(3) : ['en', 'fr', 'ru', 'ko', 'ja'];
const VOICES = { en: ['en-US', 'en-US-AvaNeural'], fr: ['fr-FR', 'fr-FR-DeniseNeural'], ru: ['ru-RU', 'ru-RU-SvetlanaNeural'], ko: ['ko-KR', 'ko-KR-SunHiNeural'], ja: ['ja-JP', 'ja-JP-NanamiNeural'] };
const BATCH = +(process.env.TTS_BATCH || 30), PER_MIN = +(process.env.TTS_PER_MIN || 18), PAUSE = 1500;
const TMP = fs.mkdtempSync('/tmp/tts-');
if (!KEY || !OUT) { console.error('AZURE_SPEECH_KEY and outDir required'); process.exit(1); }
const texts = require(path.join(__dirname, 'texts.json'));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let stamps = [];
async function throttle(){
  for (;;) { const now = Date.now(); stamps = stamps.filter(t => now - t < 61000); if (stamps.length < PER_MIN) { stamps.push(now); return; } await new Promise(r => setTimeout(r, 61000 - (now - stamps[0]))); }
}
async function synth(lang, items){
  const [xl, voice] = VOICES[lang];
  const body = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${xl}"><voice name="${voice}"><prosody rate="-8%">` +
    items.map(esc).join(`<break time="${PAUSE}ms"/>`) + '</prosody></voice></speak>';
  for (let attempt = 0; attempt < 6; attempt++) {
    await throttle();
    const r = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: 'POST', body,
      headers: { 'Ocp-Apim-Subscription-Key': KEY, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm', 'User-Agent': 'wortweg' } });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const wait = r.status === 429 ? (+(r.headers.get('retry-after') || 30)) * 1000 : 5000 * (attempt + 1);
    console.error(`  HTTP ${r.status} ${(await r.text()).slice(0, 120)}; retry in ${wait / 1000}s`);
    if (r.status === 401 || r.status === 403) throw new Error('Azure key rejected');
    await new Promise(res => setTimeout(res, wait));
  }
  throw new Error('synthesis failed');
}
// Returns [start, end] seconds of each spoken part, split at pauses of at least 0.9 s
function parts(wav){
  const err = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${wav}" -af silencedetect=noise=-45dB:d=0.9 -f null - 2>&1`]).toString();
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString().trim();
  const starts = [...err.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]), ends = [...err.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
  const segs = []; let cur = 0;
  starts.forEach((s, i) => { if (s > cur + 0.05) segs.push([cur, s]); cur = ends[i] ?? dur; });
  if (cur < dur - 0.05) segs.push([cur, dur]);
  return segs;
}
function cut(wav, seg, file){
  const a = Math.max(0, seg[0] - 0.12), d = seg[1] - seg[0] + 0.3;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', a.toFixed(3), '-t', d.toFixed(3), '-i', wav, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '40k', file]);
}
(async () => {
  for (const lang of LANGS) {
    const dir = path.join(OUT, lang); fs.mkdirSync(dir, { recursive: true });
    const todo = Object.entries(texts[lang]).filter(([k]) => !fs.existsSync(path.join(dir, k + '.mp3')));
    console.log(`${lang}: ${todo.length} of ${Object.keys(texts[lang]).length} to do`);
    for (let i = 0; i < todo.length; i += BATCH) {
      const batch = todo.slice(i, i + BATCH), wav = path.join(TMP, 'b.wav');
      fs.writeFileSync(wav, await synth(lang, batch.map(x => x[1])));
      const segs = parts(wav);
      if (segs.length === batch.length) batch.forEach(([k], j) => cut(wav, segs[j], path.join(dir, k + '.mp3')));
      else {
        console.log(`  batch ${i}: ${segs.length} parts for ${batch.length} texts, doing them one by one`);
        for (const [k, t] of batch) { fs.writeFileSync(wav, await synth(lang, [t])); const s = parts(wav); cut(wav, [s[0][0], s[s.length - 1][1]], path.join(dir, k + '.mp3')); }
      }
      process.stdout.write(`  ${lang} ${Math.min(i + BATCH, todo.length)}/${todo.length}\n`);
    }
  }
  const manifest = {}; for (const l of Object.keys(VOICES)) { const d = path.join(OUT, l); if (fs.existsSync(d) && fs.readdirSync(d).length >= Object.keys(texts[l]).length * 0.98) manifest[l] = VOICES[l][1]; }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest)); console.log('manifest', manifest);
})().catch(e => { console.error(e.message); process.exit(1); });
