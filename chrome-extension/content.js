(() => {
  console.info("[Image Archive] Content script active on", location.href);
  const seen = new Set();
  const MIN_DIMENSION = 300;

  function candidateImage(img) {
    const source = img?.currentSrc || img?.src;
    if (!source || !img.complete || img.naturalWidth < MIN_DIMENSION || img.naturalHeight < MIN_DIMENSION) return false;
    let url;
    try { url = new URL(source); } catch { return false; }
    const host = url.hostname.toLowerCase();
    const blobFromChatGPT = url.protocol === "blob:" && url.href.startsWith("blob:https://chatgpt.com/");
    const allowed = blobFromChatGPT ||
      host === "oaiusercontent.com" || host.endsWith(".oaiusercontent.com") ||
      host === "openai.com" || host.endsWith(".openai.com") ||
      host === "oaistatic.com" || host.endsWith(".oaistatic.com") ||
      (host === "chatgpt.com" && url.pathname.includes("/backend-api/"));
    console.info("[Image Archive] Image inspected:", url.protocol, host || "(blob origin)", img.naturalWidth + "x" + img.naturalHeight, "allowed:", allowed);
    return allowed;
  }

  function imageToDataUrl(img) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context unavailable");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) { reject(error); }
    });
  }

  async function archive(img) {
    const source = img?.currentSrc || img?.src;
    if (!source || seen.has(source) || !candidateImage(img)) return;
    seen.add(source);
    try {
      console.info("[Image Archive] Converting image for archive…");
      const imageData = await imageToDataUrl(img);
      console.info("[Image Archive] Sending image to extension service worker…");
      chrome.runtime.sendMessage({ type: "ARCHIVE_IMAGE", imageData }, (result) => {
        if (chrome.runtime.lastError || !result?.ok) {
          console.warn("[Image Archive] Capture failed:", result?.error || chrome.runtime.lastError?.message);
          seen.delete(source);
        } else console.info("[Image Archive] Archived successfully:", result.result);
      });
    } catch (error) {
      console.warn("[Image Archive] Image conversion failed:", error.message);
      seen.delete(source);
    }
  }

  function scan(root = document) {
    if (root instanceof HTMLImageElement) archive(root);
    root.querySelectorAll?.("img").forEach(archive);
  }

  scan();
  document.addEventListener("load", (event) => {
    if (event.target instanceof HTMLImageElement) archive(event.target);
  }, true);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => { if (node.nodeType === Node.ELEMENT_NODE) scan(node); });
      if (record.type === "attributes" && record.target instanceof HTMLImageElement) archive(record.target);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "srcset"] });

  // ChatGPT sometimes loads generated-image blobs after the initial DOM mutations.
  // Periodic scanning catches those late-loaded images; seen prevents duplicate uploads.
  setInterval(() => scan(), 2500);
})();