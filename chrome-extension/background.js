chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "ARCHIVE_IMAGE" || !message.imageUrl) return;
  (async () => {
    const settings = await chrome.storage.local.get(["endpoint", "key"]);
    if (!settings.endpoint || !settings.key) throw new Error("Set API endpoint and key in the extension popup first.");

    const response = await fetch(message.imageUrl);
    if (!response.ok) throw new Error("Could not fetch image from ChatGPT");
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error("Source is not an image");

    const form = new FormData();
    form.append("image", blob, "chatgpt-image." + (blob.type.split("/")[1] || "png"));
    form.append("source", "chatgpt.com");

    const upload = await fetch(settings.endpoint, {
      method: "POST",
      headers: { "x-capture-key": settings.key },
      body: form
    });
    if (!upload.ok) {
      const details = await upload.json().catch(() => ({}));
      throw new Error(details.error || "Archive endpoint returned " + upload.status);
    }
    return await upload.json();
  })().then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});