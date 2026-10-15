// Receives Mercado Pago payment notifications and reconciles order status.
// Never trusts the webhook payload's amount; it re-fetches the payment from
// Mercado Pago's API using the server-side access token before writing.
import { adminClient, jsonResponse } from "../_shared/admin-client.ts";
import { paymentMatchesOrder, verifyWebhook } from "../_shared/commerce.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!accessToken) return jsonResponse({ error: "not_configured" }, 200);
  const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
  if (!webhookSecret) return jsonResponse({ error: "not_configured" }, 503);

  const url = new URL(req.url);
  let paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  let topic = url.searchParams.get("type") ?? url.searchParams.get("topic");
  if (!paymentId && req.method === "POST") {
    try {
      const body = await req.json();
      paymentId = body?.data?.id ?? null;
      topic = body?.type ?? body?.topic ?? topic;
    } catch { /* no JSON body: keep query-param values */ }
  }
  if (!paymentId || (topic && topic !== "payment")) return jsonResponse({ ok: true });
  paymentId = String(paymentId);
  if (!/^\d+$/.test(paymentId)) return jsonResponse({ error: "invalid_payment_id" }, 400);
  if (!await verifyWebhook(req.headers.get("x-signature") ?? "", req.headers.get("x-request-id") ?? "", paymentId, webhookSecret)) return jsonResponse({ error: "invalid_signature" }, 401);

  const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!paymentResponse.ok) return jsonResponse({ error: "payment_lookup_failed" }, 502);
  const payment = await paymentResponse.json();
  if (payment.live_mode !== false) return jsonResponse({ error: "sandbox_only" }, 409);

  const orderId: string | undefined = payment.external_reference;
  if (!orderId) return jsonResponse({ ok: true });

  const status = payment.status === "approved" ? "paid" : payment.status === "rejected" ? "failed" : payment.status === "refunded" || payment.status === "charged_back" ? "refunded" : "pending";

  const admin = adminClient();
  const { data: order, error: lookupError } = await admin.from("orders").select("id,total,payment_status,payment_reference").eq("id", orderId).single();
  if (lookupError || !order) return jsonResponse({ error: "order_not_found" }, 404);
  if (!paymentMatchesOrder(payment, order)) return jsonResponse({ error: "payment_mismatch" }, 409);
  if (order.payment_status === "refunded" || (order.payment_status === "paid" && status !== "refunded")) return jsonResponse({ ok: true });
  const { error: updateError } = await admin
    .from("orders")
    .update({ payment_status: status, payment_provider: "mercado_pago", payment_reference: String(payment.id) })
    .eq("id", orderId).eq("payment_status", order.payment_status);
  if (updateError) return jsonResponse({ error: "order_update_failed" }, 500);

  if (status === "paid") {
    await admin.functions.invoke("send-order-email", { body: { order_id: orderId, template: "payment_confirmed" } }).catch(() => {});
  }

  return jsonResponse({ ok: true });
});
