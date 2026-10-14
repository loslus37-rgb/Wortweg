# Stimmen erzeugen

`tts.py` spricht alle Wörter und Sätze der App mit freien Open-Source-KI-Stimmen ein und legt sie als `audio/<sprache>/<schlüssel>.mp3` ab. Der Schlüssel ist derselbe Hash, den die App in `audioKey()` berechnet. `texts.json` enthält alle Texte und wird mit `gen-texts.cjs` neu erzeugt, wenn sich die Kursinhalte ändern.

Stimmen (alle kostenlos, laufen lokal auf der CPU):

- Englisch: Kokoro-82M, Stimme `af_heart` (Apache-2.0)
- Französisch, Russisch, Koreanisch, Japanisch: Supertonic 3, Stimme `F1`

Einrichtung und Lauf:

    python3 -m venv /opt/tts && /opt/tts/bin/pip install kokoro-onnx supertonic "misaki[ja]" piper-tts soundfile
    # Kokoro-Modell: kokoro-v1.0.onnx und voices-v1.0.bin von github.com/thewh1teagle/kokoro-onnx (Release model-files-v1.0) nach /opt/models
    /opt/tts/bin/python tools/tts.py audio en fr ru ko ja

Bereits vorhandene Dateien werden übersprungen, das Skript kann also jederzeit erneut laufen. Danach trägt `audio/manifest.json` die fertigen Sprachen ein, z. B. `{"en":"kokoro af_heart"}`; erst dann spielt die App die Aufnahmen ab. Fehlt eine Aufnahme, nimmt die App die Gerätestimme.
