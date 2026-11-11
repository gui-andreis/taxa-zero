# O que falta no Taxa Zero (e o que pode melhorar)

Este documento é um diagnóstico do estado atual do Taxa Zero (código em `src/`, versão 0.1.0) comparado com o que Hotmart, Kiwify e Eduzz oferecem e com o que uma loja séria precisa para rodar sem sustos. Serve como lista de trabalho: cada item diz o que é, por que importa, quanto dá de trabalho, a prioridade e onde mexer no código.

> Fora do escopo deste documento, porque já estão sendo feitos em paralelo: **modo claro/escuro** e **cupons de desconto** (com validade e limite de uso).

---

## Resumo

O Taxa Zero já resolve bem o essencial: vitrine, página de vendas, checkout com Pix direto e Mercado Pago, área do aluno protegida, reembolso em 7 dias, painel com pedidos e 5 temas. A base de segurança é boa (pagamento sempre conferido na API, sessões com hash, CSP sem script inline, CSRF por Origin).

O que mais falta hoje se divide em quatro blocos:

1. **Não perder a loja nem os dados.** Não há backup nem exportação. Quem esquece a senha do painel precisa rodar SQL no console da Cloudflare. Não existem tarefas agendadas, então Pix vencidos e pagamentos de cartão sem webhook ficam parados para sempre.
2. **Caber no plano grátis de verdade.** Os vídeos do R2 passam pelo Worker, e cada pedaço de vídeo conta como uma requisição. Com poucos alunos assistindo, o limite de 100 mil requisições por dia pode acabar. O hash de senha também pode passar do limite de CPU do plano grátis.
3. **Vender e reter como as concorrentes.** Faltam progresso do aluno, certificado, comentários, recuperação de carrinho, pixel/UTM, prévia de link no WhatsApp (Open Graph), order bump, upsell, liberação manual de acesso e importação de alunos de outra plataforma.
4. **LGPD e confiança.** O aluno não consegue ver, exportar nem apagar os próprios dados. O vendedor não tem registro de quem fez o quê. Trocar a chave Pix não pede senha nem gera aviso.

### Os 10 mais importantes, em ordem

| # | Item | Esforço | Área |
|---|---|---|---|
| 1 | [Recuperar e trocar a senha do painel sem SQL](#a1-recuperar-e-trocar-a-senha-do-painel-sem-mexer-no-banco) | P | Vendedor / Instalação |
| 2 | [Vídeos do R2 gastam o limite diário de requisições](#a2-vídeos-do-r2-consomem-o-limite-de-requisições-do-plano-grátis) | M | Operação |
| 3 | [Backup e exportação de dados (CSV e banco)](#a3-backup-e-exportação-de-dados) | M | Operação / LGPD |
| 4 | [Tarefas agendadas: expirar Pix e conferir pedidos parados](#a4-tarefas-agendadas-cron-expirar-pix-e-conferir-pedidos-parados) | M | Operação / Pagamentos |
| 5 | [Proteger configurações sensíveis (chave Pix, token, 2FA)](#a5-proteger-configurações-sensíveis-chave-pix-token-do-mercado-pago) | M | Segurança |
| 6 | [Progresso do aluno e "continuar de onde parei"](#a6-progresso-do-aluno-e-continuar-de-onde-parei) | M | Aluno |
| 7 | [Recuperação de carrinho e lembrete de Pix](#a7-recuperação-de-carrinho-e-lembrete-de-pix) | M | Vendas |
| 8 | [Área "Minha conta" com exportar e apagar dados (LGPD)](#a8-minha-conta-do-aluno-com-exportar-e-apagar-dados-lgpd) | M | LGPD / Aluno |
| 9 | [Liberar acesso manualmente e importar alunos](#a9-liberar-acesso-manualmente-e-importar-alunos-de-outra-plataforma) | M | Vendedor |
| 10 | [Testes automatizados do fluxo de compra e CI em pull request](#a10-testes-automatizados-do-fluxo-de-compra-e-ci-em-pull-request) | M | Qualidade |

Logo depois vêm: pixel e UTM, Open Graph, checkout sem criar senha, medir o CPU do hash de senha, tela de diagnóstico e certificado.

### Como ler

- **Esforço:** **P** (pequeno, até 1 dia), **M** (médio, alguns dias), **G** (grande, uma semana ou mais, ou depende de terceiros).
- **Prioridade:** **alta** (risco de perder dinheiro, dados ou a loja, ou um atrito que derruba vendas), **média** (deixa o produto competitivo), **baixa** (refinamento ou nicho).
- Os caminhos de arquivo são relativos à raiz do repositório. Mudanças de banco seguem a regra do projeto: **adicionar** uma nova entrada no fim de `MIGRATIONS` em `src/db/schema.ts`.

---

## Prioridade alta

### A1. Recuperar e trocar a senha do painel sem mexer no banco

- **O que é:** hoje não existe "esqueci minha senha" para o vendedor nem tela para trocar a senha ou o e-mail do painel. O guia manda abrir o D1 no console da Cloudflare e rodar `DELETE FROM admins;`.
- **Por que importa:** o público-alvo não programa. Rodar SQL em produção assusta e é arriscado (um comando errado apaga outra tabela). Também não há como trocar uma senha vazada.
- **Como fazer:** (1) página "Minha conta" no painel para trocar e-mail e senha, pedindo a senha atual; (2) "Esqueci a senha" do painel por e-mail quando o Resend estiver configurado; (3) quando não houver e-mail, permitir redefinir informando o `SETUP_CODE` (que só o dono conhece). Ao trocar a senha, encerrar as outras sessões.
- **Esforço:** P · **Prioridade:** alta
- **Onde mexer:** `src/routes/admin.tsx` (novas rotas `/admin/conta`, `/admin/esqueci`, `/admin/redefinir/:token`), reaproveitando o fluxo de `src/routes/student.tsx` (`/esqueci` e `/redefinir`). A tabela `password_resets` hoje só tem `student_id`: criar uma tabela para o admin ou adicionar uma coluna `kind`. Atualizar `docs/COLOCAR-NO-AR.md` (seção "Esqueci a senha do painel").

### A2. Vídeos do R2 consomem o limite de requisições do plano grátis

- **O que é:** o player aponta para `/media/v/:lessonId`, e o Worker repassa o vídeo do R2. O navegador baixa vídeo em pedaços (requisições com `Range`), e **cada pedaço é uma invocação do Worker**, com uma consulta ao banco (`hasAccess`) em cada uma.
- **Por que importa:** o plano grátis tem 100 mil requisições por dia. Uma aula de 20 minutos pode gerar dezenas ou centenas de requisições por aluno. Uma turma de algumas centenas de alunos assistindo no mesmo dia pode esgotar o limite, e aí **a loja inteira para** (vitrine e checkout também), não só os vídeos. O README promete "o número de alunos não importa", o que só vale para o espaço guardado.
- **Como fazer:**
  - Curto prazo: medir quantas requisições uma aula típica gera e documentar isso no README, com um número honesto de "alunos simultâneos por dia" no plano grátis. Mostrar no painel um aviso quando o uso se aproximar do limite.
  - Gerar um token curto e assinado (HMAC, alguns minutos de validade) na página da aula e validar só a assinatura em `/media/v/`, sem consultar o banco a cada pedaço. Isso não reduz requisições, mas reduz leituras no D1 e a latência.
  - Para reduzir requisições de fato: URL pré-assinada do R2 (API S3) com validade curta, para o navegador baixar direto do R2 sem passar pelo Worker. Exige gerar credenciais S3 do R2, então precisa de um passo guiado no painel.
  - Recomendar Bunny Stream ou outro serviço para quem tem muitos alunos, deixando claro o motivo.
- **Esforço:** M · **Prioridade:** alta
- **Onde mexer:** `src/routes/media.ts` (`/v/:lessonId`), `src/routes/student.tsx` (montagem do `<video>`), `src/lib/crypto.ts` (assinatura), README (seção de limites).

### A3. Backup e exportação de dados

- **O que é:** não existe nenhum botão para baixar pedidos, alunos ou o banco inteiro. O D1 grátis tem "Time Travel" de só 7 dias, e os vídeos no R2 não têm cópia.
- **Por que importa:** pedidos são registro fiscal e prova em caso de contestação ou disputa no Procon. Um erro (apagar curso, comando SQL errado, conta Cloudflare suspensa) hoje pode levar todo o histórico de vendas. Exportar também é necessário para o contador, para a nota fiscal e para mudar de plataforma.
- **Como fazer:**
  - Botões no painel para "Exportar pedidos (CSV)" e "Exportar alunos (CSV)", com filtro por período e status. O CSV deve usar `;` e vírgula decimal para abrir direto no Excel em português.
  - Botão "Baixar backup completo" que gera um JSON ou SQL com todas as tabelas (sem as sessões e com os segredos removidos ou avisando que eles estão incluídos).
  - Backup automático semanal (Cron Trigger, ver A4) gravando o arquivo em uma pasta `backups/` privada no R2, mantendo as últimas N cópias.
  - Documentar `npx wrangler d1 export taxa-zero-db --remote --output backup.sql` e o Time Travel no `docs/`.
  - Restauração: pelo menos documentar como restaurar a partir do arquivo.
- **Esforço:** M · **Prioridade:** alta
- **Onde mexer:** nova rota em `src/routes/admin.tsx` (ou um arquivo novo `src/routes/admin-export.ts`), handler `scheduled` em `src/index.tsx`, `triggers.crons` em `wrangler.jsonc`.

### A4. Tarefas agendadas (cron): expirar Pix e conferir pedidos parados

- **O que é:** o app não tem nenhum handler `scheduled`. Tudo acontece só quando alguém abre uma página. A limpeza de sessões roda em 1% das requisições (`Math.random() < 0.01` em `src/index.tsx`).
- **Por que importa:**
  - Pedidos de Pix direto ficam "Aguardando pagamento" para sempre e poluem o painel.
  - O Pix do Mercado Pago vence em 24 horas, mas o pedido só vira "cancelado" se alguém abrir a página.
  - Se o webhook falhar (URL errada, site fora do ar, `workers.dev` antes de configurar) e o aluno fechar a aba, um **pagamento aprovado no cartão fica sem liberar acesso** até alguém olhar. É o pior tipo de suporte.
  - Recuperação de carrinho (A7) e backup automático (A3) dependem de agendamento.
- **Como fazer:** adicionar `triggers.crons` (por exemplo, a cada 15 minutos e uma vez por dia) e um `scheduled()` que: (1) chama `refreshFromMp` para pedidos MP `pending` com menos de 48 horas; (2) cancela Pix direto `pending` com mais de X dias (configurável); (3) roda `cleanupExpired`; (4) dispara os lembretes de A7; (5) faz o backup de A3. Cuidado com o limite de 50 consultas por invocação no plano grátis: processar em lotes pequenos.
- **Esforço:** M · **Prioridade:** alta
- **Onde mexer:** `wrangler.jsonc`, `src/index.tsx` (exportar `{ fetch: app.fetch, scheduled }`), `src/lib/orders.ts`, `src/lib/auth.ts`.

### A5. Proteger configurações sensíveis (chave Pix, token do Mercado Pago)

- **O que é:** quem tiver uma sessão do painel (computador emprestado, cookie roubado, sessão de 7 dias esquecida aberta) consegue **trocar a chave Pix** ou o token do Mercado Pago sem digitar a senha, e o dono não recebe aviso. Não há segundo fator (2FA). O `SETUP_CODE` é opcional: sem ele, quem abrir `/admin/setup` primeiro vira dono da loja.
- **Por que importa:** trocar a chave Pix é o golpe mais direto possível: as próximas vendas caem na conta de outra pessoa, e o vendedor só percebe quando os alunos reclamarem.
- **Como fazer:**
  - Pedir a senha atual para salvar alterações em Pix, Mercado Pago e e-mail do vendedor.
  - Enviar um e-mail ao vendedor sempre que a chave Pix, o token ou o e-mail mudar, e mostrar no topo do painel "Chave Pix alterada em DD/MM às HH:MM".
  - 2FA opcional por app autenticador (TOTP, dá para fazer só com `crypto.subtle`, sem dependência) e códigos de recuperação.
  - Lista de sessões ativas com "sair de todos os aparelhos".
  - Tornar o `SETUP_CODE` obrigatório: se não estiver definido, `/admin/setup` mostra como definir e não deixa criar o admin.
- **Esforço:** M · **Prioridade:** alta
- **Onde mexer:** `src/routes/admin.tsx` (`POST /configuracoes`, `SetupPage`, `POST /setup`), `src/lib/auth.ts`, `src/lib/email.ts`, nova migração para segredo TOTP e `last_sensitive_change`.

### A6. Progresso do aluno e "continuar de onde parei"

- **O que é:** a barra no player mostra só "Aula X de Y" pela posição da aula aberta, não pelo que o aluno concluiu. Não existe marcar aula como concluída, nem lembrar a última aula vista, nem percentual na lista "Meus cursos". Hotmart (Hotmart Club), Kiwify e Eduzz (Nutror) têm tudo isso.
- **Por que importa:** progresso visível aumenta a conclusão do curso, que reduz reembolsos e aumenta recompra. Também é pré-requisito do certificado (M2). Ao voltar, o aluno hoje sempre cai na primeira aula.
- **Como fazer:** tabela `lesson_progress (student_id, lesson_id, completed_at, last_seen_at)`; botão "Marcar como concluída" (e marcar sozinho ao chegar perto do fim do vídeo R2, via evento `ended`/`timeupdate` em `src/views/client.ts`); `/aluno/curso/:id` redireciona para a última aula vista; cartão em "Meus cursos" com "45% concluído"; ícone de concluída na lista lateral. No painel, coluna de progresso médio por curso.
- **Esforço:** M · **Prioridade:** alta
- **Onde mexer:** `src/db/schema.ts`, `src/routes/student.tsx` (player e `/`), `src/views/client.ts`, `src/views/styles.ts`.

### A7. Recuperação de carrinho e lembrete de Pix

- **O que é:** quando o comprador gera o Pix e não paga, ou desiste no cartão, ninguém é avisado. As três concorrentes recuperam vendas por e-mail (e algumas por WhatsApp) e mostram o "carrinho abandonado" ao vendedor.
- **Por que importa:** no Pix, uma parte grande dos pedidos gerados não é paga na hora. Um lembrete simples ("seu Pix ainda está disponível") recupera vendas sem custo nenhum.
- **Como fazer:**
  - Com o cron (A4), enviar 1 ou 2 e-mails para pedidos `pending`: um após cerca de 1 hora e outro após 24 horas, com link para `/pedido/:id`. Para Pix MP vencido, o link deve gerar um Pix novo.
  - Aba "Abandonados" em Pedidos, com nome, e-mail, curso e botão "copiar mensagem para WhatsApp" (sem integração paga).
  - Configuração para ligar/desligar e editar o texto. Registrar envio para não repetir (`reminder_sent_at` em `orders`).
  - Opcional: guardar o e-mail digitado no checkout antes de concluir, para recuperar quem saiu antes de gerar o pedido. Isso exige base legal clara (ver LGPD) e um aviso no formulário.
- **Esforço:** M · **Prioridade:** alta
- **Onde mexer:** `src/lib/orders.ts`, handler `scheduled` (A4), `src/lib/email.ts`, `src/routes/admin.tsx` (aba nova), `src/routes/public.tsx`.

### A8. "Minha conta" do aluno, com exportar e apagar dados (LGPD)

- **O que é:** o aluno não tem página de conta. Não dá para trocar nome, e-mail ou senha (só por "esqueci a senha"), ver recibos, baixar os próprios dados ou pedir exclusão. Os termos dizem "fale com o suporte". O vendedor também não tem botão para apagar ou anonimizar um aluno.
- **Por que importa:** a LGPD (art. 18) garante ao titular acesso, correção, portabilidade e eliminação dos dados. Responder isso à mão é trabalhoso e sujeito a erro. O vendedor é o controlador e responde por isso.
- **Como fazer:**
  - `/aluno/conta`: editar nome, trocar e-mail (com confirmação no e-mail novo), trocar senha, "sair de todos os aparelhos".
  - "Baixar meus dados" (JSON com cadastro, pedidos e progresso).
  - "Excluir minha conta": apaga sessões e progresso, e **anonimiza** o cadastro (nome e e-mail trocados por algo como `removido-123`) mantendo os pedidos pagos pelo prazo de guarda fiscal. Explicar isso na tela.
  - No painel, em Alunos: "Exportar dados deste aluno" e "Anonimizar".
- **Esforço:** M · **Prioridade:** alta
- **Onde mexer:** `src/routes/student.tsx`, `src/routes/admin.tsx` (`/alunos`), texto padrão em `src/routes/public.tsx` (`/termos`).

### A9. Liberar acesso manualmente e importar alunos de outra plataforma

- **O que é:** não há como dar acesso a alguém sem uma compra: bolsista, parceiro, aluno que pagou por fora ou, principalmente, **quem está migrando da Hotmart ou da Kiwify** com centenas de alunos.
- **Por que importa:** é o maior obstáculo para trocar de plataforma. Sem importar a base, o vendedor precisa manter as duas plataformas. Também resolve suporte ("paguei por transferência").
- **Como fazer:**
  - Em Alunos ou no curso: "Adicionar aluno" (nome, e-mail, curso). Cria o aluno e um pedido com novo método `manual` (ou `gift`), valor 0 ou valor informado, status `paid`. Envia e-mail de boas-vindas com link para criar a senha (reaproveitando `password_resets`).
  - "Importar CSV" com colunas nome, e-mail, curso e data, aceitando o formato de exportação das plataformas mais comuns. Mostrar prévia antes de confirmar e processar em lotes (limite de 50 consultas por invocação no plano grátis).
  - Manter a regra única de acesso: o pedido `paid` continua sendo o que libera, então `hasAccess()` não muda.
- **Esforço:** M · **Prioridade:** alta
- **Onde mexer:** `src/env.ts` (`PaymentMethod`), `src/lib/format.ts` (`METHOD_LABEL`), `src/routes/admin.tsx`, `src/lib/orders.ts` (os reembolsos não devem tentar o Mercado Pago para pedidos manuais).

### A10. Testes automatizados do fluxo de compra e CI em pull request

- **O que é:** existem 6 testes unitários (Pix, preço, slug, markdown, senha). Nenhum teste cobre rotas, regra de acesso, máquina de estados dos pedidos, webhook ou reembolso. O CI (`.github/workflows/demo.yml`) só roda em push na `main`, junto com a publicação da demo, e não em pull requests.
- **Por que importa:** o que mais pode dar prejuízo (liberar curso sem pagar, não liberar quem pagou, reembolso duplicado) não tem teste. Como o projeto aceita contribuições, um PR pode quebrar o pagamento sem ninguém perceber.
- **Como fazer:**
  - Testes de integração com `@cloudflare/vitest-pool-workers` (ou Miniflare) usando D1 e R2 locais: compra com Pix direto do começo ao fim, "Já paguei" e confirmação, reembolso do aluno dentro e fora do prazo, aluno A sem acesso ao pedido ou vídeo do aluno B, webhook com assinatura inválida, pagamento MP com valor menor que o pedido (com `fetch` simulado).
  - Teste da regra de CSRF (POST de outra origem precisa dar 403).
  - Workflow `ci.yml` em `pull_request` rodando typecheck e testes.
  - Opcional: lint e formatação (Biome ou ESLint com Prettier).
- **Esforço:** M · **Prioridade:** alta
- **Onde mexer:** `test/`, `package.json`, `.github/workflows/`.

### A11. Pixel, UTM e eventos de conversão

- **O que é:** não há como instalar Meta Pixel, Google Analytics 4, Google Ads ou TikTok Pixel, e não se registra de onde veio a venda (UTM). A CSP (`script-src 'self'`) bloqueia qualquer script de terceiros.
- **Por que importa:** quem vende com tráfego pago precisa disso para otimizar anúncios. É um dos primeiros recursos que o infoprodutor procura nas concorrentes, e a falta dele impede a migração de quem anuncia.
- **Como fazer:**
  - Guardar `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` e `src` em cookie na primeira visita e gravar no pedido. Mostrar relatório "vendas por origem" no painel.
  - Campos no painel para os IDs do Meta Pixel, GA4 e TikTok. Carregar os scripts de forma explícita, ampliando a CSP **só** para os domínios dos serviços ligados, sem script inline (um arquivo `/assets/pixels.js` gerado a partir das configurações).
  - Disparar `PageView`, `InitiateCheckout` e `Purchase` (com valor) na tela de pedido pago, uma vez só.
  - Melhor para privacidade e para bloqueadores: API de Conversões do Meta e Measurement Protocol do GA4 chamados pelo servidor no `markPaid`, sem script no navegador.
  - Banner de consentimento de cookies quando algum pixel estiver ligado (ver M21).
- **Esforço:** M · **Prioridade:** alta
- **Onde mexer:** `src/index.tsx` (CSP), `src/views/layout.tsx`, `src/routes/public.tsx` (checkout e pedido), `src/lib/orders.ts` (`markPaid`), `src/lib/settings.ts`, migração com colunas UTM em `orders`.

### A12. Prévia do link no WhatsApp e redes (Open Graph)

- **O que é:** as páginas não têm `og:title`, `og:description`, `og:image` nem `twitter:card`. Ao colar o link do curso no WhatsApp, Instagram ou Telegram, não aparece capa nem descrição.
- **Por que importa:** o link da página de vendas é divulgado justamente nesses lugares. Um link sem imagem parece suspeito e tem menos cliques.
- **Como fazer:** aceitar `image` e `url` em `Layout`/`Head` e preencher na página de vendas com a capa do curso (URL absoluta) e o subtítulo. Na home, usar o logo. Acrescentar `<link rel="canonical">`.
- **Esforço:** P · **Prioridade:** alta
- **Onde mexer:** `src/views/layout.tsx` (`Head`), `src/routes/public.tsx` (`/c/:slug` e `/`).

### A13. Checkout sem precisar criar senha

- **O que é:** para comprar, o visitante precisa inventar uma senha de 8 caracteres. Se já comprou antes e esqueceu a senha, a compra é bloqueada com "a senha não confere" e ele é mandado para outra tela.
- **Por que importa:** cada campo a mais no checkout derruba conversão, e esquecer a senha antiga no meio da compra é um dos piores atritos possíveis. As concorrentes pedem só nome, e-mail (e às vezes CPF e telefone) e mandam o acesso por e-mail.
- **Como fazer:**
  - Checkout pede só nome e e-mail. Se o e-mail for novo, cria o aluno sem senha e a sessão já fica ativa. Na tela de pagamento confirmado, oferecer "Crie sua senha" (opcional) e mandar no e-mail de liberação um link de acesso.
  - Se o e-mail já existe, **não** pedir senha para comprar: criar o pedido vinculado ao e-mail, sem fazer login. Para assistir, o aluno entra pelo link enviado por e-mail ou pela senha. Isso também acaba com a revelação de que um e-mail tem cadastro.
  - Login por link mágico na área do aluno ("receber link de acesso por e-mail"), quando o e-mail estiver configurado.
  - Sem e-mail configurado, manter o fluxo atual de senha.
- **Esforço:** M · **Prioridade:** alta
- **Onde mexer:** `src/routes/public.tsx` (`CheckoutPage` e `POST /c/:slug/comprar`), `src/routes/student.tsx` (login), `src/lib/orders.ts` (`markPaid`, texto do e-mail que hoje diz "a senha que você criou na compra").

### A14. Medir e controlar o custo de CPU do hash de senha

- **O que é:** as senhas usam PBKDF2 com 100 mil iterações. O plano grátis do Workers tem limite de **10 ms de CPU por requisição**. Cada login, cadastro no checkout e redefinição faz esse cálculo, e o checkout de quem já tem cadastro pode fazer o cálculo mais de uma vez.
- **Por que importa:** se passar do limite, a requisição falha com erro 1102 justamente na hora da compra ou do login. É um risco silencioso: funciona no `wrangler dev` e pode falhar em produção sob carga.
- **Como fazer:** medir em produção, no plano grátis (logs de observabilidade mostram o tempo de CPU). Se estiver perto do limite, documentar e ajustar o número de iterações, guardando o valor no próprio hash (o formato `pbkdf2$ITER$...` já permite migrar aos poucos). O item A13 (checkout sem senha) reduz bastante o uso.
- **Esforço:** P · **Prioridade:** alta
- **Onde mexer:** `src/lib/crypto.ts` (`ITERATIONS`), README (limites).

### A15. Tela de diagnóstico e botões de teste

- **O que é:** não há como o vendedor saber se tudo está funcionando antes da primeira venda. Não existe "enviar e-mail de teste", "testar token do Mercado Pago" nem verificação do webhook. Um token errado só aparece quando o comprador vê "Não conseguimos gerar o pagamento".
- **Por que importa:** o vendedor não técnico perde vendas sem saber por quê. O suporte fica com ele e com quem mantém o projeto.
- **Como fazer:** página "Diagnóstico" (ou bloco em Configurações) com checagens em verde/vermelho:
  - `SETUP_CODE` definido; banco e R2 respondendo; espaço usado no R2.
  - Token do Mercado Pago válido (chamada a `/users/me`), indicando se é de **teste** (`TEST-`) ou produção. Com token de teste, mostrar uma faixa "MODO DE TESTE" no painel e no checkout.
  - Site em `https://` (necessário para o `notification_url`); último webhook recebido e quando.
  - Botão "Enviar e-mail de teste para mim", mostrando o erro do Resend quando falhar.
  - Pix direto: QR Code de exemplo de R$ 1,00 para o vendedor pagar a si mesmo e conferir nome e chave.
  - Botão "Gerar pedido de teste" para percorrer o fluxo inteiro.
- **Esforço:** M · **Prioridade:** alta
- **Onde mexer:** `src/routes/admin.tsx`, `src/lib/mercadopago.ts`, `src/lib/email.ts` (retornar o motivo da falha em vez de só `false`), `src/routes/webhooks.ts` (gravar `last_webhook_at` em settings).

---

## Prioridade média

### Vendas e funcionalidades das concorrentes

#### M1. Order bump (oferta extra no checkout)

- **O que é:** caixinha no checkout "Leve também o curso X por mais R$ 27", marcada com um clique. Hotmart, Kiwify e Eduzz têm.
- **Por que importa:** aumenta o valor médio por venda sem custo de aquisição. É dos recursos mais usados pelas concorrentes.
- **Como fazer:** no curso, escolher outro curso como bump e um preço especial. No pedido, permitir mais de um item: criar uma tabela `order_items (order_id, course_id, amount_cents)`, mantendo `orders.amount_cents` como total. `hasAccess()` passa a consultar os itens (sempre com o pedido `paid`). O reembolso devolve o pedido inteiro.
- **Esforço:** G (muda o modelo do pedido) · **Prioridade:** média
- **Onde mexer:** `src/db/schema.ts`, `src/lib/orders.ts` (`hasAccess`, `markPaid`), `src/routes/public.tsx` (checkout), `src/lib/mercadopago.ts` (itens da preferência).

#### M2. Certificado de conclusão

- **O que é:** certificado com nome do aluno, curso, carga horária e data, liberado ao concluir o curso. Está no roadmap do README e as três concorrentes têm.
- **Por que importa:** é motivo de compra em vários nichos (cursos profissionalizantes, horas complementares) e incentiva a conclusão.
- **Como fazer:** depende de A6. Página `/aluno/certificado/:courseId` em HTML com CSS de impressão (A4 paisagem), para o aluno "Salvar como PDF" pelo navegador, sem gerar PDF no servidor. Código de verificação público `/certificado/:codigo` para empresas validarem. No curso: ligar/desligar certificado, carga horária e percentual mínimo.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/routes/student.tsx`, `src/routes/public.tsx` (verificação), `src/db/schema.ts` (tabela `certificates`), `src/views/styles.ts` (`@media print`).

#### M3. Upsell e downsell depois da compra

- **O que é:** após o pagamento, oferecer outro produto ("aproveite: o curso avançado por R$ 47"). Nas concorrentes, o upsell de cartão é de um clique, reaproveitando o cartão.
- **Por que importa:** é a segunda maior alavanca de ticket médio depois do order bump.
- **Como fazer:** versão simples: na tela de "Pagamento confirmado", mostrar uma oferta configurável com botão que já leva ao checkout do outro curso com preço especial (ligado a um cupom ou oferta). Um clique no cartão de verdade exigiria guardar o cartão (Customers and Cards do Mercado Pago), o que é bem mais complexo. No Pix, basta gerar um Pix novo.
- **Esforço:** M (simples) / G (um clique) · **Prioridade:** média
- **Onde mexer:** `src/routes/public.tsx` (`/pedido/:id`, status `paid`), campos novos em `courses`.

#### M4. Comentários e dúvidas nas aulas

- **O que é:** espaço abaixo da aula para o aluno perguntar e o vendedor responder. Está no roadmap.
- **Por que importa:** reduz suporte por WhatsApp, gera prova social e mantém o aluno engajado.
- **Como fazer:** tabela `lesson_comments (id, lesson_id, student_id, admin_id, parent_id, body, created_at, hidden)`. Texto puro, sem HTML (reaproveitar `escapeHtml`/`markdown`). Moderação no painel ("Dúvidas" com filtro "sem resposta"), e-mail ao vendedor em nova dúvida e ao aluno quando houver resposta. Ligar/desligar por curso. Limite de envio por aluno para evitar spam.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/routes/student.tsx` (player), `src/routes/admin.tsx`, `src/db/schema.ts`.

#### M5. Afiliados

- **O que é:** outras pessoas divulgam com link próprio e ganham comissão. É o recurso que tornou a Hotmart grande. Está no roadmap.
- **Por que importa:** muitos produtores vendem principalmente por afiliados. Sem isso, parte do público não consegue migrar.
- **Como fazer:** o desafio é o pagamento. Com Pix direto não existe divisão automática do dinheiro. Caminho viável em etapas:
  1. Links `?ref=codigo`, cookie de atribuição (30 dias, último clique) e registro do afiliado no pedido.
  2. Cadastro de afiliados no painel, percentual por curso, painel do afiliado com cliques, vendas e comissão a receber.
  3. Relatório "comissões a pagar" para o vendedor pagar por Pix e marcar como pago, respeitando o prazo de garantia antes de liberar a comissão.
  4. Opcional e complexo: split automático pelo Mercado Pago (modelo marketplace, com OAuth das contas dos afiliados).
- **Esforço:** G · **Prioridade:** média
- **Onde mexer:** módulo novo (`src/routes/affiliate.tsx`, `src/lib/affiliates.ts`), `src/routes/public.tsx` (atribuição), `src/db/schema.ts`.

#### M6. Assinatura e recorrência

- **O que é:** cobrança mensal ou anual (clube de assinatura, mentoria). Está no roadmap.
- **Por que importa:** receita recorrente é o modelo de muitos produtores. Hotmart, Kiwify e Eduzz têm.
- **Como fazer:** no cartão, usar as assinaturas do Mercado Pago (`/preapproval`), com webhook de cada cobrança. No Pix, o Pix Automático (lançado pelo Banco Central em 2025) depende do provedor oferecer a API, ou de mandar um Pix novo por e-mail a cada ciclo. A regra de acesso precisaria aceitar "assinatura ativa": criar um pedido `paid` por ciclo mantém `hasAccess()` simples, desde que se adicione validade (ver M9).
- **Esforço:** G · **Prioridade:** média
- **Onde mexer:** `src/lib/mercadopago.ts`, `src/lib/orders.ts`, `src/routes/webhooks.ts` (tópicos `subscription_preapproval` e `subscription_authorized_payment`), `src/db/schema.ts`.

#### M7. Página de vendas mais completa

- **O que é:** a página de vendas tem título, capa, "o que você vai aprender", descrição e grade. Faltam blocos que as concorrentes e os construtores de página oferecem: vídeo de apresentação, depoimentos, perguntas frequentes, sobre o professor, bônus, preço "de/por", garantia em destaque e botão de compra fixo no celular.
- **Por que importa:** é a página que converte. Hoje o vendedor precisa colocar tudo na descrição em markdown, sem estrutura visual.
- **Como fazer:** campos novos no curso: vídeo de apresentação (R2 público ou incorporado), "sobre o professor" (foto, texto), FAQ (pergunta e resposta), depoimentos (nome, texto, foto opcional), preço "de" riscado. Barra de compra fixa no rodapé em telas pequenas. O markdown ganha suporte a imagens (`![](...)`), só de URLs do próprio R2, e a mais níveis de lista.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/routes/public.tsx` (`/c/:slug`), `src/routes/admin.tsx` (`CourseForm`), `src/lib/markdown.ts`, `src/views/styles.ts`, `src/db/schema.ts`.

#### M8. Aulas de amostra grátis

- **O que é:** marcar uma ou mais aulas como "prévia" para qualquer visitante assistir pela página de vendas.
- **Por que importa:** deixa o comprador provar o conteúdo, o que aumenta a conversão e reduz reembolsos.
- **Como fazer:** coluna `is_preview` em `lessons`. Na página de vendas, ícone "assistir grátis" na grade. Em `/media/v/` liberar o vídeo de aula com prévia sem login. **Atenção:** a regra de acesso continua em `hasAccess()`, então a exceção deve ficar explícita e testada, só para a aula marcada.
- **Esforço:** P · **Prioridade:** média
- **Onde mexer:** `src/db/schema.ts`, `src/routes/media.ts`, `src/routes/public.tsx`, `src/routes/admin.tsx` (`LessonForm`).

#### M9. Liberação programada (drip) e acesso com validade

- **O que é:** liberar módulos aos poucos ("módulo 2 abre 7 dias após a compra") e acesso por tempo limitado ("12 meses").
- **Por que importa:** comum em cursos com turma, desafios e mentorias. Todas as concorrentes têm.
- **Como fazer:** `release_after_days` em `modules`; `access_days` em `courses` (vazio significa vitalício). A validade entra em `hasAccess()` (comparando `paid_at`), que continua sendo o único lugar com a regra. Mostrar "libera em 3 dias" no player e na área do aluno.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/lib/orders.ts` (`hasAccess`), `src/routes/student.tsx`, `src/db/schema.ts`, formulários do painel.

#### M10. Materiais para download

- **O que é:** anexar PDF, planilhas e arquivos às aulas, protegidos como os vídeos. Hoje só dá para colocar links externos no texto da aula. Também está no roadmap ("produtos digitais").
- **Por que importa:** apostilas e materiais são parte essencial de quase todo curso. Links externos (Google Drive) vazam com facilidade.
- **Como fazer:** tabela `lesson_files`, upload para `private/files/` no R2 e rota `/media/f/:id` com a mesma checagem de acesso de `/media/v/`, com `content-disposition: attachment`. Isso também abre caminho para vender e-book sem aulas.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/routes/media.ts`, `src/routes/admin.tsx` (upload, `uploadKey`), `src/routes/student.tsx`, `src/db/schema.ts`.

#### M11. Cursos gratuitos e captura de leads

- **O que é:** o preço mínimo é R$ 1,00 (`readCourseForm`). Não dá para oferecer um minicurso grátis em troca do e-mail.
- **Por que importa:** "isca digital" é a estratégia mais comum para formar lista e vender o curso pago depois.
- **Como fazer:** aceitar preço 0. Nesse caso, o checkout pula a forma de pagamento e cria um pedido `paid` com método `free`. Registrar consentimento de marketing (caixa **desmarcada** por padrão). Exportar a lista de leads em CSV (A3).
- **Esforço:** P · **Prioridade:** média
- **Onde mexer:** `src/routes/admin.tsx` (`readCourseForm`), `src/routes/public.tsx` (checkout), `src/env.ts`.

#### M12. Mostrar o valor das parcelas e aceitar mais meios

- **O que é:** a página diz "em até 12x", mas não mostra quanto fica cada parcela nem se há juros. Boleto e carteiras estão excluídos no Checkout Pro (`excluded_payment_types: ticket, atm`), sem opção no painel.
- **Por que importa:** "12x de R$ 9,70" vende mais que "até 12x". Parte do público (sem cartão, sem banco digital) só compra por boleto.
- **Como fazer:** opção no painel para quem paga os juros e exibição de "12x de R$ X" (consultando `/v1/payment_methods/installments` do Mercado Pago ou mostrando "a partir de"). Caixa "aceitar boleto" que tira `ticket` da lista de exclusão, lembrando que o boleto demora até 3 dias úteis.
- **Esforço:** P · **Prioridade:** média
- **Onde mexer:** `src/lib/mercadopago.ts` (`createCardCheckout`), `src/routes/public.tsx`, `src/routes/admin.tsx` (configurações).

#### M13. Nota fiscal

- **O que é:** nenhuma integração para emitir nota fiscal de serviço. Kiwify e Eduzz integram com emissores (eNotas, NFE.io e outros).
- **Por que importa:** o vendedor PJ ou MEI precisa emitir nota de cada venda. Fazer à mão a partir do painel é lento. Para isso, o checkout também precisaria pedir CPF.
- **Como fazer:** primeiro passo (P): exportação CSV pronta para importar no emissor (A3) e campo opcional de CPF no checkout. Segundo passo (G): integração opcional com um emissor por API, disparada no `markPaid`, com chave de API guardada como segredo.
- **Esforço:** P / G · **Prioridade:** média
- **Onde mexer:** `src/routes/public.tsx`, `src/lib/orders.ts`, `src/routes/admin.tsx`.

### Experiência do comprador e do aluno

#### M14. E-mails que faltam no ciclo do pedido

- **O que é:** hoje saem só três e-mails ao aluno (acesso liberado, reembolso no Mercado Pago, redefinir senha). Faltam: "seu pedido foi criado, aqui está o Pix" (para quem fecha a aba), "reembolso concluído" no Pix direto (quando o vendedor marca como reembolsado), "seu Pix venceu", "pedido cancelado" e boas-vindas para quem foi adicionado à mão (A9). O vendedor não recebe aviso de **contestação (chargeback)** nem de reembolso automático.
- **Por que importa:** cada falta vira mensagem de suporte. O aluno de Pix direto que pediu reembolso fica sem confirmação nenhuma. O vendedor só descobre a contestação olhando o painel.
- **Como fazer:** centralizar os textos em `src/lib/emails.ts` (um modelo por evento), com versão em texto puro além do HTML (melhora a entrega). Disparar nos pontos certos em `src/lib/orders.ts` (`applyMpPayment` para `charged_back` e `refunded`; reembolso do admin). Permitir editar os textos principais no painel.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/lib/email.ts`, `src/lib/orders.ts`, `src/routes/admin.tsx` (`/pedidos/:id/reembolsar`).

#### M15. Ajustes de texto e fluxo no pedido e na área do aluno

- **O que é:** pequenos atritos encontrados no código:
  - Com só Pix direto ligado, o checkout não explica que a liberação depende do vendedor e pode demorar horas. O texto "Liberação imediata após o pagamento" na página de vendas é falso nesse caso.
  - Sem e-mail configurado, "Já paguei" diz "Você recebe um e-mail", e o vendedor não recebe aviso nenhum.
  - Pedido cancelado ou expirado mostra só "Voltar ao curso", sem "Gerar novo pagamento".
  - Em "Outros pedidos", os reembolsados e contestados não têm data nem explicação.
  - O botão de reembolso não mostra até quando vale a garantia ("até 18/11").
  - Ao pedir reembolso, não se pergunta o motivo (informação valiosa para o vendedor, sempre opcional).
  - A página de vendas e o checkout não dizem quem está vendendo (nome/CNPJ), o que gera desconfiança. O Código de Defesa do Consumidor e o decreto do comércio eletrônico (Decreto 7.962/2013) pedem identificação do fornecedor.
- **Por que importa:** são pontos de dúvida que viram pedido de suporte ou compra desistida.
- **Esforço:** P · **Prioridade:** média
- **Onde mexer:** `src/routes/public.tsx` (página de vendas, checkout, `/pedido/:id`), `src/routes/student.tsx` (`/`, reembolso), `src/routes/admin.tsx` (configurações: nome do vendedor e CPF/CNPJ).

#### M16. Avisos ao vendedor fora do e-mail

- **O que é:** o vendedor só fica sabendo de Pix a confirmar e de pedidos de reembolso por e-mail (que é opcional) ou abrindo o painel.
- **Por que importa:** no Pix direto, o aluno fica esperando enquanto o vendedor não vê o aviso. Isso gera reclamação e reembolso.
- **Como fazer:** opção de webhook de saída configurável (o vendedor cola uma URL, por exemplo do próprio bot do Telegram, do ntfy ou de uma automação dele) disparado em venda, Pix a confirmar, reembolso e contestação. O painel pode virar PWA com contador de pendências. Sem chamar nenhum servidor do projeto.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/lib/orders.ts`, `src/routes/public.tsx` (`/paguei`), `src/routes/admin.tsx` (configurações).

### Experiência do vendedor

#### M17. Painel: busca, paginação, relatórios e detalhes do pedido

- **O que é:** Pedidos mostra no máximo 200 e Alunos no máximo 500, sem paginação. Não há página de detalhe do pedido (histórico, ID do Mercado Pago, observação). A coluna `note` existe em `orders` e nunca é usada. Não há filtro por curso ou período, nem relatório por curso, por forma de pagamento, taxa de reembolso ou conversão (pedidos gerados x pagos). O gráfico só mostra valores ao passar o mouse.
- **Por que importa:** com algumas centenas de vendas, o painel deixa de mostrar tudo e o vendedor perde o controle.
- **Como fazer:** paginação por cursor (`created_at`), filtros por curso e período, página `/admin/pedidos/:id` com linha do tempo e campo de observação. Página de aluno com todos os pedidos e progresso. Relatórios simples em tabelas.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/routes/admin.tsx` (`/pedidos`, `/alunos`, `/`).

#### M18. Editor de curso mais fácil

- **O que é:** a ordem de módulos e aulas é um campo numérico. Não dá para arrastar, mover aula entre módulos, duplicar curso ou aula, nem ver a aula como aluno (o admin acessa `/media/v/`, mas não o player do aluno). Ao enviar vídeo, nada impede de salvar a aula antes do fim do envio, se o JS falhar. Uma falha num pedaço do vídeo cancela tudo, sem tentar de novo.
- **Por que importa:** montar um curso de 80 aulas assim é cansativo e gera erros de ordem.
- **Como fazer:** botões "subir" e "descer" (funciona sem JS) e arrastar e soltar como melhoria. "Mover para o módulo…", "Duplicar curso", "Ver como aluno" (modo prévia para o admin no player). No upload: tentar de novo cada pedaço até 3 vezes, permitir retomar e avisar ao sair da página durante o envio.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/routes/admin.tsx` (`CourseEditPage`, `/modulos/:id`, `LessonForm`), `src/routes/student.tsx` (permitir admin), `src/views/client.ts` (upload).

#### M19. Arquivos esquecidos no R2

- **O que é:** ao excluir um **módulo** ou um **curso**, as aulas somem do banco, mas os vídeos continuam no R2. Trocar capa ou logo não apaga a imagem antiga. Envios em partes interrompidos deixam uploads incompletos.
- **Por que importa:** o espaço grátis é de 10 GB. Vídeos órfãos ocupam espaço invisível e podem gerar cobrança ou bloquear novos envios.
- **Como fazer:** apagar os vídeos ao excluir módulo ou curso (como já é feito na aula). Tarefa no cron (A4) que lista `private/videos/` e `public/img/` e remove o que não está referenciado no banco. Regra de ciclo de vida no R2 para abortar uploads em partes incompletos após 1 dia. Mostrar no painel o espaço usado.
- **Esforço:** P · **Prioridade:** média
- **Onde mexer:** `src/routes/admin.tsx` (`/modulos/:id/excluir`, `/cursos/:id/excluir`, `/upload/*`), handler `scheduled`.

#### M20. Mais de um administrador

- **O que é:** só existe um admin, e o setup trava depois do primeiro. Não há conta para sócio, editor de conteúdo ou suporte.
- **Por que importa:** quem tem equipe acaba compartilhando a senha, sem saber quem fez o quê.
- **Como fazer:** convite por e-mail, papéis simples (dono, conteúdo, suporte). Suporte vê pedidos e alunos, mas não Configurações. Depende do registro de atividades (M22) para fazer sentido.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/routes/admin.tsx`, `src/env.ts` (`Admin` com `role`), `src/db/schema.ts`.

### Segurança, privacidade e LGPD

#### M21. Política de privacidade e consentimento

- **O que é:** os termos padrão têm um parágrafo sobre dados. Não há política de privacidade separada (quem é o controlador, quais dados, finalidade, base legal, por quanto tempo, com quem são compartilhados, como exercer direitos). Não existe caixa de consentimento para e-mails de marketing nem banner de cookies (necessário se os pixels de A11 forem ligados).
- **Por que importa:** a LGPD exige transparência. Os compartilhamentos reais (Mercado Pago, Resend, Cloudflare, Bunny, Google Fonts) precisam aparecer.
- **Como fazer:** página `/privacidade` com modelo padrão gerado a partir das configurações (lista os serviços realmente ligados), editável como os termos. Link no rodapé e no checkout. Campo de "encarregado (DPO)" ou contato de privacidade. Caixa opcional e desmarcada de marketing, gravada no aluno com data.
- **Esforço:** P · **Prioridade:** média
- **Onde mexer:** `src/routes/public.tsx`, `src/views/layout.tsx`, `src/lib/settings.ts`.

#### M22. Registro de atividades (auditoria)

- **O que é:** não há registro de quem confirmou um Pix, fez um reembolso, cancelou pedido, mudou preço ou trocou a chave Pix. Os logs do Workers ficam pouco tempo e só mostram erros.
- **Por que importa:** em disputa com aluno ("eu paguei e vocês cancelaram") ou suspeita de invasão, é a única forma de saber o que aconteceu.
- **Como fazer:** tabela `audit_log (at, actor_kind, actor_id, action, target, details, ip)`, gravada nas ações do painel, nos webhooks e nas mudanças de status de pedido. Página "Atividades" no painel. Guardar por um prazo definido (por exemplo 1 ano) e informar isso na política de privacidade.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/lib/orders.ts` (`setStatus`, `markPaid`), `src/routes/admin.tsx`, `src/routes/webhooks.ts`.

#### M23. Segredos fora do banco ou criptografados

- **O que é:** o token do Mercado Pago, a chave do Resend e a do Bunny ficam em texto puro na tabela `settings` do D1.
- **Por que importa:** qualquer um com acesso ao console do D1 ou a um backup (A3) vê o token, que dá acesso ao dinheiro da conta Mercado Pago (reembolsos, consultas).
- **Como fazer:** criptografar esses valores com AES-GCM usando uma chave do ambiente (um segredo do Worker criado no deploy, ou derivado do `SETUP_CODE`), sem mudar a experiência do painel. Remover os segredos dos backups por padrão.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/lib/settings.ts` (`loadSettings`, `saveSettings`, `SECRET_KEYS`), `src/env.ts`, `wrangler.jsonc`.

#### M24. Google Fonts carregado de fora

- **O que é:** todas as páginas carregam fontes de `fonts.googleapis.com`, o que envia o IP de cada visitante ao Google.
- **Por que importa:** é transferência de dado pessoal a terceiro sem necessidade (já houve decisões na Europa contra isso), contradiz a ideia de "sem telemetria" e é mais uma dependência externa e mais lentidão.
- **Como fazer:** embutir as fontes dos 5 temas (woff2) e servir por `/assets/`, como já é feito com CSS e JS, ou oferecer opção "fontes do sistema". Remover os domínios do Google da CSP.
- **Esforço:** P · **Prioridade:** média
- **Onde mexer:** `src/views/layout.tsx` (`Head`), `src/views/styles.ts` (`THEME_FONTS`), `src/index.tsx` (CSP e rotas de assets).

#### M25. Limites contra abuso nos formulários públicos

- **O que é:** o limite de tentativas cobre login e redefinição de senha por IP+e-mail. Não cobre a **criação de pedidos** (cada um chama a API do Mercado Pago), o cadastro de alunos, nem o envio de "esqueci a senha" para e-mails diferentes, que gasta a cota grátis do Resend (3.000 por mês). O contador também soma logins bem-sucedidos, então quem entra 8 vezes em 15 minutos fica bloqueado. Cada tentativa grava uma linha no D1 (limite grátis de 100 mil escritas por dia).
- **Por que importa:** um robô pode encher a tabela de alunos e pedidos falsos, esgotar a cota de e-mail e a cota de escrita do banco.
- **Como fazer:** limite por IP para criar pedidos e enviar e-mails. Considerar o binding de Rate Limiting do Workers (sem custo de escrita no D1). Zerar o contador após login correto. Opcionalmente, Cloudflare Turnstile (grátis) no checkout e no "esqueci a senha", ligado no painel.
- **Esforço:** P · **Prioridade:** média
- **Onde mexer:** `src/lib/auth.ts` (`tooManyAttempts`), `src/routes/public.tsx`, `src/routes/student.tsx`, `wrangler.jsonc`.

### Operação

#### M26. Observabilidade e alertas

- **O que é:** `observability` está ligado no `wrangler.jsonc`, e os erros vão para `console.error`. Não há alerta quando algo falha (webhook dando 500, e-mail recusado, Mercado Pago fora). Alguns logs incluem o corpo de resposta de terceiros, que pode conter e-mail e nome do comprador.
- **Por que importa:** o vendedor só descobre que os e-mails pararam ou que o cartão não libera quando o aluno reclama.
- **Como fazer:** logs estruturados (JSON com `event`, `orderId`, sem dados pessoais). Contador de falhas recentes guardado no banco e exibido no topo do painel ("3 e-mails falharam hoje"), com e-mail ao vendedor quando um limite for passado. Página de diagnóstico (A15) com o último erro de cada integração. Documentar como abrir os logs na Cloudflare.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/lib/email.ts`, `src/lib/mercadopago.ts`, `src/routes/webhooks.ts`, `src/index.tsx` (`onError`).

#### M27. Limites do plano grátis: documentar com precisão e mostrar o uso

- **O que é:** o README dizia "Banco de dados (D1): 5 GB" (já corrigido para 500 MB por banco). Segundo a documentação da Cloudflare, no plano grátis cada banco D1 tem no máximo **500 MB** (5 GB é o total da conta), com 5 milhões de linhas lidas e 100 mil linhas escritas por dia, 50 consultas por invocação e 10 ms de CPU por requisição. Cada página faz várias consultas (configurações, duas sessões, migração), e a vitrine conta linhas lidas.
- **Por que importa:** o vendedor precisa saber quando vai precisar do plano pago antes que a loja pare. 500 MB é bastante para pedidos, mas o log de auditoria (M22), os comentários (M4) e o progresso (A6) fazem crescer.
- **Como fazer:** corrigir o README e o `docs/COLOCAR-NO-AR.md`. Mostrar no painel o tamanho aproximado do banco e o espaço do R2. Guardar as configurações em memória do isolate por alguns segundos para economizar leituras. Listar os limites reais (requisições, CPU, linhas, consultas) e o que acontece ao ultrapassar.
- **Esforço:** P · **Prioridade:** média
- **Onde mexer:** `README.md`, `docs/COLOCAR-NO-AR.md`, `src/index.tsx` (cache de `loadSettings`), `src/routes/admin.tsx`.

#### M28. Atualizar a loja sem medo

- **O que é:** a orientação é "GitHub → Sync fork". Não há número de versão visível, notas de versão nem aviso de que o banco vai migrar.
- **Por que importa:** o vendedor não sabe se está desatualizado (e sem correções de segurança) nem o que muda. As migrações rodam sozinhas na primeira requisição, sem backup antes.
- **Como fazer:** mostrar a versão no rodapé do painel. Manter um `CHANGELOG.md` com seção "o que muda para o vendedor". Antes de aplicar uma migração nova, gravar um backup automático (A3). Guia ilustrado de atualização em `docs/`. Uma checagem opcional de nova versão pode consultar a API pública do GitHub, **desligada por padrão** para respeitar a regra de não chamar servidores do projeto.
- **Esforço:** P · **Prioridade:** média
- **Onde mexer:** `src/db/schema.ts` (`ensureSchema`), `src/views/layout.tsx`, `docs/`.

### Qualidade de código

#### M29. Dividir arquivos grandes e organizar regras

- **O que é:** `src/routes/admin.tsx` tem cerca de 1.300 linhas com painel, pedidos, alunos, cursos, aulas, upload e configurações juntos. Consultas SQL repetidas estão espalhadas nas rotas. `setStatus` monta SQL concatenando texto (`extra`), hoje só com valores internos, mas é um padrão perigoso para quem contribuir depois. `src/lib/format.ts` usa caracteres combinantes invisíveis na regex de acentos, difícil de ler.
- **Por que importa:** dificulta contribuições e revisão de segurança.
- **Como fazer:** separar `admin/` em arquivos por tela (`dashboard.tsx`, `orders.tsx`, `courses.tsx`, `lessons.tsx`, `settings.tsx`, `upload.ts`). Mover consultas para `src/db/queries.ts`. Trocar `setStatus(..., extra)` por parâmetros com `bind`. Usar `\p{Diacritic}` com flag `u` na regex. Adicionar lint e formatação no CI.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/routes/admin.tsx`, `src/lib/orders.ts`, `src/lib/format.ts`, `src/lib/pix.ts`.

### Acessibilidade

#### M30. Acessibilidade das telas principais

- **O que é:** pontos encontrados no código:
  - Não há link "pular para o conteúdo".
  - Só campos de formulário têm estilo de foco. Links e botões dependem do padrão do navegador, que alguns temas podem esconder.
  - Mensagens de erro e sucesso (`Flash`) não têm `role="alert"`/`role="status"` e não estão ligadas ao campo com `aria-describedby`.
  - "Forma de pagamento" usa `<label>` solto em vez de `<fieldset>` com `<legend>`.
  - A barra de progresso do player não tem `role="progressbar"` nem valores ARIA.
  - O gráfico do painel só mostra valores ao passar o mouse (sem teclado nem leitor de tela). Falta um resumo em texto ou tabela.
  - Os ícones do menu do painel (◎ ₿ ▶ ☺ ⚙) e os emojis decorativos não estão com `aria-hidden`.
  - Os vídeos não aceitam legenda (`<track>`).
  - Não há `prefers-reduced-motion` para animações como o `pulse`.
  - O contraste dos 5 temas (e da cor própria escolhida pelo vendedor) não é verificado.
  - A confirmação de ações usa `confirm()`, que é acessível, mas o texto às vezes não deixa claro o que é irreversível.
- **Por que importa:** a Lei Brasileira de Inclusão (Lei 13.146/2015, art. 63) exige sites acessíveis, e alunos com deficiência são parte do público de cursos. Boa parte dos ajustes é pequena.
- **Como fazer:** corrigir os pontos acima. Permitir enviar legenda `.vtt` por aula (R2 privado, mesma checagem de acesso). Avisar no painel quando a cor própria tiver contraste baixo com o texto branco do botão. Rodar axe ou Lighthouse no CI sobre o site da demo, que já é gerado.
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `src/views/layout.tsx`, `src/views/styles.ts`, `src/routes/public.tsx`, `src/routes/student.tsx`, `src/routes/admin.tsx`, `src/views/client.ts`, `.github/workflows/`.

### Instalação para quem não programa

#### M31. Simplificar a instalação e o Mercado Pago

- **O que é:** o caminho exige conta na Cloudflare e no GitHub, entender "fork", inventar um `SETUP_CODE`, e no Mercado Pago criar aplicação, copiar token, configurar webhook e copiar a assinatura. O código já manda `notification_url` em cada pagamento, então o passo de configurar o webhook no painel do Mercado Pago pode ser dispensável (e só seria preciso para a assinatura secreta).
- **Por que importa:** cada passo técnico é um ponto de desistência para o público-alvo.
- **Como fazer:**
  - Testar se as notificações por `notification_url` chegam sem configurar o webhook no painel do Mercado Pago e, se sim, tornar esse passo opcional na documentação e na tela.
  - Assistente de primeiros passos no painel em etapas (loja, recebimento, primeiro curso, teste), em vez de uma página longa de configurações.
  - Vídeo curto ou GIFs no `docs/COLOCAR-NO-AR.md` em cada passo.
  - Validar a chave Pix na hora (formato de CPF, CNPJ, e-mail, telefone ou aleatória). Avisar quando 11 dígitos podem ser celular sem o `+55` (hoje o código assume CPF).
  - Explicar o que fazer depois de colocar um domínio próprio (atualizar o webhook) automaticamente na tela de diagnóstico (A15).
- **Esforço:** M · **Prioridade:** média
- **Onde mexer:** `docs/COLOCAR-NO-AR.md`, `src/routes/admin.tsx` (configurações e primeiros passos), `src/lib/pix.ts` (`normalizePixKey`).

---

## Prioridade baixa

#### B1. Marca d'água com o e-mail do aluno no vídeo

- **O que é:** sobrepor o e-mail ou CPF do aluno no player (no roadmap).
- **Por que importa:** inibe gravação e compartilhamento, embora não impeça.
- **Como fazer:** camada HTML com o e-mail sobre o `<video>`, mudando de posição de tempos em tempos (não protege contra quem sabe mexer, mas inibe). Marca d'água gravada no vídeo exigiria processamento, inviável no plano grátis.
- **Esforço:** P · **Prioridade:** baixa
- **Onde mexer:** `src/routes/student.tsx`, `src/views/client.ts`, `src/views/styles.ts`.

#### B2. Limite de aparelhos ou sessões simultâneas por aluno

- **O que é:** limitar quantas sessões ativas um aluno pode ter.
- **Por que importa:** reduz compartilhamento de conta.
- **Como fazer:** ao criar sessão de aluno, apagar as mais antigas acima de N (configurável).
- **Esforço:** P · **Prioridade:** baixa
- **Onde mexer:** `src/lib/auth.ts` (`createSession`).

#### B3. Quizzes e exercícios

- **O que é:** perguntas de múltipla escolha ao fim do módulo, com nota mínima para o certificado.
- **Por que importa:** útil em cursos profissionalizantes, mas não decide a compra para a maioria.
- **Esforço:** M · **Prioridade:** baixa
- **Onde mexer:** módulo novo, `src/routes/student.tsx`, `src/db/schema.ts`.

#### B4. Comunidade ou mural do curso

- **O que é:** espaço de discussão entre alunos (como a comunidade da Hotmart ou da Kiwify).
- **Por que importa:** retém alunos em cursos longos. Os comentários nas aulas (M4) cobrem boa parte.
- **Esforço:** G · **Prioridade:** baixa

#### B5. Coprodução

- **O que é:** dividir a receita de um curso com um sócio, com relatório para cada parte.
- **Por que importa:** comum em lançamentos. Sem split automático, vira um relatório de divisão.
- **Como fazer:** reaproveitar a estrutura de comissões dos afiliados (M5).
- **Esforço:** M · **Prioridade:** baixa

#### B6. Outros gateways e bancos

- **O que é:** Inter, Efí, Asaas, Stripe, PagBank (no roadmap). Alguns bancos (como Inter e Efí) têm API Pix com aviso automático de recebimento, o que acabaria com a confirmação manual do Pix direto.
- **Por que importa:** reduz dependência do Mercado Pago e pode baratear o Pix automático.
- **Como fazer:** criar uma interface comum de provedor (`createPix`, `createCard`, `getPayment`, `refund`, `verifyWebhook`) a partir de `src/lib/mercadopago.ts` e adaptar `src/lib/orders.ts` para depender da interface.
- **Esforço:** G · **Prioridade:** baixa (média para os bancos com API Pix)

#### B7. SEO básico

- **O que é:** falta `sitemap.xml`, `robots.txt` e dados estruturados (`schema.org/Course`) na página de vendas.
- **Por que importa:** ajuda a aparecer no Google, embora a maior parte das vendas venha de redes sociais e anúncios.
- **Esforço:** P · **Prioridade:** baixa
- **Onde mexer:** `src/routes/public.tsx`, `src/views/layout.tsx`.

#### B8. Imagens SVG no upload público

- **O que é:** o upload de imagem aceita `image/svg+xml`, servido em `/media/p/` no mesmo domínio. Hoje a CSP aplicada a todas as respostas bloqueia scripts dentro do SVG, e só o admin pode enviar, então o risco é baixo.
- **Por que importa:** é defesa em profundidade: se a CSP mudar um dia (por exemplo, para os pixels de A11), um SVG malicioso vira XSS.
- **Como fazer:** recusar SVG, ou servir SVG com `content-security-policy: script-src 'none'` e `content-disposition: attachment`. Limitar também o tamanho das imagens.
- **Esforço:** P · **Prioridade:** baixa
- **Onde mexer:** `src/routes/admin.tsx` (`uploadKey`), `src/routes/media.ts`.

#### B9. Revelação de cadastro no checkout

- **O que é:** o checkout responde "Este e-mail já tem cadastro e a senha não confere", o que permite descobrir se uma pessoa é aluna da loja. O "esqueci a senha" tem o cuidado de não revelar isso.
- **Por que importa:** num nicho sensível (saúde, finanças, sexualidade), saber que alguém comprou já é um dado pessoal sensível.
- **Como fazer:** resolvido pelo checkout sem senha (A13). Até lá, manter a mensagem mas sem confirmar a existência de forma tão direta.
- **Esforço:** P · **Prioridade:** baixa
- **Onde mexer:** `src/routes/public.tsx` (`POST /c/:slug/comprar`).

#### B10. Painel e área do aluno como app (PWA)

- **O que é:** manifesto e ícone para "instalar" o painel e a área do aluno no celular.
- **Por que importa:** a maior parte dos alunos assiste pelo celular. As concorrentes têm aplicativos próprios.
- **Esforço:** P · **Prioridade:** baixa
- **Onde mexer:** `src/index.tsx` (rota do manifesto), `src/views/layout.tsx`.

#### B11. Vários idiomas e moedas

- **O que é:** textos fixos em português e preço só em reais.
- **Por que importa:** só para quem vende para fora do Brasil. O foco do projeto é o vendedor brasileiro.
- **Esforço:** G · **Prioridade:** baixa

---

## Achados do teste de uso (navegando como cliente)

Um teste exploratório, clicando como um usuário comum (formulários errados, cliques duplos, botão voltar, celular), encontrou os pontos abaixo.

**Já corrigidos:**
- Link normal do YouTube ou do Vimeo deixava o vídeo preto. Agora é convertido para o link do player.
- Chave Pix de celular digitada como "(11) 98765-4321" saía sem o +55. Agora é convertida.
- A caixa dos termos desmarcava ao errar o formulário.
- O título da página de vendas ficava colado na borda.
- Os módulos fechados não tinham uma setinha indicando que dá para abrir.
- Faltava um "Não é você? Sair" no checkout.
- Plural errado: "1 aulas" e "pedido(s)".
- O status "Confirmar Pix" aparecia para o aluno como se fosse uma tarefa dele.
- O e-mail de suporte em "Esqueci minha senha" não era clicável.
- O navegador usava CSS e JS antigos por até 1 hora depois de uma atualização. Agora os arquivos têm versão.

**Ainda abertos:**

| Achado | Onde | Esforço |
|---|---|---|
| Se o Mercado Pago falha ao gerar o pagamento, o vendedor não é avisado. A opção marcada por padrão pode ser justamente a que está falhando | `public.tsx` (checkout), e-mail ao vendedor e um aviso no painel | P |
| A conta do aluno é criada e logada mesmo quando o pagamento falha | `public.tsx`: criar a conta só depois do pedido, ou avisar | P |
| As mensagens `?ok=` e `?erro=` vêm no endereço, então qualquer texto pode ser exibido dentro do painel por um link (golpe) e reaparece ao recarregar | Trocar por mensagem num cookie de uso único | M |
| O limite de tentativas de login conta também os logins que deram certo | `lib/auth.ts` (`tooManyAttempts`) | P |
| Apagar um módulo de um curso já vendido não avisa que há alunos | `admin.tsx` (excluir módulo) | P |
| O botão "Excluir curso" só despublica quando há vendas. O nome confunde | `admin.tsx` | P |
| O campo de ordem dos módulos não tem rótulo e aceita números negativos | `admin.tsx` | P |
| Curso em rascunho não tem prévia, e trocar o endereço quebra o link antigo sem aviso | `admin.tsx`, `public.tsx` | P |
| O reembolso de Pix direto não pede a chave Pix do aluno para a devolução | `student.tsx` e painel | P |
| A busca de pedidos não ignora acentos nem maiúsculas acentuadas, e se perde depois de uma ação | `admin.tsx` (`/pedidos`) | P |
| No celular, o menu do painel ocupa a primeira tela, e os botões da tabela de pedidos ficam escondidos à direita | `styles.ts` | M |
| No celular, o botão de comprar fica no fim da página. Falta um botão fixo | `styles.ts`, `public.tsx` | P |
| Os erros do checkout aparecem um de cada vez | `public.tsx` | P |
| O 404 dentro do painel tem "Voltar ao início" levando para a loja | `index.tsx` (`notFound`) | P |

---

## Pontos fortes a preservar

Ao implementar os itens acima, vale manter o que já está bem resolvido:

- **Regra de acesso única** em `hasAccess()` (`src/lib/orders.ts`). Drip, validade, prévia e pedidos manuais devem passar por ela, e não criar exceções espalhadas.
- **Nunca confiar no webhook:** sempre consultar a API do provedor e conferir valor, moeda e pedido (`applyMpPayment`).
- **Sem script inline e CSP restritiva.** Pixels (A11) devem ampliar a CSP só para os domínios ligados.
- **Sem telemetria e sem chamadas a servidores do projeto.** Checagem de versão (M28) e avisos (M16) apenas por escolha do vendedor.
- **Tudo configurável pelo painel**, sem editar arquivos.
- **Migrações só por acréscimo** no fim de `MIGRATIONS`.

---

## Referências

- Limites do Cloudflare D1: <https://developers.cloudflare.com/d1/platform/limits/>
- Limites do Cloudflare Workers: <https://developers.cloudflare.com/workers/about/limits/>
- Preços do Cloudflare D1: <https://developers.cloudflare.com/d1/platform/pricing/>
- LGPD (Lei 13.709/2018), art. 18: direitos do titular
- Código de Defesa do Consumidor, art. 49 (arrependimento), e Decreto 7.962/2013 (comércio eletrônico)
- Lei Brasileira de Inclusão (Lei 13.146/2015), art. 63 (acessibilidade em sites)
