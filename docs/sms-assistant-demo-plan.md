# TIS SMS Assistant Demo Plan

## Goal
Build a working demo that shows how a retailer can text TIS/ATD fitment questions, get stocked wheel options, and send an email-ready package with specs, pricing, stock, and ATD buy links.

## Demo scope
- Browser-based SMS simulator at `/sms-demo`.
- Server conversation endpoint at `/api/sms-demo`.
- Twilio-ready inbound SMS webhook at `/api/twilio/sms`.
- Uses existing Dealer Tool SQLite catalog, stock, pricing, vehicle bolt-pattern table, image URLs, and ATD product links.
- Captures an email address and returns a demo email confirmation instead of sending real email.

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

## Twilio setup
1. Create a Twilio account and add billing/budget alerts before buying a number.
2. Buy one SMS-capable US number.
3. In the phone number settings, set **Messaging → A message comes in** to:
   - Method: `POST`
   - URL: `https://inventory.teamtis.com/api/twilio/sms`
4. Test by texting: `What 22" TIS wheels are stock for a 2022 Ford F-150?`
5. Optional hardening: set Railway env vars `TWILIO_VALIDATE_SIGNATURE=true` and `TWILIO_AUTH_TOKEN=<server-only token>` after copying the Auth Token from Twilio. Never commit the token.

## Environment variables
- `NEXT_PUBLIC_APP_URL` — canonical public app URL for result links.
- `TWILIO_PUBLIC_BASE_URL` — optional override for SMS result links.
- `TWILIO_VALIDATE_SIGNATURE` — set `true` after configuring the server-only token.
- `TWILIO_AUTH_TOKEN` — server-only Twilio Auth Token for webhook signature checks.

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
- SMS/MMS provider is simulated.
- Vehicle fitment is demo-grade bolt-pattern matching; final fitment should still be confirmed by ATD/TIS rules.
- Dealer-specific auth/pricing is not implemented yet.
