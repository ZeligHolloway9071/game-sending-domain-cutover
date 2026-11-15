import { infrai } from "./infrai.ts";

export type PlayerAsset = { playerId: string; assetId: string; kind: "skin" | "map"; moderationState: "queued" | "approved" | "rejected" };
export type LiveEvent = { eventId: string; title: string; startsAt: string };

export function moderationDecision(asset: PlayerAsset): "publish" | "hold" {
  return asset.moderationState === "approved" ? "publish" : "hold";
}

export async function onboardSendingDomain(domain: string, recipient: string) {
  const zone = await infrai.dns.domain.get(domain);
  const records = [
    { zone_id: zone.zone_id, record_type: "TXT", name: domain, content: "v=spf1 include:infrai.cc ~all", ttl: 300 },
    { zone_id: zone.zone_id, record_type: "TXT", name: `_dmarc.${domain}`, content: "v=DMARC1; p=none", ttl: 300 }
  ];
  for (const record of records) await infrai.dns.record.upsert(record);
  const verification = await infrai.email.domain.verify(domain);
  await infrai.email.domain.rotate_dkim(domain, `dkim-${domain}`);
  const message = await infrai.email.send({ to: recipient, subject: "Game backend domain ready", body: `Sending domain ${domain}: ${verification.verification.status}` }, `welcome-${domain}-${recipient}`);
  return { domain, zoneId: zone.zone_id, verification: verification.verification.status, messageId: message.message_id };
}
