# WhatsApp Health Checker V2

Telegram webhook bot for Vercel. It validates phone-number formatting and optionally enriches results with third-party phone lookup providers.

## Important limitations

- This project does **not** determine whether an arbitrary number is registered on WhatsApp.
- It cannot detect WhatsApp bans, internal restrictions, “bug merah”, message reachability, or private spam reports.
- A valid phone-number format is not proof that the number is active or belongs to a WhatsApp account.
- Use lookup providers only within their current plan, licensing, privacy, and commercial-use terms.
- Do not use this project for bulk enumeration, unsolicited messaging, or checking numbers without a lawful basis.

## Included features

- `/start`, `/help`, `/cek`, `/ceklist`, `/status`, `/premium`
- Admin commands: `/grant TELEGRAM_ID DAYS`, `/revoke TELEGRAM_ID`
- Local phone-number validation with `libphonenumber-js`
- Optional Abstract, Numverify, and Twilio Basic Lookup integrations
- Provider fallback and Supabase daily quota
- Free and premium quotas

## 1. Supabase

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Copy Project URL and service-role key from Project Settings > API.
5. Keep the service-role key secret. Never put it in frontend code or a public repository.

## 2. Telegram

1. Create a bot with BotFather.
2. Copy the bot token.
3. Choose a long random webhook secret (letters, numbers, underscore, hyphen; 1–256 characters).
4. Get your Telegram numeric user ID for `BOT_OWNER_IDS`.

## 3. Vercel

1. Push this folder to a private GitHub repository.
2. Import it into Vercel.
3. Add environment variables from `.env.example`.
4. Set `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `BOT_OWNER_IDS`.
5. Deploy.

For a conservative free-first setup:
- `API_FALLBACK_ENABLED=true`
- `ALLOW_PAID_LOOKUPS=false`
- `ENABLE_ABSTRACT=false`
- `ENABLE_NUMVERIFY=false`
- `ENABLE_TWILIO=false` until Twilio credentials and pricing are confirmed.

The local checker works without external API keys. Enabling Twilio Basic Lookup may incur account-specific charges or require a funded account; check current Twilio terms before enabling it. Abstract and Numverify are disabled by default because free-tier and commercial-use terms can change.

## 4. Set Telegram webhook

After deployment, run (replace values):

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -d "url=https://YOUR_PROJECT.vercel.app/api/webhook" \
  -d "secret_token=YOUR_WEBHOOK_SECRET"
```

Check:

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```

## 5. Commands

```text
/start
/cek 628123456789
/ceklist
628123456789
628987654321
/status
/premium
/grant TELEGRAM_ID 30
/revoke TELEGRAM_ID
```

## 6. Local development

```bash
npm install
cp .env.example .env
# Fill .env
npm start
```

Note: `npm start` starts the function module locally but does not itself provide a public Telegram webhook. Use Vercel dev (`npx vercel dev`) for local webhook testing.

## Provider notes

- Abstract Phone Validation: `https://www.abstractapi.com/api/phone-validation-api`
- Numverify: `https://numverify.com/`
- Twilio Lookup: `https://www.twilio.com/docs/lookup`

The fallback order is Abstract -> Numverify -> Twilio, but provider calls are disabled unless their environment flags are enabled. Abstract and Numverify are also skipped unless `ALLOW_PAID_LOOKUPS=true`. This flag is only an operator-controlled gate; it does not establish that a provider plan permits commercial use.

## Deployment checklist

- [ ] SQL schema executed
- [ ] Vercel environment variables set
- [ ] Private GitHub repository used
- [ ] Webhook secret matches Vercel variable exactly
- [ ] `/start` tested
- [ ] `/cek` tested
- [ ] `/ceklist` tested with a small batch
- [ ] Admin ID checked
- [ ] Provider billing and terms reviewed before enabling


## Menu gambar, inline button, dan edit caption

Versi ini menampilkan `public/menu-banner.png` sebagai gambar menu utama. Tombol navigasi memakai callback Telegram dan memperbarui caption pada pesan menu yang sama, sehingga perpindahan halaman tidak mengirim pesan menu baru.

Atur `APP_PUBLIC_URL` ke URL deployment Vercel, misalnya `https://nama-project.vercel.app`, agar Telegram dapat mengambil gambar menu dari `https://nama-project.vercel.app/menu-banner.png`. Pastikan file `public/menu-banner.png` ikut diunggah ke GitHub.

Tombol Cek Satu Nomor dan Cek Massal meminta input melalui ForceReply. Pesan input dan hasil pemeriksaan tetap menjadi pesan terpisah karena Telegram tidak mengizinkan bot mengedit pesan pengguna; navigasi menu tetap diedit pada pesan gambar yang sama.
