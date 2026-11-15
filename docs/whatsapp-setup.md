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
