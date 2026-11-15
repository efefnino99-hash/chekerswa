import { config, validateConfig } from "../lib/config.js";
import { sendMessage, sendPhoto, editCaption, answerCallback } from "../lib/telegram.js";
import {
  getProfile, getUsage, consumeQuota, grantPremium, revokePremium
} from "../lib/database.js";
import { checkNumber } from "../lib/checker.js";
import { externalLookup } from "../lib/providers.js";
import { buildReport } from "../lib/report.js";

const APP_URL = (process.env.APP_PUBLIC_URL || process.env.VERCEL_URL || "").replace(/\/$/, "");
const MENU_IMAGE = APP_URL
  ? `${APP_URL.startsWith("http") ? APP_URL : `https://${APP_URL}`}/menu-banner.png`
  : "";

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

const isAdmin = id => config.admins.includes(String(id));
const isPremium = profile => Boolean(profile.premium_until && new Date(profile.premium_until) > new Date());
const mainKeyboard = { inline_keyboard: [
  [{ text: "🔎 Cek Satu Nomor", callback_data: "menu:single" }, { text: "📋 Cek Massal", callback_data: "menu:bulk" }],
  [{ text: "👤 Profil & Kuota", callback_data: "menu:status" }, { text: "⭐ Premium", callback_data: "menu:premium" }],
  [{ text: "📖 Bantuan", callback_data: "menu:help" }, { text: "🔄 Menu Utama", callback_data: "menu:home" }]
]};
const backKeyboard = { inline_keyboard: [[{ text: "⬅️ Menu Utama", callback_data: "menu:home" }]] };
const inputKeyboard = { inline_keyboard: [[{ text: "⬅️ Batal / Menu", callback_data: "menu:home" }]] };
const esc = value => String(value ?? "-").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

async function showHome(chatId, messageId = null) {
  const caption = "🟢 <b>WHATSAPP NUMBER CHECKER</b>\n\nSelamat datang! Pilih fitur melalui tombol di bawah.\n\n<i>Validasi format dan informasi nomor. Hasil bukan bukti bahwa nomor terdaftar atau aktif di WhatsApp.</i>";
  if (messageId) return editCaption(chatId, messageId, caption, mainKeyboard);
  if (!MENU_IMAGE) {
    return sendMessage(chatId, caption.replace(/<[^>]+>/g, ""), mainKeyboard);
  }
  return sendPhoto(chatId, MENU_IMAGE, caption, mainKeyboard);
}

async function processCheck(input) {
  const local = checkNumber(input);
  if (!local.valid) return buildReport(local, null);
  let external = { success: false, source: "LOCAL_ONLY" };
  try { external = await externalLookup(local.e164); }
  catch (error) { console.error(`Lookup failed: ${error.message}`); }
  return buildReport(local, external);
}

async function showStatus(chatId, messageId, user) {
  const profile = await getProfile(user);
  const used = await getUsage(user.id, todayJakarta());
  const admin = isAdmin(user.id);
  const premium = isPremium(profile);
  const limit = admin || premium ? config.premiumLimit : config.freeLimit;
  const caption = [
    "👤 <b>PROFIL AKUN</b>", "",
    `ID Telegram: <code>${user.id}</code>`,
    `Paket: <b>${admin ? "ADMIN" : premium ? "PREMIUM" : "FREE"}</b>`,
    `Pemakaian hari ini: <b>${used}/${limit}</b>`,
    `Sisa kuota: <b>${Math.max(0, limit - used)}</b>`,
    `Premium sampai: ${esc(profile.premium_until || "-")}`
  ].join("\n");
  return editCaption(chatId, messageId, caption, backKeyboard);
}

async function handleCallback(query) {
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const user = query.from;
  if (!chatId || !messageId) return answerCallback(query.id, "Pesan menu tidak tersedia.", true);
  const action = query.data || "menu:home";
  await answerCallback(query.id);

  if (action === "menu:home") return showHome(chatId, messageId);
  if (action === "menu:status") return showStatus(chatId, messageId, user);
  if (action === "menu:single") {
    await editCaption(chatId, messageId,
      "🔎 <b>CEK SATU NOMOR</b>\n\nTekan tombol di bawah, lalu kirim satu nomor dengan kode negara.\nContoh: <code>628123456789</code>", backKeyboard);
    return sendMessage(chatId, "Kirim satu nomor yang ingin divalidasi:", inputKeyboard, { reply_markup: { force_reply: true, selective: true } });
  }
  if (action === "menu:bulk") {
    await editCaption(chatId, messageId,
      `📋 <b>CEK MASSAL</b>\n\nKirim beberapa nomor, satu nomor per baris. Maksimal <b>${config.maxBatchSize}</b> nomor.\nContoh:\n<code>628123456789\n628987654321</code>`, backKeyboard);
    return sendMessage(chatId, "Kirim daftar nomor satu per baris:", inputKeyboard, { reply_markup: { force_reply: true, selective: true } });
  }
  if (action === "menu:premium") {
    return editCaption(chatId, messageId, [
      "⭐ <b>PAKET PREMIUM</b>", "",
      `FREE: ${config.freeLimit} pemeriksaan/hari`,
      `PREMIUM: ${config.premiumLimit} pemeriksaan/hari`,
      `Batas batch: ${config.maxBatchSize} nomor`, "",
      "Hubungi admin untuk aktivasi. Pembayaran tidak diproses otomatis oleh bot ini."
    ].join("\n"), backKeyboard);
  }
  if (action === "menu:help") {
    return editCaption(chatId, messageId, [
      "📖 <b>BANTUAN</b>", "",
      "• Gunakan tombol Cek Satu Nomor untuk satu nomor.",
      "• Gunakan Cek Massal untuk daftar beberapa nomor.",
      "• Profil menampilkan paket dan kuota.",
      "• Hasil validasi format bukan bukti nomor aktif/terdaftar di WhatsApp.",
      "• Bot tidak dapat membaca status ban, laporan privat, atau kondisi internal WhatsApp."
    ].join("\n"), backKeyboard);
  }
  return showHome(chatId, messageId);
}

async function runUserCheck(chatId, user, inputNumbers) {
  if (!inputNumbers.length) return sendMessage(chatId, "Tidak ada nomor yang dikirim.", backKeyboard);
  if (inputNumbers.length > config.maxBatchSize) {
    return sendMessage(chatId, `❌ Maksimal ${config.maxBatchSize} nomor per batch.`, backKeyboard);
  }
  if (inputNumbers.some(n => n.length > 30)) return sendMessage(chatId, "❌ Ada input terlalu panjang.", backKeyboard);
  const numbers = [...new Set(inputNumbers)];
  const date = todayJakarta();
  const profile = await getProfile(user);
  const admin = isAdmin(user.id);
  const premium = isPremium(profile);
  const limit = admin || premium ? config.premiumLimit : config.freeLimit;
  const reports = [];
  for (const number of numbers) {
    if (!admin) {
      const allowed = await consumeQuota(user.id, date, limit);
      if (!allowed) { reports.push("⛔ Kuota harian habis. Silakan buka menu Premium."); break; }
    }
    reports.push(await processCheck(number));
  }
  let chunk = "";
  for (const report of reports) {
    const next = chunk ? `${chunk}\n\n${report}` : report;
    if (next.length > 3500) { await sendMessage(chatId, chunk, backKeyboard); chunk = report; }
    else chunk = next;
  }
  if (chunk) await sendMessage(chatId, chunk, backKeyboard);
}

async function handleMessage(message) {
  if (!message?.text || !message?.from || !message?.chat?.id) return;
  const chatId = message.chat.id;
  const user = message.from;
  const text = message.text.trim();
  const profile = await getProfile(user);
  const admin = isAdmin(user.id);
  const premium = isPremium(profile);

  if (text === "/start" || text === "/menu") return showHome(chatId);
  if (text === "/help") return sendMessage(chatId,
    "📖 Gunakan /menu untuk membuka tombol. Perintah: /cek 628123456789 dan /ceklist diikuti nomor per baris.", backKeyboard);
  if (text === "/premium") return sendMessage(chatId,
    `⭐ FREE ${config.freeLimit}/hari · PREMIUM ${config.premiumLimit}/hari · Maksimal batch ${config.maxBatchSize}. Hubungi admin untuk aktivasi.`, backKeyboard);
  if (text === "/status") {
    const used = await getUsage(user.id, todayJakarta());
    const limit = admin || premium ? config.premiumLimit : config.freeLimit;
    return sendMessage(chatId, `👤 ${admin ? "ADMIN" : premium ? "PREMIUM" : "FREE"}\nKuota: ${used}/${limit}\nSisa: ${Math.max(0, limit-used)}`, backKeyboard);
  }
  if (text.startsWith("/grant ")) {
    if (!admin) return sendMessage(chatId, "❌ Khusus admin.");
    const [, idText, daysText] = text.split(/\s+/);
    const target = Number(idText), days = Number(daysText);
    if (!Number.isSafeInteger(target) || !Number.isInteger(days) || days < 1 || days > 3650)
      return sendMessage(chatId, "Format: /grant TELEGRAM_ID 30");
    const expiry = await grantPremium(target, days);
    return sendMessage(chatId, `✅ Premium untuk ${target} sampai ${expiry.toISOString()}`);
  }
  if (text.startsWith("/revoke ")) {
    if (!admin) return sendMessage(chatId, "❌ Khusus admin.");
    const target = Number(text.split(/\s+/)[1]);
    if (!Number.isSafeInteger(target)) return sendMessage(chatId, "Format: /revoke TELEGRAM_ID");
    await revokePremium(target);
    return sendMessage(chatId, "✅ Premium dicabut.");
  }

  const singleCommand = text.startsWith("/cek ");
  const bulkCommand = text === "/ceklist" || text.startsWith("/ceklist\n");
  const isReplyInput = Boolean(message.reply_to_message?.text &&
    ["Kirim satu nomor yang ingin divalidasi:", "Kirim daftar nomor satu per baris:"].includes(message.reply_to_message.text));
  if (!singleCommand && !bulkCommand && !isReplyInput) return;
  let inputNumbers;
  if (singleCommand) inputNumbers = [text.slice(5).trim()];
  else if (bulkCommand) inputNumbers = text.split("\n").slice(1).map(x => x.trim()).filter(Boolean);
  else inputNumbers = text.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
  return runUserCheck(chatId, user, inputNumbers);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("WhatsApp Health Checker V2 Online");
  try {
    validateConfig();
    if (req.headers["x-telegram-bot-api-secret-token"] !== config.webhookSecret)
      return res.status(401).send("Unauthorized");
    if (req.body?.callback_query) await handleCallback(req.body.callback_query);
    else if (req.body?.message) await handleMessage(req.body.message);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error.message);
    return res.status(200).json({ ok: false, error: "Processing failed" });
  }
}
