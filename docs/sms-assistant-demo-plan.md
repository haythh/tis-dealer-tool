# TIS SMS Assistant Demo Plan

## Goal
Build a working demo that shows how a retailer can text TIS/ATD fitment questions, get stocked wheel options, and send an email-ready package with specs, pricing, stock, and ATD buy links.

## Demo scope
- Browser-based SMS simulator at `/sms-demo`.
- Server conversation endpoint at `/api/sms-demo`.
- Twilio-ready inbound SMS webhook at `/api/twilio/sms`.
- Twilio WhatsApp Sandbox webhook at `/api/twilio/whatsapp` for same-day demos while A2P 10DLC is pending.
- Uses existing Dealer Tool SQLite catalog, stock, pricing, vehicle bolt-pattern table, image URLs, and ATD product links.
- Captures an email address and sends a branded wheel-card package when `RESEND_API_KEY` and `EMAIL_FROM` are configured. Without those env vars, it keeps the package link ready and fails loud instead of pretending to send.

## Production seam
The demo reads inventory/pricing from Dealer Tool data today. A real ATD EDI feed should replace only the inventory/pricing adapter layer, preserving:
- normalized wheel card payloads
- conversation slot filling
- fitment/search logic
- email package payload
- Twilio webhook surface

## MVP production components
1. Twilio SMS/MMS webhook.
2. Dealer phone-number authorization.
3. ATD EDI inventory/pricing adapter.
4. Fitment/search API adapter, preferably shared with Dealer Tool.
5. Mobile quote/result page.
6. Branded email sender with wheel cards and ATD links.
7. Admin log for conversations, failed searches, sent packages, and dealer usage.

## Twilio SMS setup
1. Create a Twilio account and add billing/budget alerts before buying a number.
2. Buy one SMS-capable US number.
3. In the phone number settings, set **Messaging → A message comes in** to:
   - Method: `POST`
   - URL: `https://inventory.teamtis.com/api/twilio/sms`
4. Test by texting: `What 22" TIS wheels are stock for a 2022 Ford F-150?`
5. Optional hardening: set Railway env vars `TWILIO_VALIDATE_SIGNATURE=true` and `TWILIO_AUTH_TOKEN=<server-only token>` after copying the Auth Token from Twilio. Never commit the token.

## Same-day WhatsApp Sandbox setup
Use this when A2P 10DLC is still pending and the demo is tomorrow.

1. Twilio Console → **Messaging → Try it out → Send a WhatsApp message**.
2. Join the sandbox from the demo phone by sending Twilio's displayed join phrase to the sandbox WhatsApp number, usually `+1 415 523 8886`.
3. In **Sandbox settings**, set **When a message comes in** to:
   - Method: `POST`
   - URL: `https://inventory.teamtis.com/api/twilio/whatsapp`
4. Save the sandbox settings.
5. From WhatsApp, send: `What 22" TIS wheels are stock for a 2022 Ford F-150?`

Notes:
- No A2P 10DLC approval is required for the Twilio WhatsApp Sandbox.
- Every demo phone must join the sandbox first.
- The sandbox is for demos/testing only; production WhatsApp requires Meta/Twilio business approval.

## Environment variables
- `NEXT_PUBLIC_APP_URL` — canonical public app URL for result links.
- `TWILIO_PUBLIC_BASE_URL` — optional override for SMS result links.
- `TWILIO_VALIDATE_SIGNATURE` — set `true` after configuring the server-only token.
- `TWILIO_AUTH_TOKEN` — server-only Twilio Auth Token for webhook signature checks. Use the same token for SMS and WhatsApp Sandbox webhooks.
- `RESEND_API_KEY` — server-only email API key for sending wheel-card packages.
- `EMAIL_FROM` — verified sender, for example `TIS Dealer Tool <dealer-tool@inventory.teamtis.com>`.
- `EMAIL_REPLY_TO` — optional reply-to address.
- `EMAIL_BCC` — optional comma-separated internal BCC list.

## Demo script
1. Open `/sms-demo`.
2. Send: `What 22" TIS wheels are stock for a 2022 Ford F-150?`
3. Bot asks finish preference.
4. Send: `black`.
5. Bot returns stocked wheel cards with specs, MAP, stock, and ATD links.
6. Send: `send it`.
7. Bot asks for email.
8. Send: `buyer@example.com`.
9. Bot confirms the package.

## Known demo limitations
- Email is simulated.
- Browser SMS/MMS provider is simulated; Twilio SMS and WhatsApp Sandbox webhooks are live-ready.
- Vehicle fitment is demo-grade bolt-pattern matching; final fitment should still be confirmed by ATD/TIS rules.
- Dealer-specific auth/pricing is not implemented yet.
