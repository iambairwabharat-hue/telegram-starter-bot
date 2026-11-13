export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const corsOrigin = origin.startsWith("chrome-extension://") ? origin : "*";
    const cors = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "content-type, x-capture-key",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({ status: "running", service: "image-capture-api" }, { headers: cors });
    }
    if (request.method !== "POST" || url.pathname !== "/capture") {
      return Response.json({ error: "Not found" }, { status: 404, headers: cors });
    }
    if (!env.CAPTURE_API_KEY || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID ||
        !env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
      return Response.json({ error: "Capture API is not configured" }, { status: 503, headers: cors });
    }
    if (request.headers.get("x-capture-key") !== env.CAPTURE_API_KEY) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
    }
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("multipart/form-data")) {
      return Response.json({ error: "Expected multipart image upload" }, { status: 415, headers: cors });
    }

    try {
      const form = await request.formData();
      const image = form.get("image");
      if (!(image instanceof File) || !image.type.startsWith("image/")) {
        return Response.json({ error: "No image file found" }, { status: 400, headers: cors });
      }
      if (image.size > 12 * 1024 * 1024) {
        return Response.json({ error: "Image exceeds 12 MB limit" }, { status: 413, headers: cors });
      }

      const bucket = "captured-images";
      const safeName = (image.name || "chatgpt-image.png").replace(/[^a-zA-Z0-9._-]/g, "_");
      const timestamp = Date.now();
      const chatId = String(env.TELEGRAM_CHAT_ID).trim();
      const objectPath = `${chatId}/${timestamp}-${safeName}`;
      const base = env.SUPABASE_URL.replace(/\/$/, "");
      const headers = {
        "Authorization": `Bearer ${env.SUPABASE_SECRET_KEY}`,
        "apikey": env.SUPABASE_SECRET_KEY
      };

      const storageResponse = await fetch(`${base}/storage/v1/object/${bucket}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": image.type, "x-upsert": "false" },
        body: image
      });
      if (!storageResponse.ok) {
        const details = await storageResponse.text();
        console.error("Supabase storage upload failed:", storageResponse.status, details);
        return Response.json({ error: "Supabase storage upload failed", status: storageResponse.status }, { status: 502, headers: cors });
      }

      const dbResponse = await fetch(`${base}/rest/v1/image_archive`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", "Prefer": "return=representation" },
        body: JSON.stringify({ file_path: objectPath, file_name: safeName, chat_id: chatId })
      });
      if (!dbResponse.ok) {
        await fetch(`${base}/storage/v1/object/${bucket}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
          method: "DELETE", headers
        }).catch(() => {});
        const details = await dbResponse.text();
        console.error("Supabase database insert failed:", dbResponse.status, details);
        return Response.json({ error: "Archive database insert failed", status: dbResponse.status }, { status: 502, headers: cors });
      }

      const tgResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: `🖼️ ChatGPT image archived: ${safeName}` })
      });
      if (!tgResponse.ok) {
        console.error("Telegram notification failed:", tgResponse.status, await tgResponse.text());
        return Response.json({ error: "Image archived, but Telegram notification failed" }, { status: 502, headers: cors });
      }

      return Response.json({ ok: true, fileName: safeName }, { status: 201, headers: cors });
    } catch (error) {
      console.error("Capture request failed:", error?.message || error);
      return Response.json({ error: "Could not archive image" }, { status: 500, headers: cors });
    }
  }
};