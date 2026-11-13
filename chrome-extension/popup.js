const endpoint = document.getElementById("endpoint");
const key = document.getElementById("key");
const status = document.getElementById("status");

chrome.storage.local.get(["endpoint", "key"], (settings) => {
  endpoint.value = settings.endpoint || "";
  key.value = settings.key || "";
});

document.getElementById("save").addEventListener("click", () => {
  const apiUrl = endpoint.value.trim();
  const apiKey = key.value.trim();
  if (!apiUrl.startsWith("https://") || !apiUrl.endsWith("/capture") || !apiKey) {
    status.textContent = "Enter an HTTPS endpoint ending in /capture and an API key.";
    return;
  }
  chrome.storage.local.set({ endpoint: apiUrl, key: apiKey }, () => {
    status.textContent = "Settings saved.";
  });
});