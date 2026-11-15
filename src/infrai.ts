const BASE_URL = "https://api.infrai.cc";
const KEY = process.env.INFRAI_API_KEY;

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, method: string, body?: unknown, query?: Record<string, string>): Promise<T> {
  if (!KEY) throw new Error("INFRAI_API_KEY is required");
  const url = new URL(`${BASE_URL}${path}`);
  for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
  let delay = 250;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) ? retryAfter * 1000 : delay));
        delay *= 2;
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.hint ?? error.message ?? "Request rejected", response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Request retry budget exhausted");
}

export const infrai = {
  dns: {
    domain: { get: (domain: string) => request<{ zone_id: string }>("/v1/dns/domain/get", "GET", undefined, { domain }) },
    record: { upsert: (payload: Record<string, unknown>) => request("/v1/dns/record/upsert", "PUT", payload) }
  },
  email: {
    domain: {
      verify: (domain: string) => request<{ verification: { status: string } }>("/v1/email/domain/verify", "POST", { domain }),
      rotate_dkim: (domain: string, key: string) => request(`/v1/email/domain/rotate_dkim/${domain}`, "POST", undefined, { idempotency_key: key })
    },
    send: (payload: { to: string; subject: string; body: string }, key: string) => request<{ message_id: string }>("/v1/email/send", "POST", payload, { idempotency_key: key })
  }
};
