# Shared synthesis helpers: returns float32 mono numpy + sample rate
import numpy as np, wave, io, os
THREADS = int(os.environ.get('TTS_THREADS', '1'))  # one thread per process, run one process per language
LETTERS = {
 'ru': dict(zip('АБВГДЕЖИКЛМНОПРС', ['а','бэ','вэ','гэ','дэ','е','жэ','и','ка','эль','эм','эн','о','пэ','эр','эс'])),
 'ko': dict(zip('ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅎㅏㅓㅗㅜㅡㅣ', ['기역','니은','디귿','리을','미음','비읍','시옷','이응','지읒','히읗','아','어','오','우','으','이'])),
}
def prep(text, lang):
    return LETTERS.get(lang, {}).get(text, text)
_k = _st = _jag = None; _styles = {}; _piper = {}
def synth(engine, voice, text, lang, speed=0.9):
    global _k, _st, _jag
    text = prep(text, lang)
    if engine == 'kokoro':
        if _k is None:
            import onnxruntime as ort; from kokoro_onnx import Kokoro
            o = ort.SessionOptions(); o.intra_op_num_threads = THREADS
            _k = Kokoro.from_session(ort.InferenceSession('/opt/models/kokoro-v1.0.onnx', o), '/opt/models/voices-v1.0.bin')
        if lang == 'ja':
            if _jag is None:
                from misaki import ja; _jag = ja.JAG2P()
            w, sr = _k.create(_jag(text), voice=voice, speed=speed, is_phonemes=True)
        else:
            w, sr = _k.create(text, voice=voice, speed=speed, lang={'en':'en-us','fr':'fr-fr'}[lang])
        return np.asarray(w, np.float32), sr
    if engine == 'supertonic':
        if _st is None:
            from supertonic import TTS; _st = TTS(model='supertonic-3', intra_op_num_threads=THREADS)
        if voice not in _styles: _styles[voice] = _st.get_voice_style(voice)
        w, _ = _st.synthesize(text, voice_style=_styles[voice], lang=lang, speed=speed, total_steps=10)
        return np.asarray(w, np.float32).squeeze(), _st.sample_rate
    if engine == 'piper':
        if voice not in _piper:
            from piper import PiperVoice; _piper[voice] = PiperVoice.load(f'/opt/models/{voice}.onnx')
        from piper import SynthesisConfig
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wf: _piper[voice].synthesize_wav(text, wf, syn_config=SynthesisConfig(length_scale=1/speed))
        buf.seek(0)
        with wave.open(buf) as wf: sr = wf.getframerate(); w = np.frombuffer(wf.readframes(wf.getnframes()), np.int16) / 32768
        return w.astype(np.float32), sr
FILTER = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,adelay=60,apad=pad_dur=0.12'
def to_mp3(w, sr, path):
    import subprocess
    subprocess.run(['ffmpeg','-loglevel','error','-y','-f','f32le','-ar',str(sr),'-ac','1','-i','-','-af',FILTER,'-ac','1','-ar','24000','-c:a','libmp3lame','-b:a','40k',path], input=w.astype(np.float32).tobytes(), check=True)
