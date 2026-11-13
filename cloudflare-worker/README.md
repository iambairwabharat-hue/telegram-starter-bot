# Cloudflare Worker image capture API

Deploy this folder as a Cloudflare Worker. Set the following secrets in Worker Settings > Variables and Secrets (mark secret values as Secret):

- CAPTURE_API_KEY: long random value (must match the extension's x-capture-key)
- TELEGRAM_BOT_TOKEN: token from BotFather
- TELEGRAM_CHAT_ID: destination Telegram chat ID
- SUPABASE_URL: project URL
- SUPABASE_SECRET_KEY: Supabase secret/service-role key

The Worker stores image files in the Supabase Storage bucket "captured-images", inserts rows in the "image_archive" table, and sends a Telegram text notification.

Routes:
- GET / : health status
- POST /capture : multipart/form-data field "image"

After deployment, set the extension endpoint to https://<worker-name>.<account-subdomain>.workers.dev/capture and its API key to the CAPTURE_API_KEY value.

Do not commit secrets or publish them in the extension repository. Rotate any keys that have been exposed in a public repository.
