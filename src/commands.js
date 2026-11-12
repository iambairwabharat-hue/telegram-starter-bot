// Telegram command handlers for Bharat's image workflow bot.
import { InlineKeyboard } from "grammy"

const startedAt = Date.now()

export function registerCommands(bot) {
  bot.command("start", (ctx) =>
    ctx.reply("Hi! I'm your Telegram image workflow bot. Send /help to see commands.", {
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
      "/latest — get the latest captured image (image archive not connected yet)",
      "/history — recent captured images (image archive not connected yet)",
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
    ctx.reply(`Bot status: online\nRuntime uptime: ${hours}h ${minutes}m ${seconds}s\nImage archive: not connected yet`)
  })

  bot.command("latest", (ctx) =>
    ctx.reply("The image archive isn't connected yet. Next, we'll connect the Chrome extension to send captured images here."),
  )

  bot.command("history", (ctx) =>
    ctx.reply("No image history is connected yet. We'll add cloud image storage in the next step."),
  )

  bot.callbackQuery("ping", (ctx) => ctx.answerCallbackQuery({ text: "pong" }))

  bot.on("message:text", (ctx) => ctx.reply(ctx.message.text))
}
