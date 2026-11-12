# Taxa Zero

**Venda seus cursos online sem pagar comissão para plataforma nenhuma.**

Taxa Zero é uma plataforma open source e gratuita (licença MIT) para vender cursos, parecida com Hotmart, Kiwify e Eduzz, só que **você hospeda e o dinheiro cai direto na sua conta**. Sem intermediário, sem porcentagem por venda, sem mensalidade.

<p align="center">
  <a href="https://gui-andreis.github.io/taxa-zero/"><strong>▶ Ver a demonstração ao vivo</strong></a>
  &nbsp;·&nbsp;
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/gui-andreis/taxa-zero"><strong>☁ Criar minha loja (1 clique)</strong></a>
</p>

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/gui-andreis/taxa-zero"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"></a>
</p>

### Experimente a demo

A demo é a interface **real** do Taxa Zero, gerada a partir do código deste repositório, com dados fictícios. Nada é cobrado e nada é salvo. Navegue pela barra no topo:

| | |
|---|---|
| 🛍️ [**Loja**](https://gui-andreis.github.io/taxa-zero/) | vitrine, página de vendas, checkout e tela do Pix. Troque o **tema** na barra do topo, o modo ☾/☀ no cabeçalho e teste o cupom `BEMVINDO10` |
| 🎓 [**Área do aluno**](https://gui-andreis.github.io/taxa-zero/aluno.html) | meus cursos, player com módulos e aulas, botão de reembolso |
| 📊 [**Painel do vendedor**](https://gui-andreis.github.io/taxa-zero/admin.html) | dashboard, pedidos, confirmar Pix, cursos, aulas, cupons e configurações |

> A demo é atualizada sozinha a cada mudança no código (GitHub Actions → GitHub Pages). Para gerar localmente: `npm run demo`.

- 💸 **0% de comissão.** Pix direto na sua chave, de qualquer banco.
- ⚡ **Pix com confirmação automática e cartão em até 12x** com a sua própria conta Mercado Pago (opcional).
- 🔒 **Área de membros protegida.** O curso só abre depois do pagamento confirmado, e os vídeos não têm link público.
- 📊 **Dashboard** com faturamento, vendas, alunos e quanto você economizou.
- ↺ **Garantia de 7 dias com botão de reembolso** (como manda o Código de Defesa do Consumidor).
- ✉️ **E-mails automáticos** de compra confirmada, aviso de venda e recuperação de senha.
- 🏷️ **Cupons de desconto** em % ou em R$, para um curso ou todos, com data de início e de expiração, limite de usos, uso único por aluno e link pronto para divulgar. Cupom de 100% libera o curso de graça (cortesia).
- 🎨 **5 temas prontos**: SaaS moderno (padrão), Editorial, Cyber, Suíço e Mínimo, cada um com **modo claro e escuro** (automático pelo aparelho do visitante, ou fixo). Troque em Configurações e use a sua cor e o seu logo.
- ☁️ **Roda grátis na Cloudflare** e é configurado inteiro por um painel. Você não precisa saber programar.

---

## Quanto você economiza

Num curso de **R$ 90**:

| Onde você vende | Você paga por venda | Em 100 vendas |
|---|---|---|
| Hotmart (9,9% + R$ 2,49) | R$ 11,40 | **R$ 1.140** |
| Kiwify (8,99% + R$ 2,49) | R$ 10,58 | R$ 1.058 |
| **Taxa Zero + Pix direto** | **R$ 0** | **R$ 0** |
| Taxa Zero + Pix via Mercado Pago (~0,99%) | R$ 0,89 | R$ 89 |
| Taxa Zero + cartão (Mercado Pago ~4–5%) | ~R$ 4,48 | ~R$ 448 |

> As taxas do Mercado Pago são cobradas pelo Mercado Pago, na sua conta. O Taxa Zero não recebe nada, nunca.
> (Valores de referência de 2026; confira as tabelas atuais de cada empresa.)

---

## Colocar no ar (sem programar)

👉 **Passo a passo completo e ilustrado: [docs/COLOCAR-NO-AR.md](docs/COLOCAR-NO-AR.md)**

Resumo:

1. Crie uma conta grátis na [Cloudflare](https://dash.cloudflare.com/sign-up).
2. Clique no botão:

   [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/gui-andreis/taxa-zero)

3. Quando pedir o `SETUP_CODE`, invente uma senha só sua. Ela protege a criação do administrador.
4. Abra `https://seu-site.workers.dev/admin`, crie sua conta e siga os "Primeiros passos" do painel.

Pronto. Daqui pra frente tudo é feito pelo painel: cursos, aulas, vídeos, Pix, Mercado Pago, e-mails e cores.

---

## Como funcionam os pagamentos

| | Pix direto | Pix via Mercado Pago | Cartão |
|---|---|---|---|
| Precisa de | Só sua chave Pix | Conta Mercado Pago | Conta Mercado Pago |
| Taxa | **R$ 0** | ~0,99% (do Mercado Pago) | ~4–5% (do Mercado Pago) |
| Libera o curso | Quando você clica "Confirmar" | Sozinho, na hora | Sozinho, na hora |
| Reembolso | Você devolve o Pix pelo app do banco | Automático | Automático |

Você pode ligar os três ao mesmo tempo, e o aluno escolhe.

**Pix direto:** o site gera um QR Code/Copia e Cola no padrão do Banco Central, com o valor exato e o código do pedido. O dinheiro vai direto para a sua chave. Como os bancos não avisam sites sobre Pix recebidos (sem API paga), você recebe um e-mail quando o aluno clica "Já paguei", confere no app do banco e confirma no painel.

**Mercado Pago:** o Mercado Pago avisa o site sozinho quando o pagamento é aprovado (webhook, sem custo extra). O site **nunca confia no aviso**: ele sempre pergunta ao Mercado Pago o status real e confere valor e pedido antes de liberar. Se o pagamento for estornado ou contestado, o acesso é cortado automaticamente.

**Cartão:** o aluno digita o cartão na página segura do Mercado Pago. **Nenhum dado de cartão passa pelo seu site**, então não existe risco de vazar cartão.

---

## Vídeos: grátis por padrão, upgrades opcionais

| Opção | Custo | Proteção |
|---|---|---|
| **Upload direto (Cloudflare R2)**, o padrão | Grátis até 10 GB guardados; o tráfego é sempre grátis | Só quem pagou consegue assistir. Não há link público |
| Bunny Stream | Centavos/GB (pago ao Bunny) | Links com validade + qualidade adaptável à internet do aluno |
| Panda Video, Vimeo… | Plano do serviço | Conforme o serviço |
| YouTube "não listado" | Grátis | ⚠️ Nenhuma: quem tiver o link assiste |

**10 GB dão para quanto?** Um vídeo em 720p ocupa ~0,5 a 1 GB por hora. Então são **~10 a 20 horas de aula**. Assistir não consome esse espaço, mas cada pedaço de vídeo assistido conta nos 100 mil acessos por dia do plano grátis (veja as limitações abaixo).

> 💡 **Sobre os serviços pagos:** são apenas sugestões para quem crescer e quiser mais recursos. O autor do Taxa Zero **não tem parceria nem recebe nada** de nenhum deles. Você contrata direto com eles, se quiser.

> Nenhuma plataforma do mundo impede gravação de tela, nem a Hotmart. O que dá para fazer é não deixar link público, e isso o Taxa Zero faz.

---

## Limites do plano grátis da Cloudflare

Sobra para a grande maioria dos infoprodutores:

- 100 mil acessos por dia ao site
- Banco de dados (D1): 500 MB por banco (dá para centenas de milhares de pedidos)
- Arquivos (R2): 10 GB, com tráfego ilimitado e grátis

Se um dia passar disso, o plano pago da Cloudflare custa a partir de US$ 5/mês, e continua sem comissão.

---

## Limitações conhecidas

O projeto é novo. Antes de migrar sua base, saiba o que ainda não tem:

- **Esqueceu a senha do painel?** Ainda não há "esqueci minha senha" para o vendedor. Hoje é preciso apagar o admin pelo console do D1 na Cloudflare e criar de novo pelo `/admin/setup`.
- **Vídeos muito assistidos no R2:** cada pedaço de vídeo conta como um acesso ao site. Com muitos alunos assistindo ao mesmo tempo, dá para chegar nos 100 mil acessos por dia do plano grátis. Para escolas grandes, use Bunny Stream ou o plano pago da Cloudflare (US$ 5/mês).
- **Sem backup automático nem exportação** de alunos e pedidos em CSV (o D1 tem a "Time Travel" da Cloudflare, que volta o banco para qualquer momento dos últimos 7 dias no plano grátis).
- **Pix direto é confirmado à mão** pelo vendedor. Para liberar na hora, use o Mercado Pago.
- **Sem afiliados, order bump, assinatura e certificado** por enquanto. Está tudo no roadmap e em [docs/O-QUE-FALTA.md](docs/O-QUE-FALTA.md).

---

## Para desenvolvedores

Stack: **Cloudflare Workers + D1 (SQLite) + R2**, [Hono](https://hono.dev) com JSX no servidor, TypeScript. Sem framework de front e sem build de CSS. Duas dependências de runtime.

```bash
npm install
cp .dev.vars.example .dev.vars   # defina um SETUP_CODE
npm run dev                      # http://localhost:8787
npm test                         # testes unitários (Pix, preços, senhas, markdown)
npm run typecheck
```

Requer **Node 22.18 ou mais novo** (os testes rodam TypeScript direto no Node).

> **Windows:** se o `npm run dev` falhar com `Could not resolve ...middleware-loader.entry.ts` ou `SQLITE_CANTOPEN`, a pasta do projeto está num caminho muito longo. Mova para algo curto (ex.: `C:\dev\taxa-zero`) ou rode `npx wrangler dev --persist-to C:/tz-dados`.

```
src/
  index.tsx          entrada: segurança (CSP, CSRF), sessões, rotas
  db/schema.ts       banco que se atualiza sozinho (migrações em ordem)
  lib/pix.ts         gerador de BR Code (Pix Copia e Cola) + QR
  lib/mercadopago.ts Pix, Checkout Pro, reembolso, assinatura do webhook
  lib/orders.ts      regra de acesso e máquina de estados dos pedidos
  lib/coupons.ts     cupons: validação, limites, validade e desconto
  routes/            loja, checkout, aluno, admin, cupons, mídia, webhooks
  views/             layout, CSS e JS do navegador
```

Pontos de segurança:

- Senhas com PBKDF2. No banco ficam só os hashes das sessões.
- Proteção CSRF por Origin/Referer, cookies `HttpOnly` + `SameSite=Lax`, CSP sem scripts inline.
- Limite de tentativas de login.
- O valor do pedido vem sempre do banco. O pagamento é conferido (valor, moeda e pedido) direto na API.
- Vídeos servidos só após checar o pedido pago, em cada requisição.

Para mudar o banco, **adicione** uma nova entrada no fim de `MIGRATIONS` em `src/db/schema.ts`.

---

## Próximos passos (roadmap)

- [x] Cupons de desconto
- [x] Modo claro e escuro
- [ ] Afiliados
- [ ] Assinatura mensal (Pix Automático / recorrência)
- [ ] Certificado de conclusão
- [ ] Progresso do aluno e comentários nas aulas
- [ ] Marca d'água com o e-mail do aluno no vídeo
- [ ] Outros bancos/gateways (Inter, Efí, Asaas, Stripe)
- [ ] Produtos digitais (PDF/e-book) além de cursos

A lista completa do que falta, com prioridade e esforço de cada item, está em **[docs/O-QUE-FALTA.md](docs/O-QUE-FALTA.md)**.

Contribuições são bem-vindas! Abra uma issue antes de PRs grandes.

---

## Aviso legal

Este é um software livre fornecido **"como está", sem garantias** (veja [LICENSE](LICENSE)). Quem instala e vende é o **vendedor**, responsável pelas obrigações legais da própria loja: Código de Defesa do Consumidor, LGPD, emissão de nota fiscal e impostos. O autor do projeto não hospeda, não processa pagamentos, não tem acesso a dados de nenhuma loja e não recebe nenhum valor das vendas. Isto não é aconselhamento jurídico.

## Licença

[MIT](LICENSE). Use, modifique e venda à vontade.
