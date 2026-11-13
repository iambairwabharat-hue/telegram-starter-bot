// Telegram command handlers for Bharat's image workflow bot.
import { InlineKeyboard } from "grammy"
import {
  uploadCapturedImage,
  getLatestImage,
  getImageHistory,
  getSignedImageUrl,
} from "../supabase.js"

const startedAt = Date.now()

export function registerCommands(bot) {
  bot.command("start", (ctx) =>
    ctx.reply("Hi! I'm your Telegram image workflow bot. Send me an image to archive it. Send /help to see commands.", {
      reply_markup: new InlineKeyboard().text("Ping me", "ping"),
    }),
  )

  bot.command("help", (ctx) =>
    ctx.reply([
      "Commands:",
      "/start — start the bot",
      "/help — show commands",
      "/ping — check that I am awake",
      "/id — show chat and user IDs",
      "/status — bot runtime status",
      "/latest — get the latest archived image",
      "/history — recent archived images (up to 10)",
      "",
      "Send a photo or image file here to archive it.",
    ].join("\n")),
  )

  bot.command("ping", (ctx) => ctx.reply("pong"))

  bot.command("id", (ctx) =>
    ctx.reply(`Chat id: ${ctx.chat.id}\nYour id: ${ctx.from?.id ?? "unknown"}`),
  )

  bot.command("status", (ctx) => {
    const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000)
    const hours = Math.floor(uptimeSeconds / 3600)
    const minutes = Math.floor((uptimeSeconds % 3600) / 60)
    const seconds = uptimeSeconds % 60
    return ctx.reply(`Bot status: online\nRuntime uptime: ${hours}h ${minutes}m ${seconds}s\nImage archive: Supabase configured`)
  })

  // Accept Telegram photos and image documents (the latter preserve original quality).
  bot.on(["message:photo", "message:document"], async (ctx) => {
    try {
      const photo = ctx.message.photo?.at(-1)
      const document = ctx.message.document

      if (document && !document.mime_type?.startsWith("image/")) {
        return ctx.reply("That document doesn't appear to be an image. Please send a photo or image file.")
      }

      const fileId = photo?.file_id ?? document?.file_id
      if (!fileId) return ctx.reply("I couldn't identify the image attachment.")

      const file = await ctx.api.getFile(fileId)
      if (!file.file_path) throw new Error("Telegram file path is missing")

      const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`
      const response = await fetch(downloadUrl)
      if (!response.ok) throw new Error(`Telegram image download failed: HTTP ${response.status}`)

      const buffer = Buffer.from(await response.arrayBuffer())
      const fileName = document?.file_name ?? `telegram-${photo?.file_unique_id ?? document?.file_unique_id ?? Date.now()}.jpg`
      const contentType = document?.mime_type ?? "image/jpeg"

      const archived = await uploadCapturedImage({
        buffer,
        fileName,
        chatId: ctx.chat.id,
        contentType,
      })

      return ctx.reply(`Image archived successfully!\nArchive ID: ${archived.id}\nUse /latest or /history to retrieve it.`)
    } catch (error) {
      console.error("[archive] image upload failed:", error)
      return ctx.reply("Image archiving failed. Please check the bot logs.")
    }
  })

  bot.command("latest", async (ctx) => {
    try {
      const image = await getLatestImage(ctx.chat.id)
      if (!image) return ctx.reply("No archived images found in this chat. Send me an image first.")

      const url = await getSignedImageUrl(image.file_path)
      return ctx.replyWithPhoto(url, {
        caption: `Latest archived image\nCaptured: ${new Date(image.captured_at).toLocaleString()}`,
      })
    } catch (error) {
      console.error("[archive] latest failed:", error)
      return ctx.reply("Could not retrieve the latest image. Please check the bot logs.")
    }
  })

  bot.command("history", async (ctx) => {
    try {
      const images = await getImageHistory(ctx.chat.id, 10)
      if (!images.length) return ctx.reply("No image history found in this chat. Send me an image first.")

      await ctx.reply(`Found ${images.length} archived image(s). Sending newest first.`)
      for (const image of images) {
        const url = await getSignedImageUrl(image.file_path)
        await ctx.replyWithPhoto(url, {
          caption: `Archive ID: ${image.id}\nCaptured: ${new Date(image.captured_at).toLocaleString()}`,
        })
      }
    } catch (error) {
      console.error("[archive] history failed:", error)
      return ctx.reply("Could not retrieve image history. Please check the bot logs.")
    }
  })

  bot.callbackQuery("ping", (ctx) => ctx.answerCallbackQuery({ text: "pong" }))

  bot.on("message:text", (ctx) => ctx.reply(ctx.message.text))
}
