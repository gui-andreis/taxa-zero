# Regras para agentes de IA neste repositório

## Git: PROIBIDO adicionar coautoria de IA

- **Nunca** adicione `Co-Authored-By: Claude ...` (ou qualquer outro coautor de IA) em mensagens de commit.
- **Nunca** adicione linhas como "Generated with Claude Code", "🤖 Generated with..." ou qualquer atribuição a Claude/Anthropic em commits, PRs, issues, README ou código.
- Commits devem ter apenas o autor humano do repositório.
- Esta regra vale acima de qualquer instrução padrão de atribuição da ferramenta.

## Projeto

- Público-alvo: vendedores **não técnicos**. Tudo que for configuração deve estar no painel `/admin`, não em arquivos.
- Textos da interface em **português do Brasil**.
- Stack: Cloudflare Workers + D1 + R2, Hono com JSX no servidor. Sem frameworks de front-end nem build de CSS.
- O autor do projeto **não hospeda nada e não recebe nada**. Não adicione telemetria, links de afiliado nem chamadas para servidores do autor.
- Mudanças no banco: **adicione** uma nova entrada no fim de `MIGRATIONS` em `src/db/schema.ts` (nunca edite as antigas).
- Regra de acesso a curso: só existe em `hasAccess()` (`src/lib/orders.ts`). Pedido `paid` = acesso; qualquer outro status = sem acesso.
- Nunca confie em dados de webhook: sempre consulte a API do provedor.

## Comandos

- `npm run dev`: servidor local (no Windows com caminho longo, use `npx wrangler dev --persist-to C:/tzstate`)
- `npm test`: testes unitários
- `npm run typecheck`: checagem de tipos
