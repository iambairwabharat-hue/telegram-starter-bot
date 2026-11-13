const DEFAULT_ENDPOINT = "https://bot-bharatgptimagebot.fadehost.app/capture";
const DEFAULT_KEY = "MT-TEST-ARCHIVE-2026-7xQ9pL2v";

const endpointInput = document.getElementById("endpoint");
const keyInput = document.getElementById("key");
const status = document.getElementById("status");

// Seed defaults on first install, then use saved values.
chrome.storage.local.get(["endpoint", "key"], (settings) => {
  const endpoint = settings.endpoint || DEFAULT_ENDPOINT;
  const key = settings.key || DEFAULT_KEY;
  endpointInput.value = endpoint;
  keyInput.value = key;
  if (!settings.endpoint || !settings.key) {
    chrome.storage.local.set({ endpoint, key });
  }
});

document.getElementById("save").addEventListener("click", () => {
  const apiUrl = endpointInput.value.trim();
  const apiKey = keyInput.value.trim();
  if (!apiUrl.startsWith("https://") || !apiUrl.endsWith("/capture") || !apiKey) {
    status.textContent = "Endpoint must be HTTPS and end in /capture; API key is required.";
    return;
  }
  chrome.storage.local.set({ endpoint: apiUrl, key: apiKey }, () => {
    status.textContent = "Settings saved.";
  });
});
