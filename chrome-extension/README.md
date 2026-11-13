# ChatGPT Image Archive Chrome Extension

This extension detects sufficiently large OpenAI-hosted images on ChatGPT pages and sends them to your archive API.

## Install locally
1. Open Chrome and visit `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `chrome-extension` folder.
4. Click the extension icon and configure the HTTPS API endpoint and capture API key.

The API endpoint and key must be configured on the server side as well. Do not put a Telegram bot token or Supabase secret key in this extension.

## Notes
- Image host detection is deliberately restrictive to reduce accidental captures.
- The extension stores detected source URLs in memory to avoid duplicate uploads during the current page session.
- This is a local development extension; it is not yet published to the Chrome Web Store.
