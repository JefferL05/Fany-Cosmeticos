# Configuração comercial da Fany

## Estado atual

- Catálogo e checkout demonstrativos; o pagamento usa somente o link sandbox do Mercado Pago.
- Site URL do Supabase: `https://fany-cosmeticos.vercel.app`.
- Migrações de integrações e correção da marca aplicadas ao projeto `ylcoubtyvfnoqmwkkmcn`.
- A instalação remota registra `store_foundation` como `20260920134922`; o arquivo original do repositório usa `20260920134549`. Comparar os schemas e reconciliar esse histórico antes de usar `supabase db push` automaticamente; não reaplicar a fundação em um banco existente.
- Cotações por estado são demonstrações, não cotações dos Correios.
- Pedidos de teste não reservam estoque. A reserva, expiração e baixa transacional precisam ser implementadas e testadas antes de ativar vendas reais.

## Dados a fornecer

1. Nome comercial, razão social/documento aplicável, e-mail e WhatsApp de atendimento.
2. CEP e endereço de origem dos envios, horário de atendimento e prazo de preparação.
3. Para cada produto: nome, marca, descrição, preço, estoque, fotos, peso embalado em kg e dimensões da embalagem em cm. Confirmar desconto Pix e parcelamento.
4. Regras de entrega, troca, devolução e endereço de retorno.
5. Conta de desenvolvedor Mercado Pago com aplicação e usuários de teste.
6. Provedor de frete: Melhor Envio (Correios/transportadoras) ou contrato/API próprios. A integração depende dessa escolha, do CEP e das dimensões reais.
7. Provedor de e-mail e remetente autorizado. Supabase Auth precisa de SMTP para enviar e-mails a clientes externos sem as restrições do serviço de teste.

## Segredos (somente nos painéis dos provedores)

Supabase → Edge Functions → Secrets:

- `MERCADO_PAGO_ACCESS_TOKEN`: credencial de teste da aplicação.
- `MERCADO_PAGO_WEBHOOK_SECRET`: segredo de assinatura configurado no Mercado Pago.
- `STORE_URL`: URL pública da loja.
- `RESEND_API_KEY` e `RESEND_FROM_EMAIL`: credencial e remetente verificado, com nome `Fany Cosméticos`.

Configurar webhook de **pagamentos** no Mercado Pago para `https://ylcoubtyvfnoqmwkkmcn.supabase.co/functions/v1/mercadopago-webhook`. Essa função recebe assinatura do provedor e precisa de `verify_jwt = false`; as outras funções mantêm JWT ligado e verificam o usuário/serviço no código.

Não enviar senhas ou tokens por chat nem versionar `.env` reais.

## Validação antes das vendas

- Confirmar cadastro e recuperação de senha com SMTP configurado.
- Comprar com usuário de teste, conferir total com frete, aprovação, recusa e estorno.
- Repetir a notificação e verificar idempotência; tentar pagar outro pedido/valor e confirmar rejeição.
- Testar concorrência e expiração de reservas após implementar estoque real.
- Publicar políticas e contatos a partir dos dados fornecidos, sem valores ou prazos inventados.
- Hospedagem definitiva por último, depois da validação funcional.
