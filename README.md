# Magalir Vazhikatti (மகளிர் வழிகாட்டி)

Voice-first Tamil guide that helps a first-time woman user understand one government scheme (Kalaignar Magalir Urimai Thogai). Built for the Hack2Skill PromptWars x HackArena challenge "The Invisible Woman". Powered by Gemini.

## Run locally
1. Install Node.js 18+.
2. `npm install`
3. Copy `.env.example` to `.env` and paste your Gemini API key (from Google AI Studio). If Google retires a model name, change `GEMINI_MODEL` or `GEMINI_TTS_MODEL` in `.env`.
4. `npm start`, then open http://localhost:3000 in Chrome (needed for voice input).
5. Open http://localhost:3000/api/test to check that your key and models work.

This app needs a Node.js host (for example Render). GitHub Pages cannot run it.

## Edit the scheme
Change the facts in `scheme.js` and verify them on the official government site.

## Push to GitHub
```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo>.git
git push -u origin main
```
`.env` is in `.gitignore`, so your key is never uploaded.
