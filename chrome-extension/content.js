(() => {
  const seen = new Set();
  const MIN_DIMENSION = 300;

  function candidateImage(img) {
    if (!img || !img.src || !img.complete || img.naturalWidth < MIN_DIMENSION || img.naturalHeight < MIN_DIMENSION) return false;
    let url;
    try { url = new URL(img.currentSrc || img.src); } catch { return false; }
    const host = url.hostname.toLowerCase();
    return host === "oaiusercontent.com" || host.endsWith(".oaiusercontent.com") ||
      host === "openai.com" || host.endsWith(".openai.com");
  }

  function archive(img) {
    const source = img.currentSrc || img.src;
    if (seen.has(source) || !candidateImage(img)) return;
    seen.add(source);
    chrome.runtime.sendMessage({ type: "ARCHIVE_IMAGE", imageUrl: source }, (result) => {
      if (chrome.runtime.lastError || !result?.ok) {
        console.warn("[Image Archive] Capture failed:", result?.error || chrome.runtime.lastError?.message);
        seen.delete(source);
      } else {
        console.info("[Image Archive] Saved generated image.");
      }
    });
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