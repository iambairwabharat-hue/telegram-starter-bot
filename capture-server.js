import http from "node:http"
import { uploadCapturedImage } from "./supabase.js"

const MAX_BYTES = 12 * 1024 * 1024

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(body))
}

function parseImageMultipart(body, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2]
  if (!boundary) throw new Error("Missing multipart boundary")
  const delimiter = Buffer.from("--" + boundary)
  let cursor = body.indexOf(delimiter)
  while (cursor !== -1) {
    const next = body.indexOf(delimiter, cursor + delimiter.length)
    if (next === -1) break
    let part = body.subarray(cursor + delimiter.length, next)
    if (part.subarray(0, 2).toString() === "\r\n") part = part.subarray(2)
    const split = part.indexOf(Buffer.from("\r\n\r\n"))
    if (split !== -1) {
      const headers = part.subarray(0, split).toString("utf8")
      let data = part.subarray(split + 4)
      if (data.subarray(-2).toString() === "\r\n") data = data.subarray(0, -2)
      if (/name="image"/i.test(headers)) {
        const fileName = headers.match(/filename="([^"]*)"/i)?.[1] || "chatgpt-image.png"
        const mimeType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "image/png"
        if (!mimeType.startsWith("image/")) throw new Error("Only image uploads are accepted")
        return { buffer: data, fileName, contentType: mimeType }
      }
    }
    cursor = next
  }
  throw new Error("No image field found in upload")
}

export function startCaptureServer(bot) {
  const port = Number(process.env.PORT || 3000)
  const apiKey = (process.env.CAPTURE_API_KEY || "").trim()
  const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim()

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin || ""
    if (origin.startsWith("chrome-extension://")) {
      res.setHeader("access-control-allow-origin", origin)
      res.setHeader("vary", "Origin")
      res.setHeader("access-control-allow-methods", "POST, OPTIONS")
      res.setHeader("access-control-allow-headers", "x-capture-key, content-type")
    }
    if (req.method === "OPTIONS" && req.url === "/capture") {
      res.writeHead(204)
      return res.end()
    }
    if (req.method === "GET" && req.url === "/") {
      return send(res, 200, { status: "running", service: "image-capture-api" })
    }
    if (req.method !== "POST" || req.url !== "/capture") return send(res, 404, { error: "Not found" })
    if (!apiKey || !chatId) return send(res, 503, { error: "Capture API is not configured on the server" })
    if (req.headers["x-capture-key"] !== apiKey) return send(res, 401, { error: "Unauthorized" })
    if (!req.headers["content-type"]?.toLowerCase().startsWith("multipart/form-data")) {
      return send(res, 415, { error: "Expected multipart image upload" })
    }

    const chunks = []
    let total = 0
    req.on("data", (chunk) => {
      total += chunk.length
      if (total > MAX_BYTES) {
        send(res, 413, { error: "Image exceeds 12 MB limit" })
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on("end", async () => {
      if (res.writableEnded) return
      try {
        const parsed = parseImageMultipart(Buffer.concat(chunks), req.headers["content-type"])
        const record = await uploadCapturedImage({ ...parsed, chatId })
        await bot.api.sendMessage(chatId, `🖼️ ChatGPT image archived: ${record.file_name}`)
        send(res, 201, { ok: true, fileName: record.file_name })
      } catch (error) {
        console.error("[capture-api] upload failed:", error?.message ?? error)
        send(res, 500, { error: "Could not archive image" })
      }
    })
  })

  server.listen(port, () => console.log(`[capture-api] listening on port ${port}`))
}
