"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Order = { id: string; total: number; created_at: string; payment_status: string; items: { name: string; quantity: number }[] };
const statuses: Record<string, string> = { pending: "Aguardando pagamento", paid: "Pago (teste)", failed: "Pagamento recusado", refunded: "Pagamento estornado" };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function OrdersPanel({ onClose }: { onClose: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  async function refresh() {
    setLoading(true); setMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("session");
      const { data, error } = await supabase.from("orders").select("id,total,created_at,payment_status,items").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      setOrders(data ?? []);
    } catch { setMessage("Não foi possível consultar seus pedidos. Confira sua conexão e sua sessão."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  async function pay(id: string) {
    setBusy(id); setMessage(""); setPaymentLink("");
    try {
      const { data, error } = await supabase.functions.invoke("create-payment-preference", { body: { order_id: id } });
      if (error || !data?.init_point) { setMessage("Pagamento indisponível. O pedido continua salvo; tente novamente mais tarde."); return; }
      setPaymentLink(data.init_point);
    } catch { setMessage("Falha de conexão ao preparar pagamento."); }
    finally { setBusy(""); }
  }
  return <div className="modal-shell" role="dialog" aria-modal="true" aria-label="Meus pedidos">
    <button className="modal-backdrop" onClick={onClose} aria-label="Fechar pedidos" />
    <div className="checkout-modal account-panel orders-panel">
      <button className="icon-button modal-close" onClick={onClose} aria-label="Fechar">×</button>
      <h2>Meus pedidos</h2><p>Pedidos demonstrativos da sua conta. Mostrando os 50 mais recentes.</p>
      <button className="secondary-button" onClick={() => void refresh()} disabled={loading}>Atualizar</button>
      <p role="status">{loading ? "Consultando pedidos…" : message}</p>
      {paymentLink && <a className="primary-button" href={paymentLink} target="_blank" rel="noreferrer">Abrir pagamento de teste</a>}
      {!loading && !message && !orders.length && <p>Você ainda não registrou pedidos.</p>}
      {orders.map(order => <article className="order-card" key={order.id}>
        <strong>{new Date(order.created_at).toLocaleDateString("pt-BR")} · {money.format(order.total)}</strong>
        <p>{statuses[order.payment_status] ?? "Em processamento"}</p><small>Pedido: {order.id}</small>
        <ul>{order.items.map((item, index) => <li key={index}>{item.quantity}× {item.name}</li>)}</ul>
        {["pending", "failed"].includes(order.payment_status) && <button className="secondary-button" disabled={Boolean(busy)} onClick={() => void pay(order.id)}>{busy === order.id ? "Preparando…" : "Pagamento de teste"}</button>}
      </article>)}
    </div>
  </div>;
}
