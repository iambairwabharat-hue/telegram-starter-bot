const endpoint = document.getElementById("endpoint");
const key = document.getElementById("key");
const status = document.getElementById("status");

chrome.storage.local.get(["endpoint", "key"], (settings) => {
  endpoint.value = settings.endpoint || "";
  key.value = settings.key || "";
});

document.getElementById("save").addEventListener("click", async () => {
  const apiUrl = endpoint.value.trim();
  const apiKey = key.value.trim();
  if (!apiUrl.startsWith("https://") || !apiUrl.endsWith("/capture") || !apiKey) {
    status.textContent = "Enter an HTTPS endpoint ending in /capture and an API key.";
    return;
  }

  let origin;
  try { origin = new URL(apiUrl).origin; } catch {
    status.textContent = "Endpoint URL is invalid.";
    return;
  }
  const granted = await chrome.permissions.request({ origins: [origin + "/*"] });
  if (!granted) {
    status.textContent = "Permission to connect to the archive server was not granted.";
    return;
  }
  chrome.storage.local.set({ endpoint: apiUrl, key: apiKey }, () => {
    status.textContent = "Settings saved.";
  });
});