// Sends transactional order emails through Resend. Called from the checkout
// flow (order received) and from the payment webhook (payment confirmed).
// No-ops with a clear message when RESEND_API_KEY is not configured yet, so
// the storefront keeps working without a production email provider.
import { adminClient, corsHeaders, jsonResponse } from "../_shared/admin-client.ts";
import { escapeHtml } from "../_shared/commerce.ts";

const SUBJECTS: Record<string, string> = {
  order_received: "Recebemos seu pedido de teste — Fany Cosméticos",
  payment_confirmed: "Pagamento confirmado — Fany Cosméticos",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const admin = adminClient();
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const internal = Boolean(token) && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const { data: auth } = internal ? { data: { user: null } } : await admin.auth.getUser(token);
  if (!internal && !auth.user) return jsonResponse({ error: "unauthorized" }, 401);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !from) {
    return jsonResponse({ error: "not_configured", message: "Defina RESEND_API_KEY e RESEND_FROM_EMAIL com supabase secrets set para enviar e-mails." }, 200);
  }

  let orderId: string, template: string;
  try {
    ({ order_id: orderId, template } = await req.json());
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400);
  }
  if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId)) return jsonResponse({ error: "invalid_body" }, 400);
  if (!Object.hasOwn(SUBJECTS, template)) return jsonResponse({ error: "unknown_template" }, 400);
  if (template === "payment_confirmed" && !internal) return jsonResponse({ error: "forbidden" }, 403);

  const { data: order, error } = await admin
    .from("orders")
    .select("id,customer_name,total,status,user_id,payment_status")
    .eq("id", orderId)
    .single();
  if (error || !order) return jsonResponse({ error: "order_not_found" }, 404);
  if (!internal && order.user_id !== auth.user?.id) return jsonResponse({ error: "order_not_found" }, 404);
  if (template === "payment_confirmed" && order.payment_status !== "paid") return jsonResponse({ error: "payment_not_confirmed" }, 409);

  const { data: authUser } = await admin.auth.admin.getUserById(order.user_id);
  const to = authUser?.user?.email;
  if (!to) return jsonResponse({ error: "no_recipient" }, 200);

  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.total);
  const name = escapeHtml(order.customer_name);
  const html = template === "payment_confirmed"
    ? `<p>Olá, ${name}!</p><p>Seu pagamento do pedido <strong>${order.id}</strong> (${money}) foi confirmado.</p>`
    : `<p>Olá, ${name}!</p><p>Recebemos seu pedido <strong>${order.id}</strong> no valor de ${money}. Ambiente de demonstração: nenhuma cobrança foi realizada ainda.</p>`;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `${order.id}/${template}` },
    body: JSON.stringify({ from, to, subject: SUBJECTS[template], html }),
  });
  if (!resendResponse.ok) return jsonResponse({ error: "email_provider_error" }, 502);

  return jsonResponse({ ok: true });
});
