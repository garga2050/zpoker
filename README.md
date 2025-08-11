Z Poker 2.0 — Web version with automatic blind progression and bip sounds

Files:
- index.html
- styles.css
- script.js
- sounds/beep_short.mp3   (placeholder - replace with a short bip)
- sounds/beep_long.mp3    (placeholder - replace with a longer bip)
- README.md

How to use locally:
1. Extract the ZIP and open index.html in a modern browser (Chrome, Safari). For full PWA/install behavior host on HTTPS.
2. Replace the two MP3 files in /sounds with real beep sounds (short and long) to enable audio alerts.

How to publish on GitHub Pages:
1. In your zpoker GitHub repo, click "Add file" → "Upload files".
2. Drag all files (index.html, styles.css, script.js, sounds/) into the upload area.
3. Commit changes.
4. Go to Settings → Pages and set Source to branch 'main' and folder '/' (root). Save.
5. Wait 1-2 minutes and open https://<your-username>.github.io/zpoker/

Notes:
- The app auto-saves structure in localStorage.
- To change beep files: upload replacement mp3s with the same names.

If you want, I can push these files into your repo now — tell me and I'll proceed.
