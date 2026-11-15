import { moderationDecision, type PlayerAsset } from "./game-workflow.ts";

const approved: PlayerAsset = { playerId: "p-7", assetId: "skin-3", kind: "skin", moderationState: "approved" };
const queued: PlayerAsset = { ...approved, assetId: "map-4", kind: "map", moderationState: "queued" };
if (moderationDecision(approved) !== "publish") throw new Error("approved assets should publish");
if (moderationDecision(queued) !== "hold") throw new Error("queued assets should remain held");
console.log("moderation decision test passed");
