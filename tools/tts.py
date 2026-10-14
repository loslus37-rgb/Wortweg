# Speak every Wortweg text with free open-source voices into audio/<lang>/<key>.mp3
import sys, json, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tts_engines import synth, to_mp3
VOICES = {'en': ('kokoro', 'af_heart'), 'fr': ('supertonic', 'F1'), 'ru': ('supertonic', 'F1'), 'ko': ('supertonic', 'F1'), 'ja': ('supertonic', 'F1')}
out, langs = sys.argv[1], sys.argv[2:]
T = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'texts.json')))
for l in langs:
    e, v = VOICES[l]; d = os.path.join(out, l); os.makedirs(d, exist_ok=True)
    todo = [(k, t) for k, t in T[l].items() if not os.path.exists(os.path.join(d, k + '.mp3'))]
    print(l, len(todo), 'to do', flush=True); t0 = time.time()
    for i, (k, t) in enumerate(todo):
        try:
            w, sr = synth(e, v, t, l); to_mp3(w, sr, os.path.join(d, k + '.mp3'))
        except Exception as ex: print('FAIL', l, k, t, ex, flush=True)
        if i % 250 == 0: print(l, i, len(todo), f'{time.time()-t0:.0f}s', flush=True)
    print(l, 'done', flush=True)
