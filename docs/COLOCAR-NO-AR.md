# Colocando sua loja no ar (passo a passo, sem programar)

Tempo estimado: **15 minutos**. Custo: **R$ 0**.

## 1. Crie sua conta na Cloudflare

1. Acesse [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) e crie uma conta grátis.
2. Confirme seu e-mail.

> A Cloudflare é onde seu site vai "morar". O plano grátis permite uso comercial.

## 2. Publique com um clique

1. No README do projeto, clique em **Deploy to Cloudflare**.
2. Entre com sua conta da Cloudflare (e do GitHub, se pedir: ele cria uma cópia do projeto para você).
3. Na tela de configuração:
   - **Nome do projeto:** o que quiser (vira parte do endereço, ex.: `minha-escola`).
   - **SETUP_CODE:** invente uma senha só sua, ex.: `abacaxi-azul-2026`. Ela será pedida uma única vez, para criar o administrador.
   - O banco de dados e o armazenamento são criados automaticamente.
4. Clique em **Deploy** e espere 1 ou 2 minutos.
5. No fim aparece o endereço do seu site, algo como `https://minha-escola.SEU-NOME.workers.dev`.

## 3. Crie sua conta de administrador

1. Abra `https://SEU-SITE/admin`.
2. Digite o `SETUP_CODE`, seu e-mail e uma senha forte.
3. Você cai nas **Configurações**.

## 4. Escolha como receber

### Opção A: Pix direto (grátis, você confirma)

Em **Configurações → Pix direto na sua conta**:
- Marque "Ativar Pix direto".
- Chave Pix: e-mail, CPF/CNPJ, chave aleatória ou celular no formato `+5511999999999`.
- Nome e cidade: como estão no seu banco.

Quando alguém comprar, você recebe um aviso, confere o Pix no app do banco e clica em **Confirmar Pix** em *Pedidos*.

### Opção B: Mercado Pago (automático, Pix + cartão)

1. Crie/entre na sua conta em [mercadopago.com.br](https://www.mercadopago.com.br) (CPF serve).
2. Vá em [Suas integrações](https://www.mercadopago.com.br/developers/panel/app) → **Criar aplicação** (tipo "Pagamentos online").
3. Em **Credenciais de produção**, copie o **Access Token** (`APP_USR-...`) e cole no painel.
4. Em **Webhooks → Configurar notificações**: cole a URL que o painel mostra (`https://SEU-SITE/webhooks/mercadopago`), marque **Pagamentos** e salve. Copie a **assinatura secreta** e cole no painel.
5. Marque "Pix via Mercado Pago" e/ou "Cartão de crédito" e salve.

> Quer testar antes? Use as **credenciais de teste** (`TEST-...`) e os [cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/cards) do Mercado Pago.

Dá para usar A e B juntos.

## 5. E-mails automáticos (opcional, recomendado)

1. Crie uma conta grátis em [resend.com](https://resend.com).
2. Em **Domains**, adicione e verifique seu domínio (ou use o domínio de teste para experimentar).
3. Em **API Keys**, crie uma chave e cole no painel junto com o e-mail remetente.

Sem isso a loja funciona normalmente. O aluno só não recebe e-mails.

## 6. Crie seu primeiro curso

1. **Cursos → Novo curso**: título, preço, frase de chamada, o que o aluno aprende, descrição e capa.
2. Adicione módulos e aulas. Em cada aula, envie o vídeo (MP4) direto pelo painel.
3. Marque **Publicado** e salve.

Sua página de vendas fica em `https://SEU-SITE/c/nome-do-curso`. É esse link que você divulga.

## 7. (Opcional) Use seu próprio domínio

Se você tem um domínio (ex.: `minhaescola.com.br`), no painel da Cloudflare abra o Worker → **Settings → Domains & Routes → Add → Custom domain**. Depois atualize a URL do webhook no Mercado Pago.

---

## Dúvidas comuns

**Preciso deixar meu computador ligado?** Não. O site roda na Cloudflare 24h por dia.

**Vai ficar grátis para sempre?** O plano grátis da Cloudflare é bem generoso (100 mil acessos/dia, 10 GB de vídeos). Se um dia não bastar, o plano pago custa a partir de US$ 5/mês. Ainda sem comissão.

**E se o aluno pagar e depois pedir reembolso?** Dentro do prazo de garantia, ele clica em "Pedir reembolso" e o acesso é cortado na hora. No Mercado Pago o dinheiro volta automaticamente. No Pix direto você devolve pelo app do banco e marca como reembolsado.

**E se ele estornar o cartão?** O Mercado Pago avisa o site e o acesso é cortado automaticamente.

**Preciso emitir nota fiscal?** Isso depende da sua situação (MEI, PJ ou pessoa física). Converse com um contador. É uma obrigação sua como vendedor, como em qualquer plataforma.

**Esqueci a senha do painel.** No painel da Cloudflare abra o banco D1 (`taxa-zero-db`) → Console e rode `DELETE FROM admins;`. Depois acesse `/admin` de novo e use o `SETUP_CODE`.
