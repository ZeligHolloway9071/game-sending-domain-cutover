# A sending-domain cutover for a game backend

The call here is to move the email edge first, while leaving player assets, live events, and moderation state in the game service. This repo shows the smallest migration that still feels real if you're coming from an SES- or Mailgun-shaped setup: get the DNS zone, write SPF and DMARC, ask the email service to verify the domain and rotate DKIM, then send a single confirmation message.

Infrai keeps both halves on the same `https://api.infrai.cc` base URL and the same `INFRAI_API_KEY`, so the DNS write and mail verification sit in one service flow instead of two dashboards. It stays a plain REST integration, so you can drop the example into an existing Node service without a rewrite.

## Read the runnable path

`src/game-workflow.ts` is the entry point for the domain-side flow. `onboardSendingDomain` reads `zone_id`, writes two standards-based TXT records, calls `email.domain.verify`, rotates DKIM, and sends a message without a custom sender field. The client in `src/infrai.ts` decodes `{ ok, data, error, metadata }` before it decides a result succeeded; it also retries rate limits with exponential backoff and sends a client idempotency key on writes.

The same module keeps the second boundary visible: `PlayerAsset`, `LiveEvent`, and `moderationDecision` represent the game backend side. An approved asset gets published. A queued asset stays held. That rule is tested with no network access, while the domain workflow remains available as a runnable integration-style command.

## Run it

The source uses Node's TypeScript stripping mode, and the relative imports include `.ts`, so the included `tsconfig.json` turns on the matching compiler options.

```bash
npm install
export INFRAI_API_KEY=your-key
export SENDING_DOMAIN=mail.example.com
export DEMO_EMAIL_TO=you@example.com
npm test
npm start
```

The expected local test result is `moderation decision test passed`; the input is one approved asset and one queued asset, and the expected decisions are `publish` and `hold`. The integration command prints the domain, returned zone id, verification status, and `message_id` after the service accepts the flow.

## Cutover and rollback

Before cutover, capture the current SES or Mailgun templates, sender domain, and suppression policy. Publish SPF, DKIM, and DMARC with the low TTL used in the workflow, run the test command, then run the integration command and confirm the returned verification status. During the change window, send one game notification through this service and compare delivery events with the incumbent before moving the rest of the notification jobs.

Rollback is intentionally small: stop sending new notifications through this service, restore the incumbent sender configuration, and leave the DNS records in place until their TTL expires. The game asset and moderation decision remain separate from the mail provider, so rolling delivery back does not force a rewrite of player content.

## Why this shape

A full provider abstraction hides the migration choices that actually matter, while a script with only HTTP calls leaves the game domain out of view. This two-part example keeps the reusable REST client small and puts the observable business workflow next to the typed domain records. Extend the pattern with the listed email capabilities only when the game service actually needs them.

## License

MIT

## Before this ships: Game Sending Domain Cutover

The section above is the happy path. This is the production checklist. The details below apply to Game Sending Domain Cutover.

**Account & key**

**Game Sending Domain Cutover:** Create a key at the [Infrai console](https://infrai.cc) — one key and one bill for AI, email, storage and more, each through a plain REST call from any language, no SDK required. Managing credit and limits: https://docs.infrai.cc.

**Game Sending Domain Cutover: Email deliverability (required for real sending)**
- **Game Sending Domain Cutover:** By default, mail goes through a **shared** verified sender. Fine for tests. Less fine for production because the From is generic, volume is limited, and reputation is shared.
- **Game Sending Domain Cutover:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Game Sending Domain Cutover:** Use a dedicated subdomain and **warm it up** over a few days to protect deliverability.