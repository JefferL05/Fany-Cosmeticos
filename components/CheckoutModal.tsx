import { supabase } from "@/lib/supabase";
import { lookupCep } from "@/lib/shipping";
import { useRef, useState } from "react";
import type { CartItem } from "@/lib/types";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function CheckoutModal({ open, items, onClose, onSuccess }: { open: boolean; items: CartItem[]; onClose: () => void; onSuccess: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const [payment, setPayment] = useState("pix");
  const [done, setDone] = useState(false);
  const [cep, setCep] = useState("");
  const [address, setAddress] = useState<{ uf: string; city: string; street: string } | null>(null);
  const [cepStatus, setCepStatus] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [zonePrice, setZonePrice] = useState<number | null>(null);
  const cepRevision = useRef(0);
  const [confirmedTotal, setConfirmedTotal] = useState<number | null>(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingEstimate = address && zonePrice !== null ? (subtotal >= 299 ? 0 : zonePrice) : null;
  const total = payment === "pix" ? items.reduce((s, i) => s + i.product.pixPrice * i.quantity, 0) : subtotal;

  async function onCepBlur() {
    const revision = ++cepRevision.current;
    setAddress(null); setZonePrice(null); setCepStatus("");
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) { if (digits.length) setCepStatus("CEP inválido."); return; }
    setCepStatus("Consultando CEP…");
    const found = await lookupCep(digits);
    if (revision !== cepRevision.current) return;
    if (!found) { setCepStatus("Não foi possível localizar esse CEP. Confira e tente novamente."); return; }
    setAddress(found); setCepStatus(`${found.street ? found.street + ", " : ""}${found.city} - ${found.uf}`);
    // Public reference table: safe to read for a display estimate; the server still recomputes the authoritative total on insert.
    const { data } = await supabase.from("shipping_zones").select("price").eq("uf", found.uf).single();
    if (revision !== cepRevision.current) return;
    setZonePrice(data ? Number(data.price) : null);
    if (!data) setCepStatus("Não foi possível calcular o frete. Confira o CEP e tente novamente.");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !items.length || !address || zonePrice === null) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Sua sessão expirou. Entre novamente."); return; }
      const { data, error: saveError } = await supabase.from("orders").insert({
        id: requestId, user_id: user.id, customer_name: form.get("name"),
        payment_method: payment, shipping_uf: address.uf,
        requested_items: items.map(i => ({ id: i.product.id, quantity: i.quantity })),
      }).select("id,total").single();
      let confirmedOrderId: string | undefined = data?.id;
      let savedTotal = data?.total;
      if (saveError) {
        if (saveError.code === "23505") {
          const { data: existing } = await supabase.from("orders").select("id,total").eq("id", requestId).single();
          confirmedOrderId = existing?.id;
          savedTotal = existing?.total;
        }
      }
      if (!confirmedOrderId) { setError("Não foi possível registrar. Confira a disponibilidade dos produtos ou aguarde um minuto antes de tentar novamente."); return; }
      setOrderId(confirmedOrderId); setConfirmedTotal(Number(savedTotal)); setDone(true); onSuccess();
      setPaymentMessage("Preparando pagamento de teste…");
      void supabase.functions.invoke("send-order-email", { body: { order_id: confirmedOrderId, template: "order_received" } }).catch(() => {});
      const { data: payData, error: paymentError } = await supabase.functions.invoke("create-payment-preference", { body: { order_id: confirmedOrderId } });
      if (payData?.init_point) { setCheckoutUrl(payData.init_point); setPaymentMessage(""); }
      else setPaymentMessage(paymentError ? "Pedido salvo. Não foi possível preparar o pagamento. Consulte Meus pedidos para tentar novamente." : "Pagamento ainda não configurado. Seu pedido está salvo em Meus pedidos.");
    } catch { setError("Falha de conexão. Tente novamente; o pedido não será duplicado."); }
    finally { setBusy(false); }
  }

  if (!open) return null;
  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-label="Checkout demonstrativo">
      <button className="modal-backdrop" onClick={onClose} aria-label="Fechar checkout" />
      <div className="checkout-modal">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Fechar">×</button>
        {done ? (
          <div className="success-state"><span>✓</span><p className="eyebrow">Pedido demonstrativo</p><h2>Pedido de teste registrado.</h2><p>Seu pedido foi salvo. Nenhuma cobrança ou reserva de estoque foi realizada por padrão. Pagamento e entrega dependem da configuração das integrações.</p><p>Identificador: {orderId}</p>
            {confirmedTotal !== null && <p>Total registrado: <strong>{money.format(confirmedTotal)}</strong></p>}
            {checkoutUrl ? <a className="primary-button full" href={checkoutUrl} target="_blank" rel="noreferrer">Pagar agora (sandbox)</a> : <p role="status">{paymentMessage}</p>}
            <button className="link-button" onClick={() => { setDone(false); onClose(); }}>Voltar à loja</button></div>
        ) : (
          <div className="checkout-grid">
            <form onSubmit={submit}>
              <span className="eyebrow">Checkout seguro · demonstração</span><h2>Quase lá</h2>
              <div className="form-grid">
                <label>Nome completo<input name="name" required minLength={2} maxLength={120} placeholder="Seu nome" /></label>
                <label>CEP<input name="cep" required inputMode="numeric" autoComplete="postal-code" maxLength={9} placeholder="00000-000" value={cep} onChange={e => { ++cepRevision.current; setCep(e.target.value); setAddress(null); setZonePrice(null); setCepStatus(""); }} onBlur={() => void onCepBlur()} /></label>
              </div>
              <p role="status">{cepStatus}</p>
              <p>Pedido de teste vinculado à sua conta. Frete é calculado pelo estado do CEP; pagamento depende das integrações configuradas.</p>
              <h3>Forma de pagamento</h3>
              <div className="payment-options">
                {[["pix", "PIX", "5% de desconto"], ["card", "Cartão", "até 6x sem juros"], ["boleto", "Boleto", "vence em 2 dias"]].map(([id, title, subtitle]) => (
                  <label key={id} className={payment === id ? "selected" : ""}><input type="radio" name="payment" value={id} checked={payment === id} onChange={() => setPayment(id)} /><span><strong>{title}</strong><small>{subtitle}</small></span></label>
                ))}
              </div>
              <p role="alert">{error}</p><button className="primary-button full" type="submit" disabled={busy || !items.length || !address || zonePrice === null}>{busy ? "Salvando…" : "Registrar pedido"}</button>
            </form>
            <aside className="order-summary"><h3>Resumo</h3>{items.map(i => <div className="summary-item" key={i.product.id}><span>{i.quantity}× {i.product.name}</span><strong>{money.format((payment === "pix" ? i.product.pixPrice : i.product.price) * i.quantity)}</strong></div>)}<hr/><div><span>Frete</span><strong>{shippingEstimate === null ? (address ? "Calculando…" : "Informe o CEP") : shippingEstimate === 0 ? "Grátis" : money.format(shippingEstimate)}</strong></div><div className="summary-total"><span>Total estimado</span><strong>{money.format(total + (shippingEstimate ?? 0))}</strong></div></aside>
          </div>
        )}
      </div>
    </div>
  );
}
