import { onboardSendingDomain } from "./game-workflow.ts";

const domain = process.env.SENDING_DOMAIN;
const recipient = process.env.DEMO_EMAIL_TO;
if (!domain || !recipient) throw new Error("SENDING_DOMAIN and DEMO_EMAIL_TO are required");

const result = await onboardSendingDomain(domain, recipient);
console.log(JSON.stringify(result, null, 2));
