(() => {
  const seen = new Set();
  const MIN_DIMENSION = 300;

  function candidateImage(img) {
    if (!img || !img.src || !img.complete || img.naturalWidth < MIN_DIMENSION || img.naturalHeight < MIN_DIMENSION) return false;
    let url;
    try { url = new URL(img.currentSrc || img.src); } catch { return false; }
    const host = url.hostname.toLowerCase();
    // Restrict to OpenAI-hosted image assets to avoid archiving unrelated page imagery.
    return host === "oaiusercontent.com" || host.endsWith(".oaiusercontent.com") ||
      host === "openai.com" || host.endsWith(".openai.com");
  }

  async function archive(img) {
    const source = img.currentSrc || img.src;
    if (seen.has(source) || !candidateImage(img)) return;
    seen.add(source);

    const settings = await chrome.storage.local.get(["endpoint", "key"]);
    if (!settings.endpoint || !settings.key) return;

    try {
      const response = await fetch(source, { credentials: "include" });
      if (!response.ok) throw new Error("Could not fetch image source");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) return;
      const form = new FormData();
      form.append("image", blob, "chatgpt-image." + (blob.type.split("/")[1] || "png"));
      form.append("source", "chatgpt.com");

      const result = await fetch(settings.endpoint, {
        method: "POST",
        headers: { "x-capture-key": settings.key },
        body: form
      });
      if (!result.ok) throw new Error("Archive endpoint returned " + result.status);
      console.info("[Image Archive] Saved generated image.");
    } catch (error) {
      console.warn("[Image Archive] Capture failed:", error.message);
      seen.delete(source);
    }
  }

  function scan(root = document) {
    if (root instanceof HTMLImageElement) archive(root);
    root.querySelectorAll?.("img").forEach(archive);
  }

  scan();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      });
      if (record.type === "attributes" && record.target instanceof HTMLImageElement) archive(record.target);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "srcset"] });
})();