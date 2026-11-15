
import { config, validateConfig } from "../lib/config.js";

import {
  sendMessage,
  sendPhoto,
  editCaption,
  editMessageText,
  answerCallback
} from "../lib/telegram.js";

import {
  getProfile,
  getUsage,
  consumeQuota,
  grantPremium,
  revokePremium
} from "../lib/database.js";

import { checkNumber } from "../lib/checker.js";
import { externalLookup } from "../lib/providers.js";
import { buildReport } from "../lib/report.js";

// ==========================================
// APP CONFIGURATION
// ==========================================

const APP_URL = (
  process.env.APP_PUBLIC_URL ||
  process.env.VERCEL_URL ||
  ""
).replace(/\/$/, "");

const MENU_IMAGE = APP_URL
  ? `${APP_URL.startsWith("http") ? APP_URL : `https://${APP_URL}`}/menu-banner.png`
  : "";

// ==========================================
// DATE & USER HELPERS
// ==========================================

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

const isAdmin = id =>
  config.admins.includes(String(id));

const isPremium = profile =>
  Boolean(
    profile?.premium_until &&
    new Date(profile.premium_until) > new Date()
  );

const esc = value =>
  String(value ?? "-").replace(
    /[&<>]/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;"
    }[c])
  );

// ==========================================
// TELEGRAM KEYBOARDS
// ==========================================

const mainKeyboard = {
  inline_keyboard: [
    [
      {
        text: "🔎 Cek Satu Nomor",
        callback_data: "menu:single"
      },
      {
        text: "📋 Cek Massal",
        callback_data: "menu:bulk"
      }
    ],
    [
      {
        text: "👤 Profil & Kuota",
        callback_data: "menu:status"
      },
      {
        text: "⭐ Premium",
        callback_data: "menu:premium"
      }
    ],
    [
      {
        text: "📖 Bantuan",
        callback_data: "menu:help"
      },
      {
        text: "🔄 Menu Utama",
        callback_data: "menu:home"
      }
    ]
  ]
};

const backKeyboard = {
  inline_keyboard: [
    [
      {
        text: "⬅️ Menu Utama",
        callback_data: "menu:home"
      }
    ]
  ]
};

// ==========================================
// EDIT MENU - SUPPORT TEXT & PHOTO
// ==========================================

async function editMenu(
  chatId,
  messageId,
  content,
  keyboard = backKeyboard
) {
  try {
    return await editCaption(
      chatId,
      messageId,
      content,
      keyboard
    );
  } catch (error) {
    const message = String(error?.message || error);

    if (
      /message is not a photo|there is no caption|message to edit not found/i.test(
        message
      )
    ) {
      return editMessageText(
        chatId,
        messageId,
        content,
        keyboard
      );
    }

    throw error;
  }
}

// ==========================================
// HOME MENU
// ==========================================

async function showHome(chatId, messageId = null) {
  const caption = [
    "🟢 <b>WHATSAPP NUMBER CHECKER V2</b>",
    "",
    "Selamat datang!",
    "Pilih fitur melalui tombol di bawah.",
    "",
    "<b>Fitur tersedia:</b>",
    "• Validasi format nomor telepon",
    "• Informasi nomor dan negara",
    "• Pemeriksaan satu nomor",
    "• Pemeriksaan nomor secara massal",
    "• Profil dan kuota pengguna",
    "• Sistem FREE dan PREMIUM",
    "",
    "<i>Catatan: Validasi nomor bukan bukti bahwa nomor terdaftar atau aktif di WhatsApp.</i>"
  ].join("\n");

  if (messageId) {
    return editMenu(
      chatId,
      messageId,
      caption,
      mainKeyboard
    );
  }

  if (!MENU_IMAGE) {
    return sendMessage(
      chatId,
      caption,
      mainKeyboard
    );
  }

  return sendPhoto(
    chatId,
    MENU_IMAGE,
    caption,
    mainKeyboard
  );
}

// ==========================================
// NUMBER CHECK PROCESS
// ==========================================

async function processCheck(input) {
  const local = checkNumber(input);

  if (!local.valid) {
    return buildReport(local, null);
  }

  let external = {
    success: false,
    source: "LOCAL_ONLY"
  };

  try {
    external = await externalLookup(local.e164);
  } catch (error) {
    console.error(
      "External lookup failed:",
      error.message
    );
  }

  return buildReport(local, external);
}

// ==========================================
// USER PROFILE & QUOTA
// ==========================================

async function showStatus(chatId, messageId, user) {
  const profile = await getProfile(user);

  const used = await getUsage(
    user.id,
    todayJakarta()
  );

  const admin = isAdmin(user.id);
  const premium = isPremium(profile);

  const limit =
    admin || premium
      ? config.premiumLimit
      : config.freeLimit;

  const remaining = Math.max(0, limit - used);

  const caption = [
    "👤 <b>PROFIL AKUN</b>",
    "",
    `ID Telegram: <code>${user.id}</code>`,
    `Nama: ${esc(user.first_name)}`,
    `Username: ${esc(user.username ? `@${user.username}` : "-")}`,
    "",
    `Paket: <b>${admin ? "ADMIN" : premium ? "PREMIUM" : "FREE"}</b>`,
    `Pemakaian hari ini: <b>${used}/${limit}</b>`,
    `Sisa kuota: <b>${remaining}</b>`,
    "",
    `Premium sampai: ${esc(profile?.premium_until || "-")}`
  ].join("\n");

  return editMenu(
    chatId,
    messageId,
    caption,
    backKeyboard
  );
}

// ==========================================
// CALLBACK HANDLER
// ==========================================

async function handleCallback(query) {
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const user = query.from;

  if (!chatId || !messageId) {
    return answerCallback(
      query.id,
      "Pesan menu tidak tersedia.",
      true
    );
  }

  const action = query.data || "menu:home";

  await answerCallback(query.id);

  // HOME
  if (action === "menu:home") {
    return showHome(chatId, messageId);
  }

  // PROFILE
  if (action === "menu:status") {
    return showStatus(chatId, messageId, user);
  }

  // SINGLE CHECK
  if (action === "menu:single") {
    await editMenu(
      chatId,
      messageId,
      [
        "🔎 <b>CEK SATU NOMOR</b>",
        "",
        "Kirim satu nomor yang ingin divalidasi.",
        "",
        "Contoh:",
        "<code>628123456789</code>",
        "",
        "<i>Gunakan kode negara tanpa tanda +.</i>"
      ].join("\n"),
      backKeyboard
    );

    return sendMessage(
      chatId,
      "Kirim satu nomor yang ingin divalidasi:",
      {
        force_reply: true,
        selective: true
      }
    );
  }

  // BULK CHECK
  if (action === "menu:bulk") {
    await editMenu(
      chatId,
      messageId,
      [
        "📋 <b>CEK NOMOR MASSAL</b>",
        "",
        `Maksimal <b>${config.maxBatchSize}</b> nomor.`,
        "",
        "Kirim satu nomor per baris.",
        "",
        "Contoh:",
        "<code>628123456789",
        "628987654321</code>",
        "",
        "<i>Nomor duplikat akan diperiksa satu kali.</i>"
      ].join("\n"),
      backKeyboard
    );

    return sendMessage(
      chatId,
      "Kirim daftar nomor satu per baris:",
      {
        force_reply: true,
        selective: true
      }
    );
  }

  // PREMIUM
  if (action === "menu:premium") {
    return editMenu(
      chatId,
      messageId,
      [
        "⭐ <b>PAKET PREMIUM</b>",
        "",
        `FREE: <b>${config.freeLimit}</b> pemeriksaan/hari`,
        `PREMIUM: <b>${config.premiumLimit}</b> pemeriksaan/hari`,
        `Batas batch: <b>${config.maxBatchSize}</b> nomor`,
        "",
        "Keuntungan Premium:",
        "• Kuota pemeriksaan lebih besar",
        "• Pemeriksaan massal",
        "",
        "Hubungi admin untuk aktivasi.",
        "<i>Pembayaran belum diproses otomatis oleh bot.</i>"
      ].join("\n"),
      backKeyboard
    );
  }

  // HELP
  if (action === "menu:help") {
    return editMenu(
      chatId,
      messageId,
      [
        "📖 <b>PANDUAN PENGGUNAAN</b>",
        "",
        "<b>1. Cek satu nomor</b>",
        "Gunakan tombol Cek Satu Nomor.",
        "",
        "<b>2. Cek massal</b>",
        "Kirim beberapa nomor, satu nomor per baris.",
        "",
        "<b>3. Profil</b>",
        "Lihat paket dan sisa kuota.",
        "",
        "<b>4. Premium</b>",
        "Hubungi admin untuk aktivasi.",
        "",
        "<b>Catatan penting:</b>",
        "• Format valid bukan bukti nomor aktif di WhatsApp.",
        "• Bot tidak dapat memastikan nomor terdaftar.",
        "• Bot tidak dapat membaca status ban WhatsApp.",
        "• Status WhatsApp yang tidak dapat diverifikasi ditampilkan sebagai UNKNOWN."
      ].join("\n"),
      backKeyboard
    );
  }

  return showHome(chatId, messageId);
}

// ==========================================
// RUN USER CHECK
// ==========================================

async function runUserCheck(
  chatId,
  user,
  inputNumbers
) {
  if (!inputNumbers.length) {
    return sendMessage(
      chatId,
      "❌ Tidak ada nomor yang dikirim.",
      backKeyboard
    );
  }

  if (inputNumbers.length > config.maxBatchSize) {
    return sendMessage(
      chatId,
      `❌ Maksimal ${config.maxBatchSize} nomor per batch.`,
      backKeyboard
    );
  }

  if (inputNumbers.some(number => number.length > 30)) {
    return sendMessage(
      chatId,
      "❌ Ada input nomor yang terlalu panjang.",
      backKeyboard
    );
  }

  const numbers = [
    ...new Set(inputNumbers)
  ];

  const date = todayJakarta();

  const profile = await getProfile(user);

  const admin = isAdmin(user.id);
  const premium = isPremium(profile);

  const limit =
    admin || premium
      ? config.premiumLimit
      : config.freeLimit;

  const reports = [];

  for (const number of numbers) {
    if (!admin) {
      const allowed = await consumeQuota(
        user.id,
        date,
        limit
      );

      if (!allowed) {
        reports.push(
          "⛔ <b>KUOTA HARIAN HABIS</b>\nSilakan coba lagi besok atau hubungi admin untuk Premium."
        );

        break;
      }
    }

    const report = await processCheck(number);

    reports.push(report);
  }

  // SEND REPORTS IN SAFE TELEGRAM MESSAGE CHUNKS
  let chunk = "";

  for (const report of reports) {
    const next = chunk
      ? `${chunk}\n\n${report}`
      : report;

    if (next.length > 3500) {
      if (chunk) {
        await sendMessage(
          chatId,
          chunk,
          backKeyboard
        );
      }

      chunk = report;
    } else {
      chunk = next;
    }
  }

  if (chunk) {
    await sendMessage(
      chatId,
      chunk,
      backKeyboard
    );
  }
}

// ==========================================
// MESSAGE HANDLER
// ==========================================

async function handleMessage(message) {
  if (
    !message?.text ||
    !message?.from ||
    !message?.chat?.id
  ) {
    return;
  }

  const chatId = message.chat.id;
  const user = message.from;
  const text = message.text.trim();

  const profile = await getProfile(user);

  const admin = isAdmin(user.id);
  const premium = isPremium(profile);

  // START / MENU
  if (
    text === "/start" ||
    text.startsWith("/start ") ||
    text === "/menu"
  ) {
    return showHome(chatId);
  }

  // HELP
  if (text === "/help") {
    return sendMessage(
      chatId,
      [
        "📖 <b>BANTUAN</b>",
        "",
        "/menu - Menu utama",
        "/cek 628123456789 - Cek satu nomor",
        "/ceklist - Cek nomor massal",
        "/status - Profil dan kuota",
        "/premium - Informasi premium",
        "",
        "Gunakan tombol menu untuk fitur lainnya."
      ].join("\n"),
      backKeyboard
    );
  }

  // PREMIUM
  if (text === "/premium") {
    return sendMessage(
      chatId,
      [
        "⭐ <b>PAKET PREMIUM</b>",
        "",
        `FREE: ${config.freeLimit}/hari`,
        `PREMIUM: ${config.premiumLimit}/hari`,
        `Maksimal batch: ${config.maxBatchSize}`,
        "",
        "Hubungi admin untuk aktivasi."
      ].join("\n"),
      backKeyboard
    );
  }

  // STATUS
  if (text === "/status") {
    const used = await getUsage(
      user.id,
      todayJakarta()
    );

    const limit =
      admin || premium
        ? config.premiumLimit
        : config.freeLimit;

    return sendMessage(
      chatId,
      [
        "👤 <b>STATUS AKUN</b>",
        "",
        `Paket: <b>${admin ? "ADMIN" : premium ? "PREMIUM" : "FREE"}</b>`,
        `Kuota: <b>${used}/${limit}</b>`,
        `Sisa: <b>${Math.max(0, limit - used)}</b>`
      ].join("\n"),
      backKeyboard
    );
  }

  // ADMIN GRANT PREMIUM
  if (text.startsWith("/grant ")) {
    if (!admin) {
      return sendMessage(
        chatId,
        "❌ Perintah ini khusus admin."
      );
    }

    const [, idText, daysText] = text.split(/\s+/);

    const target = Number(idText);
    const days = Number(daysText);

    if (
      !Number.isSafeInteger(target) ||
      target <= 0 ||
      !Number.isSafeInteger(days) ||
      days < 1 ||
      days > 3650
    ) {
      return sendMessage(
        chatId,
        "Format:\n/grant TELEGRAM_ID 30"
      );
    }

    const result = await grantPremium(
      target,
      days
    );

    return sendMessage(
      chatId,
      [
        "✅ <b>PREMIUM BERHASIL DIAKTIFKAN</b>",
        "",
        `User ID: <code>${target}</code>`,
        `Durasi: ${days} hari`,
        `Berakhir: ${esc(result.vip_expires_at)}`
      ].join("\n")
    );
  }

  // ADMIN REVOKE PREMIUM
  if (text.startsWith("/revoke ")) {
    if (!admin) {
      return sendMessage(
        chatId,
        "❌ Perintah ini khusus admin."
      );
    }

    const target = Number(
      text.split(/\s+/)[1]
    );

    if (
      !Number.isSafeInteger(target) ||
      target <= 0
    ) {
      return sendMessage(
        chatId,
        "Format:\n/revoke TELEGRAM_ID"
      );
    }

    await revokePremium(target);

    return sendMessage(
      chatId,
      `✅ Premium untuk ${target} berhasil dicabut.`
    );
  }

  // CHECK COMMANDS
  const singleCommand = /^\/cek(?:@\w+)?\s+/.test(text);

  const bulkCommand =
    /^\/ceklist(?:@\w+)?(?:\s|$)/.test(text);

  // FORCE REPLY INPUT
  const replyText = message.reply_to_message?.text || "";

  const isSingleReply =
    replyText === "Kirim satu nomor yang ingin divalidasi:";

  const isBulkReply =
    replyText === "Kirim daftar nomor satu per baris:";

  const isReplyInput =
    isSingleReply || isBulkReply;

  if (
    !singleCommand &&
    !bulkCommand &&
    !isReplyInput
  ) {
    return;
  }

  let inputNumbers = [];

  if (singleCommand) {
    const commandParts = text.split(/\s+/);

    inputNumbers = [
      commandParts.slice(1).join(" ").trim()
    ].filter(Boolean);
  } else if (bulkCommand) {
    const commandBody = text
      .replace(/^\/ceklist(?:@\w+)?/, "")
      .trim();

    inputNumbers = commandBody
      .split(/[\s,;]+/)
      .map(number => number.trim())
      .filter(Boolean);
  } else if (isSingleReply) {
    inputNumbers = [
      text
    ].filter(Boolean);
  } else if (isBulkReply) {
    inputNumbers = text
      .split(/[\s,;]+/)
      .map(number => number.trim())
      .filter(Boolean);
  }

  return runUserCheck(
    chatId,
    user,
    inputNumbers
  );
}

// ==========================================
// VERCEL WEBHOOK HANDLER
// ==========================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(200)
      .send("WhatsApp Number Health Checker V2 Online");
  }

  try {
    validateConfig();

    const secret =
      req.headers["x-telegram-bot-api-secret-token"];

    if (secret !== config.webhookSecret) {
      return res
        .status(401)
        .send("Unauthorized");
    }

    if (req.body?.callback_query) {
      await handleCallback(
        req.body.callback_query
      );
    } else if (req.body?.message) {
      await handleMessage(
        req.body.message
      );
    }

    return res
      .status(200)
      .json({ ok: true });

  } catch (error) {
    console.error(
      "Webhook error:",
      error?.stack || error?.message || error
    );

    // Return 200 to avoid repeated Telegram webhook retries.
    return res
      .status(200)
      .json({
        ok: false,
        error: "Processing failed"
      });
  }
}
  
