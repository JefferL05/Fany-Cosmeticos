"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export function AccountPanel({ onClose, recovery = false }: { onClose: () => void; recovery?: boolean }) {
  const [signup, setSignup] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(e.currentTarget);
    const credentials = { email: String(form.get("email")).trim(), password: String(form.get("password")) };
    try {
      if (recovery) {
        if (credentials.password !== form.get("confirmPassword")) { setMessage("As senhas precisam ser iguais."); return; }
        const { error } = await supabase.auth.updateUser({ password: credentials.password });
        setMessage(error ? "Não foi possível atualizar. Solicite outro link e tente novamente." : "Senha atualizada. Você já pode fechar esta janela.");
        return;
      }
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(credentials.email, { redirectTo: window.location.origin });
        setMessage(error ? "Não foi possível enviar agora. Tente novamente mais tarde." : "Se houver uma conta com esse e-mail, você receberá as instruções para redefinir a senha.");
        return;
      }
      const { data, error } = signup ? await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: window.location.origin } }) : await supabase.auth.signInWithPassword(credentials);
      if (error) { setMessage(signup ? "Não foi possível cadastrar. Confira os dados e tente novamente." : "Não foi possível entrar. Confira seu e-mail, senha e confirmação de cadastro."); return; }
      if (data.session) onClose();
      else setMessage("Confira seu e-mail para confirmar o cadastro. Depois volte aqui e entre com sua senha.");
    } catch { setMessage("Falha de conexão. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <div className="modal-shell" role="dialog" aria-modal="true" aria-label="Sua conta">
    <button className="modal-backdrop" onClick={onClose} aria-label="Fechar" />
    <div className="checkout-modal account-panel"><button className="icon-button modal-close" onClick={onClose} aria-label="Fechar">×</button>
      <h2>{recovery ? "Nova senha" : forgot ? "Recuperar acesso" : signup ? "Criar conta" : "Entrar na sua conta"}</h2>
      <form onSubmit={submit} className="account-form">
        {!recovery && <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>}
        {!forgot && <label>Senha<input name="password" type="password" minLength={8} required autoComplete={signup || recovery ? "new-password" : "current-password"}/></label>}
        {recovery && <label>Confirmar senha<input name="confirmPassword" type="password" minLength={8} required autoComplete="new-password"/></label>}
        <button className="primary-button" disabled={busy}>{busy ? "Aguarde…" : recovery ? "Salvar senha" : forgot ? "Enviar instruções" : signup ? "Cadastrar" : "Entrar"}</button>
      </form>
      <p role="status">{message}</p>
      {!recovery && <>
        <button className="link-button" onClick={() => { setSignup(!signup); setForgot(false); setMessage(""); }}>{signup ? "Já tenho conta" : "Criar uma conta"}</button>
        <button className="link-button" onClick={() => { setForgot(!forgot); setSignup(false); setMessage(""); }}>{forgot ? "Voltar ao login" : "Esqueci minha senha"}</button>
      </>}
    </div>
  </div>;
}
