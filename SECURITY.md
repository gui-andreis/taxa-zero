# Segurança

## Reportando uma vulnerabilidade

Encontrou uma falha de segurança? **Não abra uma issue pública.** Use a aba **Security → Report a vulnerability** deste repositório no GitHub (relato privado). Se ela não aparecer para você, abra uma issue pedindo um contato, **sem detalhes da falha**.

Inclua:
- o que é possível fazer com a falha (ex.: acessar curso sem pagar, ver dados de outro aluno);
- passos para reproduzir;
- a versão/commit afetado.

Respondemos assim que possível e damos o crédito na correção, se você quiser.

## Escopo

Interessam especialmente:
- liberar acesso a curso sem pagamento confirmado;
- ler dados de outros alunos ou pedidos;
- acessar vídeos privados sem compra;
- burlar a verificação de pagamento ou o webhook;
- CSRF, XSS ou injeção de SQL.

Ficam fora do escopo: gravação de tela de vídeos (nenhuma plataforma impede) e problemas na conta Cloudflare/Mercado Pago do próprio vendedor.

## Modelo de segurança (resumo)

- Cada vendedor roda a própria instância. Não existe servidor central nem dados compartilhados entre lojas.
- Dados de cartão nunca passam pela aplicação (Checkout Pro do Mercado Pago).
- Pagamentos são sempre confirmados consultando a API do provedor. Avisos de webhook não são confiáveis por si só.
- Senhas com PBKDF2-SHA256. Sessões armazenadas como hash.
- Proteção CSRF (Origin/Referer), CSP restritiva sem scripts inline, cookies HttpOnly/SameSite.

## Boas práticas para vendedores

- Use um `SETUP_CODE` forte e uma senha de painel longa.
- Nunca compartilhe seu Access Token do Mercado Pago.
- Configure a "assinatura secreta" do webhook no painel.
- Mantenha sua cópia do projeto atualizada. Clique em **Watch → Custom → Releases** neste repositório para ser avisado das correções. Quem criou a loja pelo botão de deploy tem uma cópia independente (não é um fork): hoje a atualização é feita trazendo os arquivos da nova versão para o seu repositório. Uma forma mais simples de atualizar está no roadmap.
