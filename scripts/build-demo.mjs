/**
 * Gera a DEMO estática (GitHub Pages) a partir do app de verdade:
 *  1. sobe o app localmente (wrangler dev) com um banco vazio
 *  2. cria uma loja de exemplo (cursos, alunos, vendas)
 *  3. salva cada tela como HTML estático em ./site
 *
 * Uso: npm run demo   (variável DEMO_BASE define o caminho do site, padrão "/taxa-zero/")
 */
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const PORT = 8799
const URL0 = `http://127.0.0.1:${PORT}`
const STATE = '.demo-state'
const OUT = 'site'
const BASE = process.env.DEMO_BASE ?? '/taxa-zero/'
const REPO = process.env.DEMO_REPO ?? 'https://github.com/gui-andreis/taxa-zero'
const isWin = process.platform === 'win32'

rmSync(STATE, { recursive: true, force: true })
rmSync(OUT, { recursive: true, force: true })
writeFileSync('.dev.vars', 'SETUP_CODE=demo-setup-code\n')

// ───────── 1. sobe o app ─────────
const dev = spawn(isWin ? 'npx.cmd' : 'npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', STATE], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: isWin,
})
let devLog = ''
dev.stdout.on('data', (d) => (devLog += d))
dev.stderr.on('data', (d) => (devLog += d))
const stop = () => {
  try {
    if (isWin) execFileSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore' })
    else dev.kill('SIGTERM')
  } catch {}
}
process.on('exit', stop)

async function waitReady() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(URL0 + '/assets/app.css')
      if (r.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  console.error(devLog)
  throw new Error('wrangler dev não subiu')
}

// ───────── cliente HTTP com cookies ─────────
function client() {
  const jar = new Map()
  const send = async (path, { method = 'GET', form, json, body, headers = {} } = {}) => {
    const h = { Origin: URL0, ...headers }
    if (jar.size) h.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
    let payload = body
    if (form) {
      payload = new URLSearchParams(form).toString()
      h['Content-Type'] = 'application/x-www-form-urlencoded'
    }
    if (json) {
      payload = JSON.stringify(json)
      h['Content-Type'] = 'application/json'
    }
    const res = await fetch(URL0 + path, { method, headers: h, body: payload, redirect: 'manual' })
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';')
      const [k, v] = kv.split('=')
      if (c.includes('Max-Age=0') || v === '') jar.delete(k)
      else jar.set(k, v)
    }
    return res
  }
  return { send, html: async (p) => (await send(p)).text() }
}

// ───────── 2. cria a loja de exemplo ─────────
const COURSES = [
  {
    title: 'Do Zero ao Primeiro App',
    subtitle: 'Aprenda a programar construindo um app real, mesmo sem nunca ter escrito uma linha de código.',
    price: '197,00',
    bullets: 'Lógica de programação sem decoreba\nJavaScript moderno do básico ao avançado\nComo publicar seu app na internet de graça\nProjeto final para colocar no portfólio',
    description:
      '## Para quem é este curso\n\nPara quem quer **começar na programação** e já sair com um projeto de verdade. Sem enrolação: cada aula termina com algo funcionando.\n\n## Como funciona\n\n- Aulas curtas e práticas\n- Exercícios com correção comentada\n- Acesso vitalício e atualizações\n\nSe em 7 dias você achar que não é para você, devolvemos 100% do valor.',
    modules: [
      ['Começando', ['Boas-vindas e como estudar', 'Instalando as ferramentas', 'Seu primeiro programa']],
      ['Fundamentos', ['Variáveis e tipos', 'Condições e repetições', 'Funções', 'Listas e objetos']],
      ['Projeto final', ['Planejando o app', 'Construindo a interface', 'Publicando na internet']],
    ],
  },
  {
    title: 'Fotografia com Celular',
    subtitle: 'Fotos profissionais com o celular que você já tem.',
    price: '97,00',
    bullets: 'Composição e enquadramento\nLuz natural a seu favor\nEdição rápida no próprio celular',
    description: 'Um curso direto ao ponto para você **parar de tirar fotos sem graça** e começar a criar imagens que chamam atenção.',
    modules: [
      ['Fundamentos', ['Conhecendo sua câmera', 'Regra dos terços na prática']],
      ['Luz e edição', ['Fotografando com luz natural', 'Editando em 5 minutos']],
    ],
  },
  {
    title: 'Finanças Pessoais Sem Mistério',
    subtitle: 'Organize seu dinheiro, saia das dívidas e comece a investir.',
    price: '67,90',
    bullets: 'Planilha de orçamento pronta\nEstratégia para quitar dívidas\nPrimeiros investimentos com segurança',
    description: 'Finanças sem economês. Você vai entender **para onde vai seu dinheiro** e montar um plano simples para o próximo ano.',
    modules: [
      ['Organização', ['Mapeando seus gastos', 'Montando o orçamento']],
      ['Crescendo', ['Reserva de emergência', 'Primeiros investimentos']],
    ],
  },
]

const VIDEO = 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ'
const slugOf = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function seed() {
  const admin = client()
  await admin.send('/admin/setup', { method: 'POST', form: { code: 'demo-setup-code', email: 'vendedor@exemplo.com', password: 'demo-senha-123' } })
  await admin.send('/admin/configuracoes', {
    method: 'POST',
    form: {
      store_name: 'Escola Exemplo',
      store_tagline: 'Cursos práticos, direto ao ponto. Comprou, começou.',
      accent_color: '#6d4aff',
      seller_email: 'vendedor@exemplo.com',
      support_contact: 'contato@exemplo.com',
      footer_text: 'Loja de demonstração do Taxa Zero',
      pix_manual_enabled: '1',
      pix_key: '00000000-0000-0000-0000-000000000000',
      pix_name: 'Escola Exemplo',
      pix_city: 'Sao Paulo',
      mp_access_token: 'TEST-demo-token',
      mp_pix_enabled: '1',
      mp_card_enabled: '1',
      mp_max_installments: '12',
      refund_days: '7',
      email_from: '',
    },
  })
  let lessonId = 0
  for (const [i, c] of COURSES.entries()) {
    await admin.send('/admin/cursos/novo', {
      method: 'POST',
      form: { title: c.title, subtitle: c.subtitle, price: c.price, bullets: c.bullets, description: c.description, published: '1' },
    })
    const courseId = i + 1
    // o curso nasce com "Módulo 1": renomeia e cria os demais
    for (const [mi, [mTitle, lessons]] of c.modules.entries()) {
      if (mi > 0) await admin.send(`/admin/cursos/${courseId}/modulos`, { method: 'POST', form: { title: mTitle } })
      const page = await admin.html(`/admin/cursos/${courseId}`)
      const moduleIds = [...page.matchAll(/action="\/admin\/modulos\/(\d+)"/g)].map((m) => m[1])
      const moduleId = moduleIds[mi]
      await admin.send(`/admin/modulos/${moduleId}`, { method: 'POST', form: { title: mTitle, position: String(mi) } })
      for (const [li, lTitle] of lessons.entries()) {
        lessonId++
        await admin.send('/admin/aulas/nova', {
          method: 'POST',
          form: {
            module_id: moduleId,
            title: lTitle,
            position: String(li),
            duration_text: `${6 + ((lessonId * 7) % 15)} min`,
            description: `Nesta aula: **${lTitle.toLowerCase()}**.\n\n- Material de apoio em PDF\n- Exercício prático no final`,
            video_type: 'embed',
            embed_ref: VIDEO,
          },
        })
      }
    }
  }

  // Aluna de demonstração: comprou o curso 1 (pago) e tem um Pix pendente do curso 2
  const ana = client()
  await ana.send(`/c/${slugOf(COURSES[0].title)}/comprar`, {
    method: 'POST',
    form: { name: 'Ana Souza', email: 'ana@exemplo.com', password: 'demo12345', method: 'pix_manual', terms: '1' },
  })
  await ana.send(`/c/${slugOf(COURSES[1].title)}/comprar`, { method: 'POST', form: { method: 'pix_manual', terms: '1' } })
  const orders = [...(await ana.html('/aluno')).matchAll(/\/pedido\/([a-z0-9]+)/g)].map((m) => m[1])
  const first = await admin.html('/admin/pedidos')
  const anaOrders = [...new Set([...first.matchAll(/<code class="small">([a-z0-9]+)<\/code>/g)].map((m) => m[1]))]
  const pendingPix = orders[0]
  const paidOrder = anaOrders.find((o) => o !== pendingPix)
  await admin.send(`/admin/pedidos/${paidOrder}/confirmar`, { method: 'POST' })
  // um pedido "já paguei" (aguardando confirmação) para mostrar no painel
  const bruno = client()
  await bruno.send(`/c/${slugOf(COURSES[2].title)}/comprar`, {
    method: 'POST',
    form: { name: 'Bruno Lima', email: 'bruno@exemplo.com', password: 'demo12345', method: 'pix_manual', terms: '1' },
  })
  const brunoOrder = (await bruno.html('/aluno')).match(/\/pedido\/([a-z0-9]+)/)[1]
  await bruno.send(`/pedido/${brunoOrder}/paguei`, { method: 'POST' })

  // Histórico de vendas dos últimos 30 dias (direto no banco local)
  const names = ['Carla Mendes', 'Diego Rocha', 'Elisa Prado', 'Fábio Nunes', 'Gabriela Reis', 'Hugo Martins', 'Isabela Costa', 'João Pedro', 'Karina Alves', 'Lucas Ferreira', 'Marina Duarte', 'Nathan Silva', 'Olívia Ramos', 'Paulo Henrique', 'Rafaela Gomes', 'Samuel Teixeira', 'Tatiane Lopes', 'Vinícius Barros', 'Yasmin Freitas', 'Zeca Moura']
  const prices = [19700, 9700, 6790]
  const methods = ['pix_manual', 'mp_pix', 'mp_pix', 'mp_card']
  const now = Date.now()
  let sql = ''
  let seedN = 7
  const rnd = () => ((seedN = (seedN * 9301 + 49297) % 233280) / 233280)
  for (let i = 0; i < 46; i++) {
    const n = names[i % names.length]
    const email = `${slugOf(n)}${i}@exemplo.com`
    const course = rnd() < 0.5 ? 1 : rnd() < 0.6 ? 2 : 3
    const t = now - Math.floor(rnd() * 29 * 86400000) - 3600000
    const status = i === 5 ? 'refund_requested' : i === 9 ? 'refunded' : i % 11 === 3 ? 'pending' : 'paid'
    const method = methods[i % methods.length]
    const id = `demo${String(i).padStart(4, '0')}x${Math.floor(rnd() * 1e6).toString(36)}`
    sql += `INSERT INTO students (name, email, password_hash, created_at) VALUES ('${n}', '${email}', 'x', ${t});\n`
    sql += `INSERT INTO orders (id, course_id, student_id, amount_cents, method, status, created_at, paid_at) VALUES ('${id}', ${course}, (SELECT id FROM students WHERE email='${email}'), ${prices[course - 1]}, '${method}', '${status}', ${t}, ${status === 'pending' ? 'NULL' : t + 60000});\n`
  }
  writeFileSync(join(STATE, 'seed.sql'), sql)
  execFileSync(isWin ? 'npx.cmd' : 'npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--persist-to', STATE, '--file', join(STATE, 'seed.sql')], {
    stdio: 'ignore',
    shell: isWin,
  })
  // Um visitante com Pix pendente para cada curso (é para onde o checkout da demo leva)
  const checkoutOrders = {}
  for (const [i, c] of COURSES.entries()) {
    const v = client()
    await v.send(`/c/${slugOf(c.title)}/comprar`, {
      method: 'POST',
      form: { name: 'Visitante da Demo', email: `visitante${i}@exemplo.com`, password: 'demo12345', method: 'pix_manual', terms: '1' },
    })
    checkoutOrders[slugOf(c.title)] = [(await v.html('/aluno')).match(/\/pedido\/([a-z0-9]+)/)[1], v]
  }
  return { admin, ana, pendingPix, paidOrder, checkoutOrders, anon: client() }
}

// ───────── 3. salva as telas ─────────
function fileFor(path) {
  const [p, q] = path.split('?')
  let f = p === '/' ? 'index' : p.replace(/^\/|\/$/g, '')
  if (q) f += '--' + q.replace(/[^a-z0-9]+/gi, '-')
  return f + '.html'
}

async function main() {
  await waitReady()
  const { admin, ana, pendingPix, paidOrder, checkoutOrders, anon } = await seed()
  const slugs = COURSES.map((c) => slugOf(c.title))

  const pages = [] // [path, client]
  const add = (p, cl) => pages.push([p, cl])
  add('/', anon)
  add('/termos', anon)
  add('/aluno/entrar', anon)
  for (const s of slugs) {
    add(`/c/${s}`, anon)
    add(`/c/${s}/comprar`, anon)
  }
  add(`/pedido/${pendingPix}`, ana)
  for (const [oid, v] of Object.values(checkoutOrders)) add(`/pedido/${oid}`, v)
  add(`/pedido/${paidOrder}`, ana)
  add('/aluno', ana)
  const lessonLinks = [...(await ana.html('/aluno/curso/1/aula/1')).matchAll(/href="(\/aluno\/curso\/1\/aula\/\d+)"/g)].map((m) => m[1])
  for (const l of new Set(['/aluno/curso/1/aula/1', ...lessonLinks])) add(l, ana)
  add('/admin', admin)
  for (const st of ['', 'awaiting_confirmation', 'paid', 'pending', 'refund_requested', 'refunded', 'cancelled']) add(`/admin/pedidos${st ? `?status=${st}` : ''}`, admin)
  add('/admin/cursos', admin)
  add('/admin/cursos/novo', admin)
  for (const id of [1, 2, 3]) add(`/admin/cursos/${id}`, admin)
  const lessonEdit = [...(await admin.html('/admin/cursos/1')).matchAll(/href="(\/admin\/aulas\/\d+)"/g)].map((m) => m[1])
  for (const l of lessonEdit) add(l, admin)
  add('/admin/alunos', admin)
  add('/admin/configuracoes', admin)

  const known = new Map(pages.map(([p]) => [p, fileFor(p)]))
  known.set('/aluno/curso/1', fileFor('/aluno/curso/1/aula/1'))
  known.set('/admin/entrar', fileFor('/admin'))
  // Para onde cada formulário "vai" na demo (no site real, ele salvaria/pagaria de verdade)
  const formNext = (action, page) => {
    const m = /^\/c\/([^/]+)\/comprar$/.exec(page)
    if (m) return `/pedido/${checkoutOrders[m[1]][0]}`
    if (page === '/aluno/entrar') return '/aluno'
    if (action.endsWith('/paguei')) return `/pedido/${pendingPix}`
    if (action === '/admin/sair' || action === '/aluno/sair') return '/'
    return null
  }

  const link = (raw, page) => {
    if (!raw.startsWith('/') || raw.startsWith('//')) return raw
    const [pathq, hash] = raw.split('#')
    if (pathq.startsWith('/assets/') || pathq.startsWith('/media/')) return BASE + pathq.slice(1)
    if (pathq === '') return raw
    const file = known.get(pathq) ?? known.get(pathq.split('?')[0])
    return file ? BASE + file + (hash ? '#' + hash : '') : `${BASE}${fileFor(page)}#demo-off`
  }

  const banner = (page) => `
<div class="demo-bar"><div class="demo-in">
  <span><strong>Demonstração</strong> do Taxa Zero: dados fictícios, nada é cobrado.</span>
  <label class="demo-theme">Tema <select aria-label="Tema da demo"><option value="saas">SaaS moderno</option><option value="editorial">Editorial</option><option value="cyber">Cyber</option><option value="suico">Suíço</option><option value="minimo">Mínimo</option></select></label>
  <nav><a href="${BASE}index.html"${!page.startsWith('/admin') && !page.startsWith('/aluno') ? ' class="on"' : ''}>Loja</a><a href="${BASE}aluno.html"${page.startsWith('/aluno') || page.startsWith('/pedido') ? ' class="on"' : ''}>Área do aluno</a><a href="${BASE}admin.html"${page.startsWith('/admin') ? ' class="on"' : ''}>Painel do vendedor</a><a href="${REPO}" class="gh">GitHub ↗</a></nav>
</div></div>`

  for (const [p, cl] of pages) {
    const res = await cl.send(p)
    if (res.status !== 200) throw new Error(`${p} -> ${res.status}`)
    let html = await res.text()
    html = html.replace(/(href|src|action|data-redirect)="([^"]*)"/g, (_, attr, v) => {
      const decoded = v.replace(/&amp;/g, '&')
      if (attr === 'action') {
        const next = formNext(decoded, p)
        return `action="${BASE}${fileFor(p)}" data-demo-next="${next ? link(next, p) : ''}"`
      }
      return `${attr}="${link(decoded, p).replace(/&/g, '&amp;')}"`
    })
    html = html.replace(/<form method="post"(?![^>]*action=)/g, () => {
      const next = formNext('', p)
      return `<form method="post" data-demo-next="${next ? link(next, p) : ''}"`
    })
    html = html.replace(/ data-poll="[^"]*"/g, '').replace(/ (required|minlength="\d+")(="")?/g, '')
    html = html.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${ALL_FONTS}&amp;display=swap"/>`)
    html = html.replace('</head>', `<link rel="stylesheet" href="${BASE}assets/demo.css"/><script src="${BASE}assets/demo.js"></script></head>`)
    html = html.replace(/<body>/, `<body>${banner(p)}`)
    const out = join(OUT, fileFor(p))
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, html)
  }

  mkdirSync(join(OUT, 'assets'), { recursive: true })
  for (const a of ['app.css', 'app.js']) writeFileSync(join(OUT, 'assets', a), await (await fetch(`${URL0}/assets/${a}`)).text())
  writeFileSync(join(OUT, 'assets', 'demo.css'), DEMO_CSS)
  writeFileSync(join(OUT, 'assets', 'demo.js'), DEMO_JS)
  writeFileSync(join(OUT, '404.html'), `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${BASE}index.html">`)
  writeFileSync(join(OUT, '.nojekyll'), '')
  console.log(`Demo gerada em ./${OUT} (${pages.length} páginas)`)
}

const ALL_FONTS =
  'family=Inter:wght@300;400;500;600;700;800&amp;family=Inter+Tight:wght@600;800;900&amp;family=JetBrains+Mono:wght@400;500;700&amp;family=Source+Serif+4:opsz,ital,wght@8..60,0,400;8..60,0,600;8..60,1,400'

const DEMO_CSS = `
.demo-bar{background:#15132b;color:#e9e6ff;font-size:.86rem;position:relative;z-index:20}
.demo-in{max-width:1120px;margin:0 auto;padding:9px 20px;display:flex;gap:10px 18px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.demo-bar nav{display:flex;gap:4px;flex-wrap:wrap}
.demo-bar a{color:#c9c2ff;padding:4px 10px;border-radius:8px;font-weight:600}
.demo-bar a:hover{background:rgba(255,255,255,.08);text-decoration:none}
.demo-bar a.on{background:#6d4aff;color:#fff}
.demo-bar a.gh{color:#fff}
.admin .side{top:0}
.demo-theme{display:flex;gap:8px;align-items:center;color:#9d97c9;font-weight:500;margin:0;font-size:.86rem}
.demo-theme select{background:#262246;color:#fff;border:1px solid #3d3870;border-radius:7px;padding:4px 8px;font:inherit;width:auto}
.demo-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);background:#15132b;color:#fff;padding:12px 18px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.3);font-size:.92rem;opacity:0;transition:.25s;z-index:99;max-width:calc(100% - 32px);text-align:center}
.demo-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
`

const DEMO_JS = `
(function(){
  var KEY='tz-demo-tema', root=document.documentElement;
  try{var saved=localStorage.getItem(KEY); if(saved) root.setAttribute('data-theme',saved)}catch(e){}
  function setTheme(t){root.setAttribute('data-theme',t);try{localStorage.setItem(KEY,t)}catch(e){}
    document.querySelectorAll('.demo-theme select').forEach(function(s){s.value=t});
    document.querySelectorAll('input[name=theme]').forEach(function(r){r.checked=r.value===t})}
  document.addEventListener('DOMContentLoaded',function(){
    var cur=root.getAttribute('data-theme'); setTheme(cur);
    document.querySelectorAll('.demo-theme select').forEach(function(s){s.addEventListener('change',function(){setTheme(s.value)})});
    document.querySelectorAll('input[name=theme]').forEach(function(r){r.addEventListener('change',function(){setTheme(r.value)})});
  });
  function toast(msg){
    var t=document.querySelector('.demo-toast');
    if(!t){t=document.createElement('div');t.className='demo-toast';document.body.appendChild(t)}
    t.textContent=msg;t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove('on')},3200);
  }
  window.addEventListener('submit',function(e){
    var f=e.target; if((f.getAttribute('method')||'get').toLowerCase()==='get') return;
    e.preventDefault(); e.stopImmediatePropagation();
    var next=f.getAttribute('data-demo-next');
    if(next){ location.href=next; return; }
    toast('Na demo nada é salvo. No seu site, esta ação funciona de verdade.');
  },true);
  window.addEventListener('change',function(e){
    if(e.target.type==='file'){e.stopImmediatePropagation();e.target.value='';toast('Na demo o upload está desativado. No seu site, o vídeo vai direto para o seu armazenamento.')}
  },true);
  window.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a'); if(!a) return;
    if((a.getAttribute('href')||'').indexOf('#demo-off')>=0){e.preventDefault();toast('Esta tela não faz parte da demo.')}
  },true);
})();
`

main()
  .then(() => {
    stop()
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    stop()
    process.exit(1)
  })
