// Collect every text the app speaks, per language, with the same key the app uses
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + __dirname + '/test/page.html');
  const out = await p.evaluate(() => { const r = {}; for (const l in COURSES) { const m = {}; COURSES[l].units.forEach(u => { u.words.forEach(w => { const t = speechText(w[0], l); m[audioKey(t)] = t; }); u.sents.forEach(s => { const t = speechText(s[0], l); m[audioKey(t)] = t; }); }); r[l] = m; } return r; });
  require('fs').writeFileSync(__dirname + '/tts/texts.json', JSON.stringify(out));
  for (const l in out) console.log(l, Object.keys(out[l]).length, Object.values(out[l]).reduce((a, t) => a + t.length, 0));
  await b.close(); })();
