# Memorica WhatsApp integration

The host workspace's **Invitation Card & Share** tab includes **Send through Memorica WhatsApp**. Select a guest and an overall/sub-event invitation, confirm opt-in, review, then send. The existing WhatsApp share option continues to work independently.

## Current scope

- Sends an approved text template containing the guest name, selected event title and personal invitation URL. The selected image/video/PDF card is shown on that URL, not attached to the WhatsApp message.
- Server checks the signed-in event owner, configured sender account allowlist, complete event details, valid phone with country code, and selected invitation.
- Records consent confirmation, recipient and send result in `WhatsAppInvitation`.
- Prevents duplicate sends per guest and invitation. Explicit Meta failures can be retried; ambiguous network failures remain unconfirmed and cannot be blindly resent.
- “Accepted” means Meta accepted the request, not delivered or read. Delivery webhooks, bulk sending, inbound replies and WhatsApp login OTPs are not implemented in this step.
- Sends are user-triggered only. No real messages are sent by setup or automated tests.

## Local server configuration

Put secrets in the ignored `.env` file, never in chat, source code or `NEXT_PUBLIC_` variables:

```
WHATSAPP_PHONE_NUMBER_ID="your Meta Phone Number ID"
WHATSAPP_ACCESS_TOKEN="your token"
WHATSAPP_API_VERSION="v25.0"
WHATSAPP_INVITATION_TEMPLATE="memorica_event_invitation"
WHATSAPP_TEMPLATE_LANGUAGE="en_US"
WHATSAPP_HOST_USER_IDS="the authorized Memorica user's database ID"
MEMORICA_PUBLIC_URL="https://your-memorica-hostname.example"
```

The version above matches this app's Meta test console at setup time. Use an API version supported by your Meta app. Restart the server after changing configuration. The status endpoint exposes readiness and delivery states, never credentials.

The public URL must serve this same Memorica deployment and its database/media. A localhost address will not work on guests' phones. Do not point it to an unrelated deployment or expose a development server without reviewing its authentication first.

The allowlist authorizes specific Memorica accounts to use the shared Meta sender. Obtain the user's ID from the local User record. Do not enter their phone number in this field.

## Meta setup

1. Open Memorica in Meta for Developers → WhatsApp use case → Step 1. Try it out.
2. Generate a test access token yourself and store it in the local `.env`. Test tokens expire; use a suitable system-user token for production.
3. Add and verify test recipient numbers in Meta before testing sends from its test number.
4. Create and obtain approval for an invitation template with **three positional BODY parameters**, in this order: guest name, event title, full invitation URL. Use no header or buttons for this initial integration. Example body:

   `Hi {{1}}, you're invited to {{2}}. View your invitation and RSVP: {{3}}`

   Template category and approval are determined by Meta. Set its exact approved name and language in `.env`. Generic sample templates such as order confirmations do not match this contract.
5. Configure a reachable HTTPS Memorica URL and the authorized host ID, restart, then refresh the connection panel.
6. Use a test guest who has agreed to receive the invitation. Review the exact recipient and card before pressing Send.

Meta's test number is for approved test recipients. Production requires your sender setup and appropriate Meta permissions. No account settings, tokens, templates or messages are created automatically by this code.

References: [Meta Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/collection/wlk6lh4/whatsapp-cloud-api), [Meta message templates](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/).

## Local sample test without hosting

Set `WHATSAPP_TEST_RECIPIENTS` in the private `.env` to comma-separated international phone numbers already verified in Meta. In the local event’s Invitation Card & Share tab, choose a test recipient and click **Send WhatsApp sample**. This sends the approved `hello_world` template directly through Meta, without an event link or card. No HTTPS address or custom invitation template is needed for this sample.

The sample endpoint requires development mode, a localhost request with a matching Origin, and the signed-in event owner. Only configured recipients are allowed; attempts are limited to once a minute per user in the local process. This feature is disabled in production. The **Open WhatsApp** action still opens the regular WhatsApp app for manual sharing.

## Wedding celebration template

Use `WHATSAPP_INVITATION_TEMPLATE="memorica_wedding_celebration"` with language `en_US` only after Meta approves this template. Its three positional body parameters are **groom name, bride name, personal invitation URL**, with no header or buttons. Other template names retain the original guest-name/event-title/URL contract. This wedding template is blocked for non-wedding events or until both separate names are saved in Event details; existing combined couple names are never guessed or split. The selected overall/sub-event card remains encoded in the personal invitation URL.

Submitted wording (Marketing category; final category and approval controlled by Meta):

```
🌸 *Two hearts. One beautiful beginning.* 🌸

With joyful hearts, we invite you to celebrate the wedding of

🤵 *{{1}}* & 👰 *{{2}}*

Your presence, love and blessings would mean so much to us as we begin this new chapter. 💕

💌 Click the Memorica link below to explore the invitation, wedding celebrations, dates and venue details, and confirm your attendance:
{{3}}

✨ Come make memories with us!
```
