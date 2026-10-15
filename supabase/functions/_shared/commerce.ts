export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function paymentMatchesOrder(payment: { external_reference?: unknown; currency_id?: unknown; transaction_amount?: unknown; live_mode?: unknown }, order: { id: string; total: number | string }): boolean {
  return payment.external_reference === order.id && payment.currency_id === "BRL"
    && typeof payment.transaction_amount === "number" && Number.isFinite(payment.transaction_amount)
    && Math.round(payment.transaction_amount * 100) === Math.round(Number(order.total) * 100);
}

export async function verifyWebhook(signature: string, requestId: string, dataId: string, secret: string): Promise<boolean> {
  const parts: Record<string, string> = Object.fromEntries(signature.split(",").map(part => part.trim().split("=")));
  if (!/^\d+$/.test(parts.ts ?? "") || !/^[a-f0-9]{64}$/i.test(parts.v1 ?? "") || !requestId || !dataId) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const digest = Uint8Array.from(parts.v1.match(/../g)!, byte => parseInt(byte, 16));
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  return crypto.subtle.verify("HMAC", key, digest, new TextEncoder().encode(manifest));
}
