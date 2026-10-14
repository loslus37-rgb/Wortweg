# Stimmen erzeugen

`tts.cjs` spricht alle Wörter und Sätze der App mit Azure-KI-Stimmen ein und legt sie als `audio/<sprache>/<schlüssel>.mp3` ab. Der Schlüssel ist derselbe Hash, den die App in `audioKey()` berechnet. `texts.json` enthält alle Texte und wird mit `gen-texts.cjs` neu erzeugt, wenn sich die Kursinhalte ändern.

    AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=westeurope node tools/tts.cjs audio en fr ru ko ja

Bereits vorhandene Dateien werden übersprungen, das Skript kann also jederzeit erneut laufen. Am Ende schreibt es `audio/manifest.json`; erst dann spielt die App die Aufnahmen ab. Fehlt eine Aufnahme, nimmt die App die Gerätestimme.
