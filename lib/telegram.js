
import { config } from "./config.js";

// ==========================================
// TELEGRAM API CORE
// ==========================================

async function telegram(method, payload) {
  if (!config.botToken) {
    throw new Error("BOT_TOKEN belum diatur");
  }

  const endpoint =
    `https://api.telegram.org/bot${config.botToken}/${method}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    throw new Error(
      data.description ||
      `Telegram HTTP ${response.status}`
    );
  }

  return data.result;
}

// ==========================================
// SEND MESSAGE
// ==========================================

export const sendMessage = (
  chatId,
  text,
  replyMarkup = undefined,
  extra = {}
) =>
  telegram("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(replyMarkup
      ? { reply_markup: replyMarkup }
      : {}),
    ...extra
  });

// ==========================================
// SEND PHOTO
// ==========================================

export const sendPhoto = (
  chatId,
  photo,
  caption,
  replyMarkup = undefined
) =>
  telegram("sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: "HTML",
    ...(replyMarkup
      ? { reply_markup: replyMarkup }
      : {})
  });

// ==========================================
// EDIT PHOTO CAPTION
// ==========================================

export const editCaption = (
  chatId,
  messageId,
  caption,
  replyMarkup = undefined
) =>
  telegram("editMessageCaption", {
    chat_id: chatId,
    message_id: messageId,
    caption,
    parse_mode: "HTML",
    ...(replyMarkup
      ? { reply_markup: replyMarkup }
      : {})
  });

// ==========================================
// EDIT TEXT MESSAGE
// ==========================================

export const editMessageText = (
  chatId,
  messageId,
  text,
  replyMarkup = undefined
) =>
  telegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup
      ? { reply_markup: replyMarkup }
      : {})
  });

// ==========================================
// EDIT REPLY MARKUP
// ==========================================

export const editReplyMarkup = (
  chatId,
  messageId,
  replyMarkup = undefined
) =>
  telegram("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    ...(replyMarkup
      ? { reply_markup: replyMarkup }
      : { reply_markup: { inline_keyboard: [] } })
  });

// ==========================================
// ANSWER CALLBACK QUERY
// ==========================================

export const answerCallback = (
  callbackQueryId,
  text = "",
  showAlert = false
) =>
  telegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
    show_alert: showAlert
  });

// ==========================================
// DELETE MESSAGE
// ==========================================

export const deleteMessage = (
  chatId,
  messageId
) =>
  telegram("deleteMessage", {
    chat_id: chatId,
    message_id: messageId
  });

// ==========================================
// CHAT ACTION
// ==========================================

export const sendChatAction = (
  chatId,
  action = "typing"
) =>
  telegram("sendChatAction", {
    chat_id: chatId,
    action
  });

// ==========================================
// GET BOT INFORMATION
// ==========================================

export const getMe = () =>
  telegram("getMe", {});

// ==========================================
// SET BOT COMMANDS
// ==========================================

export const setCommands = () =>
  telegram("setMyCommands", {
    commands: [
      {
        command: "start",
        description: "Membuka menu utama"
      },
      {
        command: "menu",
        description: "Menampilkan menu"
      },
      {
        command: "help",
        description: "Panduan penggunaan bot"
      },
      {
        command: "status",
        description: "Melihat profil dan kuota"
      },
      {
        command: "premium",
        description: "Informasi paket premium"
      },
      {
        command: "cek",
        description: "Memeriksa satu nomor"
      },
      {
        command: "ceklist",
        description: "Memeriksa beberapa nomor"
      }
    ]
  });
  
