/**
 * Visual do Taxa Zero. Tudo é controlado por variáveis CSS, e cada TEMA só troca as variáveis
 * (mais alguns toques próprios no fim do arquivo). O tema é escolhido em /admin/configuracoes.
 *
 * Temas: saas (padrão) · editorial · cyber · suico · minimo
 */
export const THEMES = [
  { id: 'saas', name: 'SaaS moderno', desc: 'Limpo, confiável, cantos arredondados', swatch: ['#f6f9fc', '#635bff', '#0a2540'] },
  { id: 'editorial', name: 'Editorial', desc: 'Elegante, título serifado, estilo revista', swatch: ['#fbfaf7', '#1b1b18', '#9a4f22'] },
  { id: 'cyber', name: 'Cyber', desc: 'Escuro, neon, fonte de terminal', swatch: ['#05060a', '#00f0ff', '#ff2bd6'] },
  { id: 'suico', name: 'Suíço', desc: 'Preto, branco e vermelho, bordas grossas', swatch: ['#ffffff', '#000000', '#e10600'] },
  { id: 'minimo', name: 'Mínimo', desc: 'Bordas quase invisíveis, muito respiro', swatch: ['#ffffff', '#f0f0f0', '#111111'] },
] as const

export type ThemeId = (typeof THEMES)[number]['id']
export const isTheme = (t: string): t is ThemeId => THEMES.some((x) => x.id === t)

export const THEME_FONTS: Record<ThemeId, string> = {
  saas: 'family=Inter:wght@400;500;600;700;800',
  editorial: 'family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,ital,wght@8..60,0,400;8..60,0,600;8..60,1,400',
  cyber: 'family=JetBrains+Mono:wght@400;500;700',
  suico: 'family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;800;900',
  minimo: 'family=Inter:wght@300;400;500;600',
}
export const ALL_FONTS =
  'family=Inter:wght@300;400;500;600;700;800&family=Inter+Tight:wght@600;800;900&family=JetBrains+Mono:wght@400;500;700&family=Source+Serif+4:opsz,ital,wght@8..60,0,400;8..60,0,600;8..60,1,400'

/**
 * Modo claro/escuro. Cada tema tem a sua versão "invertida":
 * os temas claros ganham uma versão escura, e o Cyber (que nasce escuro) ganha uma clara.
 * <html data-mode="auto"> segue o aparelho do visitante; "light"/"dark" forçam.
 */
export const COLOR_MODES = [
  { id: 'auto', name: 'Automático', desc: 'Segue o modo do celular ou computador de quem visita' },
  { id: 'light', name: 'Sempre claro', desc: '' },
  { id: 'dark', name: 'Sempre escuro', desc: '' },
] as const
export type ColorMode = (typeof COLOR_MODES)[number]['id']
export const isColorMode = (m: string): m is ColorMode => COLOR_MODES.some((x) => x.id === m)

const DARK_VARS: Partial<Record<ThemeId, string>> = {
  saas: `--bg:#0a1020; --surface:#111a2e; --surface-2:#18233b; --ink:#e6edf7; --muted:#93a3b8; --line:#22304a; --card-line:#1c2840;
    --accent:#7c75ff; --ok:#3ddc97; --ok-bg:#0f2e22; --warn:#ffb547; --warn-bg:#33240b; --bad:#ff6b81; --bad-bg:#3a1520;
    --shadow:0 1px 2px rgba(0,0,0,.3),0 12px 32px rgba(0,0,0,.35); --top-bg:rgba(10,16,32,.82); --side-bg:#0d1526; --input-bg:#0d1526; --code:#18233b; color-scheme:dark;`,
  editorial: `--bg:#151412; --surface:#1c1b18; --surface-2:#24221e; --ink:#ece8df; --muted:#a39d90; --line:#34312b;
    --accent:#e0965f; --btn:#ece8df; --btn-ink:#151412; --dot-ink:#151412; --ok:#8fcf95; --ok-bg:#1d2a1e; --warn:#e6bb62; --warn-bg:#2d2615; --bad:#ef8a7e; --bad-bg:#33201d;
    --top-bg:rgba(21,20,18,.9); --side-bg:#151412; --input-bg:#1c1b18; --cover:#2a2723; --cover-2:#322e29; --cover-3:#3a352f; --cover-ink:#ece8df; --bar:#ece8df; --code:#24221e; color-scheme:dark;`,
  suico: `--bg:#000; --surface:#000; --surface-2:#141414; --ink:#fff; --muted:#aaa; --line:#fff;
    --accent:#ff2a1f; --ok:#fff; --ok-bg:#000; --warn-bg:#000; --bad-bg:#000;
    --top-bg:#000; --side-bg:#000; --input-bg:#000; --cover:#fff; --cover-2:var(--accent); --cover-3:#1c1c1c; --cover-ink:#000; --cover-ink-2:#fff; --cover-ink-3:#fff; --bar:#fff; --code:#141414; color-scheme:dark;`,
  minimo: `--bg:#0c0c0c; --surface:#0c0c0c; --surface-2:#161616; --ink:#ededed; --muted:#8a8a8a; --line:#1f1f1f;
    --accent:#ededed; --btn:#ededed; --btn-ink:#0c0c0c; --dot-ink:#0c0c0c; --ok:#ededed; --ok-bg:#1a1a1a; --warn:#ededed; --warn-bg:#1a1a1a; --bad:#ff6b5e; --bad-bg:#2a1312;
    --top-bg:rgba(12,12,12,.9); --side-bg:#0c0c0c; --input-bg:#0c0c0c; --cover:#151515; --cover-2:#191919; --cover-3:#1d1d1d; --cover-ink:#ededed; --bar:#ededed; --code:#161616; color-scheme:dark;`,
}
const LIGHT_VARS: Partial<Record<ThemeId, string>> = {
  cyber: `--bg:#eef6fb; --surface:#fff; --surface-2:#e3f0f7; --ink:#061a26; --muted:#4f6a7d; --line:#b9d4e3; --hi:#061a26;
    --accent:#c4009a; --btn:#007f8c; --btn-ink:#fff; --label:#c4009a; --neon:#007f8c;
    --ok:#0a7d43; --ok-bg:#dcf5e8; --warn:#8a6d00; --warn-bg:#fdf3cf; --bad:#c41d3f; --bad-bg:#fde6eb;
    --top-bg:rgba(238,246,251,.85); --side-bg:#f6fbfe; --input-bg:#fff; --code:#e3f0f7; color-scheme:light;`,
}

function modeCss() {
  let out = ''
  const add = (vars: Partial<Record<ThemeId, string>>, mode: 'dark' | 'light') => {
    for (const [t, v] of Object.entries(vars))
      out += `html[data-theme=${t}][data-mode=${mode}]{${v}}\n@media (prefers-color-scheme:${mode}){html[data-theme=${t}][data-mode=auto]{${v}}}\n`
  }
  add(DARK_VARS, 'dark')
  add(LIGHT_VARS, 'light')
  return out
}

export const CSS = /* css */ `
:root,[data-theme=saas]{
  --bg:#f6f9fc; --surface:#fff; --surface-2:#f1f4f9; --ink:#0a2540; --muted:#5b6b80; --line:#e3e8ef; --lw:1px;
  --accent:#635bff; --btn:var(--accent); --btn-ink:#fff; --label:var(--accent);
  --ok:#0e8a5f; --ok-bg:#dff6ec; --warn:#a15c00; --warn-bg:#fff1dc; --bad:#c9314a; --bad-bg:#fdebee;
  --radius:14px; --r-btn:9px; --r-sm:7px;
  --shadow:0 1px 2px rgba(10,37,64,.04),0 10px 30px rgba(10,37,64,.06);
  --fh:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; --fb:var(--fh);
  --hw:700; --ht:none; --hls:-.025em; --lt:none; --lls:0;
  --top-bg:rgba(255,255,255,.85); --side-bg:#fff; --input-bg:#fff;
  --cover:linear-gradient(135deg,var(--accent),#00d4ff); --cover-2:linear-gradient(135deg,#ff6b9d,#ffb36b); --cover-3:linear-gradient(135deg,#0e8a5f,#7ee0b1); --cover-ink:#fff;
  --bar:var(--accent); --code:#f1f4f9; --card-line:#eef1f5;
  color-scheme:light;
}
[data-theme=editorial]{
  --bg:#fbfaf7; --surface:#fff; --surface-2:#f3f0e8; --ink:#1b1b18; --muted:#6f6b61; --line:#e4e0d6; --lw:1px;
  --accent:#9a4f22; --btn:#1b1b18; --btn-ink:#fbfaf7; --label:var(--accent);
  --ok:#2f6b3a; --ok-bg:#e6efe4; --warn:#8a5a00; --warn-bg:#f6ecd6; --bad:#a32d2d; --bad-bg:#f7e4e1;
  --radius:0px; --r-btn:0px; --r-sm:0px; --shadow:none;
  --fh:"Source Serif 4",Georgia,serif; --fb:Inter,ui-sans-serif,system-ui,sans-serif;
  --hw:400; --ht:none; --hls:-.01em; --lt:uppercase; --lls:.1em;
  --top-bg:rgba(251,250,247,.9); --side-bg:#fbfaf7; --input-bg:#fff;
  --cover:#ece6d9; --cover-2:#e3dccb; --cover-3:#d9d1bd; --cover-ink:#1b1b18;
  --bar:#1b1b18; --code:#f3f0e8; color-scheme:light;
}
[data-theme=cyber]{
  --bg:#05060a; --surface:#0b0d14; --surface-2:#11152a; --ink:#d9faff; --muted:#7891a8; --line:#16324a; --lw:1px;
  --accent:#ff2bd6; --btn:#00f0ff; --btn-ink:#05060a; --label:#ff2bd6; --neon:#00f0ff;
  --ok:#39ff88; --ok-bg:#0b2a1a; --warn:#ffe14d; --warn-bg:#2a2508; --bad:#ff4d6d; --bad-bg:#2c0b14;
  --radius:0px; --r-btn:0px; --r-sm:0px; --shadow:none;
  --fh:"JetBrains Mono",ui-monospace,Consolas,monospace; --fb:var(--fh);
  --hw:700; --ht:uppercase; --hls:-.02em; --lt:uppercase; --lls:.16em;
  --top-bg:rgba(5,6,10,.85); --side-bg:#080a11; --input-bg:#070910;
  --cover:repeating-linear-gradient(0deg,#0b0d14 0 3px,#0e1424 3px 4px); --cover-2:var(--cover); --cover-3:var(--cover); --cover-ink:#00f0ff;
  --bar:linear-gradient(#ff2bd6,#00f0ff); --code:#0f1220; --hi:#fff; color-scheme:dark;
}
[data-theme=suico]{
  --bg:#fff; --surface:#fff; --surface-2:#f2f2f2; --ink:#000; --muted:#555; --line:#000; --lw:2px;
  --accent:#e10600; --btn:var(--accent); --btn-ink:#fff; --label:var(--accent);
  --ok:#000; --ok-bg:#fff; --warn:#e10600; --warn-bg:#fff; --bad:#e10600; --bad-bg:#fff;
  --radius:0px; --r-btn:0px; --r-sm:0px; --shadow:none;
  --fh:"Inter Tight",Inter,ui-sans-serif,system-ui,sans-serif; --fb:Inter,ui-sans-serif,system-ui,sans-serif;
  --hw:900; --ht:none; --hls:-.045em; --lt:uppercase; --lls:.06em;
  --top-bg:#fff; --side-bg:#fff; --input-bg:#fff;
  --cover:#000; --cover-2:var(--accent); --cover-3:#f2f2f2; --cover-ink:#fff; --cover-ink-3:#000;
  --bar:#000; --code:#f2f2f2; color-scheme:light;
}
[data-theme=minimo]{
  --bg:#fff; --surface:#fff; --surface-2:#fafafa; --ink:#111; --muted:#8a8a8a; --line:#f0f0f0; --lw:1px;
  --accent:#111; --btn:#111; --btn-ink:#fff; --label:var(--muted);
  --ok:#111; --ok-bg:#f3f3f3; --warn:#111; --warn-bg:#f3f3f3; --bad:#b3261e; --bad-bg:#fbeeed;
  --radius:0px; --r-btn:0px; --r-sm:0px; --shadow:none;
  --fh:Inter,ui-sans-serif,system-ui,sans-serif; --fb:var(--fh);
  --hw:300; --ht:none; --hls:-.03em; --lt:none; --lls:0;
  --top-bg:rgba(255,255,255,.9); --side-bg:#fff; --input-bg:#fff;
  --cover:#f6f6f6; --cover-2:#f1f1f1; --cover-3:#ececec; --cover-ink:#111;
  --bar:#111; --code:#fafafa; color-scheme:light;
}

*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 var(--fb);-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none} a:hover{text-decoration:underline}
img{max-width:100%;display:block}
h1,h2,h3,h4{font-family:var(--fh);font-weight:var(--hw);text-transform:var(--ht);letter-spacing:var(--hls);line-height:1.1;margin:0 0 .5em}
h1{font-size:clamp(2.1rem,4.8vw,3.4rem)}
h2{font-size:1.55rem} h3{font-size:1.15rem}
p{margin:0 0 1em}
code{font-family:"JetBrains Mono",ui-monospace,Consolas,monospace;background:var(--code);padding:2px 6px;border-radius:var(--r-sm)}
.wrap{max-width:1180px;margin:0 auto;padding:0 24px}
.narrow{max-width:520px;margin:0 auto;padding:0 20px}
.muted{color:var(--muted)} .small{font-size:.875rem} .center{text-align:center} .nowrap{white-space:nowrap}
.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap} .spread{justify-content:space-between}
.stack>*+*{margin-top:16px}
.grid{display:grid;gap:22px}
.g2{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.g3{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.g4{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
.eyebrow{font-size:.74rem;font-weight:600;text-transform:var(--lt);letter-spacing:var(--lls);color:var(--label)}

/* topo */
.top{position:sticky;top:0;z-index:10;background:var(--top-bg);backdrop-filter:saturate(1.6) blur(14px);border-bottom:var(--lw) solid var(--line)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;height:68px;gap:16px}
.brand{display:flex;align-items:center;gap:10px;font:700 1.05rem var(--fh);text-transform:var(--ht);letter-spacing:var(--hls);color:var(--ink)}
.brand:hover{text-decoration:none}
.brand img{height:34px;width:auto;border-radius:var(--r-sm)}
.brand .dot{width:30px;height:30px;border-radius:var(--r-btn);background:var(--accent);display:grid;place-items:center;color:var(--dot-ink,#fff);font-size:.9rem}
.nav{display:flex;gap:6px;align-items:center}
.nav a{color:var(--muted);font-weight:550;padding:8px 12px;border-radius:var(--r-btn);font-size:.95rem}
.nav a:hover{background:var(--surface-2);color:var(--ink);text-decoration:none}

/* botões e campos */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:var(--lw) solid var(--btn);border-radius:var(--r-btn);padding:12px 20px;font:600 .95rem/1.2 var(--fb);cursor:pointer;background:var(--btn);color:var(--btn-ink);transition:transform .08s,filter .15s;text-decoration:none!important;white-space:nowrap;text-transform:var(--lt);letter-spacing:var(--lls)}
.btn:hover{filter:brightness(1.08)} .btn:active{transform:translateY(1px)}
.btn.lg{padding:16px 28px;font-size:1.02rem}
.btn.block{width:100%}
.btn.ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.btn.ghost:hover{background:var(--surface-2)}
.btn.sm{padding:7px 12px;font-size:.82rem}
.btn.danger{background:var(--bad);border-color:var(--bad);color:#fff}
.btn.ok{background:var(--ok);border-color:var(--ok);color:var(--bg)}
.btn[disabled]{opacity:.55;cursor:not-allowed}
label{display:block;font-weight:600;font-size:.9rem;margin-bottom:6px}
.hint{font-weight:400;color:var(--muted);font-size:.83rem;margin-top:5px}
input[type=text],input[type=email],input[type=password],input[type=number],input[type=url],input:not([type]),select,textarea{
  width:100%;padding:11px 14px;border:var(--lw) solid var(--line);border-radius:var(--r-btn);background:var(--input-bg);color:var(--ink);font:inherit;transition:border-color .15s,box-shadow .15s}
input:focus,select:focus,textarea:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
textarea{min-height:110px;resize:vertical}
input[type=color]{width:56px;height:44px;border:var(--lw) solid var(--line);border-radius:var(--r-btn);background:var(--surface);padding:4px}
.check{display:flex;gap:10px;align-items:flex-start;font-weight:500}
.check input{margin-top:5px;width:18px;height:18px;accent-color:var(--accent)}
.field+.field{margin-top:16px}

/* cartões */
.card{background:var(--surface);border:var(--lw) solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:24px}
.card.pad-lg{padding:32px}
.card h3{margin-bottom:.35em}
.badge{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:var(--r-btn);font-size:.76rem;font-weight:650;background:var(--surface-2);color:var(--muted);white-space:nowrap;text-transform:var(--lt);letter-spacing:calc(var(--lls) / 2)}
.badge.ok{background:var(--ok-bg);color:var(--ok)} .badge.warn{background:var(--warn-bg);color:var(--warn)} .badge.bad{background:var(--bad-bg);color:var(--bad)}
.badge.accent{background:color-mix(in srgb,var(--accent) 13%,transparent);color:var(--accent)}
.alert{padding:14px 16px;border-radius:var(--r-btn);font-size:.93rem;margin-bottom:18px;border:var(--lw) solid transparent}
.alert.ok{background:var(--ok-bg);color:var(--ok);border-color:color-mix(in srgb,var(--ok) 25%,transparent)}
.alert.warn{background:var(--warn-bg);color:var(--warn);border-color:color-mix(in srgb,var(--warn) 25%,transparent)}
.alert.bad{background:var(--bad-bg);color:var(--bad);border-color:color-mix(in srgb,var(--bad) 25%,transparent)}
.alert.info{background:color-mix(in srgb,var(--accent) 8%,var(--surface));color:var(--ink);border-color:color-mix(in srgb,var(--accent) 25%,transparent)}

/* vitrine */
.hero{padding:80px 0 44px;text-align:center}
.hero h1{font-size:clamp(2.4rem,5.4vw,4rem)}
.hero p{font-size:1.2rem;color:var(--muted);max-width:620px;margin:0 auto}
.course-card{overflow:hidden;padding:0;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s;color:var(--ink)}
.course-card:hover{transform:translateY(-3px);text-decoration:none}
.cover{aspect-ratio:16/9;background:var(--cover);display:flex;align-items:flex-end;color:var(--cover-ink);font:var(--hw) 1.35rem/1.15 var(--fh);text-transform:var(--ht);letter-spacing:var(--hls);padding:20px 22px;overflow:hidden;border-bottom:var(--lw) solid var(--line)}
.grid>:nth-child(3n+2) .cover{background:var(--cover-2);color:var(--cover-ink-2,var(--cover-ink))}
.grid>:nth-child(3n+3) .cover{background:var(--cover-3);color:var(--cover-ink-3,var(--cover-ink))}
.cover img{width:calc(100% + 44px);height:calc(100% + 40px);margin:-20px -22px;object-fit:cover;max-width:none}
.course-card .body{padding:20px 22px 22px;display:flex;flex-direction:column;gap:6px;flex:1}
.price{font:800 1.35rem var(--fh);letter-spacing:var(--hls)}

/* página de vendas */
.sales{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:44px;align-items:start;padding-top:52px;padding-bottom:84px}
@media (max-width:900px){.sales{grid-template-columns:1fr}}
.sticky{position:sticky;top:92px}
.buybox .price{font-size:2.6rem;font-weight:var(--hw)}
.ticks{list-style:none;padding:0;margin:0}
.ticks li{padding:10px 0 10px 32px;position:relative;border-top:var(--lw) solid var(--line)}
.ticks li:first-child{border-top:0}
.ticks li::before{content:"✓";position:absolute;left:4px;top:10px;color:var(--accent);font-weight:800}
.prose h2,.prose h3{margin-top:1.4em} .prose ul{padding-left:1.2em}
.curriculum details{border:var(--lw) solid var(--line);border-radius:var(--r-btn);background:var(--surface);margin-bottom:10px}
.curriculum summary{padding:14px 18px;font-weight:650;cursor:pointer;list-style:none;display:flex;justify-content:space-between}
.curriculum summary::-webkit-details-marker{display:none}
.curriculum summary>span:first-child::before{content:"▸";display:inline-block;width:1.1em;color:var(--muted);transition:transform .15s}
.curriculum details[open] summary>span:first-child::before{transform:rotate(90deg)}
.linkish{background:none;border:0;padding:0;font:inherit;color:var(--accent);cursor:pointer;text-decoration:underline}
.curriculum ol{margin:0;padding:0 18px 14px 40px;color:var(--muted)}
.trust{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;font-size:.82rem;color:var(--muted);margin-top:14px}

/* checkout */
.methods{display:grid;gap:10px}
.method{display:flex;gap:14px;align-items:center;border:var(--lw) solid var(--line);border-radius:var(--r-btn);padding:14px 16px;cursor:pointer;background:var(--surface);transition:border-color .15s,background .15s;font-weight:600}
.method:has(input:checked){border-color:var(--accent);background:color-mix(in srgb,var(--accent) 7%,var(--surface));box-shadow:0 0 0 1px var(--accent)}
.method input{accent-color:var(--accent);width:18px;height:18px}
.method .sub{display:block;font-weight:400;font-size:.83rem;color:var(--muted)}
.qr{background:#fff;border-radius:var(--radius);padding:14px;display:inline-block;border:var(--lw) solid var(--line)}
.qr svg,.qr img{width:240px;height:240px;display:block}
.copy{display:flex;gap:8px} .copy input{font-family:"JetBrains Mono",ui-monospace,Consolas,monospace;font-size:.8rem}
.steps{counter-reset:s;list-style:none;padding:0;margin:0;text-align:left}
.steps li{counter-increment:s;padding:6px 0 6px 36px;position:relative}
.steps li::before{content:counter(s);position:absolute;left:0;top:6px;width:24px;height:24px;border-radius:var(--r-btn);background:var(--surface-2);font-size:.8rem;font-weight:700;display:grid;place-items:center}
.pulse{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--warn);animation:p 1.4s infinite}
@keyframes p{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--warn) 60%,transparent)}100%{box-shadow:0 0 0 12px transparent}}

/* player */
.player{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;padding:28px 0 60px}
@media (max-width:960px){.player{grid-template-columns:1fr}}
.video{aspect-ratio:16/9;background:#000;border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow)}
.video video,.video iframe{width:100%;height:100%;border:0;display:block}
.video.empty{display:grid;place-items:center;color:#aaa}
.lessons{padding:8px;max-height:calc(100vh - 140px);overflow:auto}
.lessons h4{font:600 .74rem var(--fb);text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:14px 10px 6px}
.lessons a{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:var(--r-btn);color:var(--ink);font-size:.93rem}
.lessons a:hover{background:var(--surface-2);text-decoration:none}
.lessons a.on{background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);font-weight:650}
.progress{height:6px;border-radius:var(--r-btn);background:var(--surface-2);overflow:hidden}
.progress span{display:block;height:100%;background:var(--accent)}

/* admin */
.admin{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:100vh}
@media (max-width:860px){.admin{grid-template-columns:1fr}.side{position:static!important;height:auto!important}}
.side{background:var(--side-bg);border-right:var(--lw) solid var(--line);padding:22px 14px;position:sticky;top:0;height:100vh;overflow:auto}
.side .brand{padding:4px 10px 22px}
.side nav a{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:var(--r-btn);color:var(--muted);font-weight:560;margin-bottom:2px}
.side nav a:hover{background:var(--surface-2);color:var(--ink);text-decoration:none}
.side nav a.on{background:color-mix(in srgb,var(--accent) 11%,transparent);color:var(--accent)}
.side nav .ico{width:20px;text-align:center}
.main{padding:32px clamp(16px,3.2vw,44px) 64px;min-width:0}
.page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:26px}
.page-head h1{font-size:2rem;margin:0}
.kpi .label{color:var(--muted);font-size:.74rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.kpi .value{font:var(--hw) 2rem/1.15 var(--fh);letter-spacing:var(--hls);margin-top:8px}
.chart{display:flex;align-items:flex-end;gap:4px;height:180px;padding-top:12px;border-bottom:var(--lw) solid var(--line)}
.chart .bar{flex:1;background:var(--bar);border-radius:var(--r-sm) var(--r-sm) 0 0;min-height:2px;position:relative;opacity:.88}
.chart .bar:hover{opacity:1}
.chart .bar:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);font-size:.75rem;padding:4px 8px;border-radius:var(--r-sm);white-space:nowrap;z-index:2}
table{width:100%;border-collapse:collapse;font-size:.92rem}
th{text-align:left;font-weight:650;color:var(--muted);font-size:.74rem;text-transform:uppercase;letter-spacing:.05em;padding:10px 12px;border-bottom:var(--lw) solid var(--line)}
td{padding:13px 12px;border-bottom:var(--lw) solid var(--line);vertical-align:middle}
tr:last-child td{border-bottom:0}
.table-wrap{overflow-x:auto;padding:4px 8px}
.empty-state{text-align:center;padding:48px 20px;color:var(--muted)}
.empty-state .big{font-size:2.4rem;margin-bottom:8px}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}
.tabs a{padding:7px 14px;border-radius:var(--r-btn);background:var(--surface);border:var(--lw) solid var(--line);color:var(--muted);font-size:.86rem;font-weight:600}
.tabs a.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.tabs a:hover{text-decoration:none}
.lesson-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;border:var(--lw) solid var(--line);border-radius:var(--r-btn);margin-bottom:8px;background:var(--surface)}
fieldset{border:var(--lw) solid var(--line);border-radius:var(--radius);padding:24px;margin:0 0 20px;background:var(--surface);box-shadow:var(--shadow)}
legend{font:var(--hw) 1.02rem var(--fh);text-transform:var(--ht);padding:0 8px}
.upload-bar{height:8px;background:var(--surface-2);border-radius:var(--r-btn);overflow:hidden;margin-top:8px;display:none}
.upload-bar span{display:block;height:100%;width:0;background:var(--accent);transition:width .2s}
footer.foot{border-top:var(--lw) solid var(--line);padding:28px 0;color:var(--muted);font-size:.85rem;margin-top:40px}
footer.foot .wrap{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.auth{min-height:calc(100vh - 68px);display:grid;place-items:center;padding:40px 0}
.auth .card{width:100%}

/* seletor de tema (configurações) */
.themes{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.theme-opt{display:block;border:var(--lw) solid var(--line);border-radius:var(--r-btn);padding:12px;cursor:pointer;background:var(--surface);font-weight:600;margin:0}
.theme-opt:has(input:checked){border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)}
.theme-opt input{position:absolute;opacity:0;pointer-events:none}
.theme-opt .sw{display:flex;height:46px;margin-bottom:10px;border:1px solid rgba(0,0,0,.08)}
.theme-opt .sw i{flex:1}
.theme-opt .d{display:block;font-weight:400;font-size:.8rem;color:var(--muted)}

/* ───── toques próprios de cada tema ───── */
[data-theme=saas] .card:hover.course-card{box-shadow:0 2px 4px rgba(10,37,64,.05),0 18px 44px rgba(10,37,64,.12)}
[data-theme=saas] .card,[data-theme=saas] fieldset{border-color:var(--card-line)}

[data-theme=editorial] h1{font-style:italic}
[data-theme=editorial] .buybox{border-color:var(--ink)}
[data-theme=editorial] .badge.accent{background:transparent;border:1px solid currentColor}

[data-theme=cyber]{background-image:linear-gradient(rgba(0,240,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(0,240,255,.045) 1px,transparent 1px);background-size:32px 32px}
[data-theme=cyber] body{background:transparent}
[data-theme=cyber] h1{color:var(--hi);text-shadow:0 0 24px rgba(0,240,255,.35)}
[data-theme=cyber] a:not(.btn):not(.brand){color:var(--neon)}
[data-theme=cyber] .card,[data-theme=cyber] fieldset{position:relative}
[data-theme=cyber] .card::before,[data-theme=cyber] fieldset::before{content:"";position:absolute;top:-1px;left:-1px;width:14px;height:14px;border-top:2px solid var(--neon);border-left:2px solid var(--neon);pointer-events:none}
[data-theme=cyber] .card::after,[data-theme=cyber] fieldset::after{content:"";position:absolute;bottom:-1px;right:-1px;width:14px;height:14px;border-bottom:2px solid var(--accent);border-right:2px solid var(--accent);pointer-events:none}
[data-theme=cyber] .btn:not(.ghost):not(.danger):not(.ok){box-shadow:0 0 18px rgba(0,240,255,.4)}
[data-theme=cyber] .btn.ghost{color:var(--neon);border-color:var(--line)}
[data-theme=cyber] .chart .bar{box-shadow:0 0 10px rgba(0,240,255,.35)}
[data-theme=cyber] .brand .dot{box-shadow:0 0 14px var(--accent)}
[data-theme=cyber] .side nav a.on{background:transparent;color:var(--neon);box-shadow:inset 2px 0 0 var(--neon)}
[data-theme=cyber] .kpi .value,[data-theme=cyber] .price{color:var(--hi)}
[data-theme=cyber] .tabs a.on{background:var(--neon);color:var(--btn-ink);border-color:var(--neon)}
[data-theme=cyber] .method:has(input:checked){border-color:var(--neon);box-shadow:0 0 0 1px var(--neon);background:color-mix(in srgb,var(--neon) 7%,var(--surface))}

[data-theme=suico] .hero h1{font-size:clamp(3rem,8vw,6.2rem);line-height:.92}
[data-theme=suico] .side nav a.on{background:var(--ink);color:var(--bg)}
[data-theme=suico] .chart .bar:nth-last-child(-n+5){background:var(--accent)}
[data-theme=suico] .badge{border:2px solid currentColor;background:transparent}
[data-theme=suico] .ticks li::before{content:"■";font-size:.7rem;top:13px}

[data-theme=minimo] .hero{padding:120px 0 70px}
[data-theme=minimo] .buybox{background:var(--surface-2);border-color:transparent}
[data-theme=minimo] .kpi .value{font-weight:300}
[data-theme=minimo] .side nav a.on{background:var(--surface-2);color:var(--ink)}
[data-theme=minimo] .btn.ghost{border-color:color-mix(in srgb,var(--ink) 12%,transparent)}

/* botão claro/escuro */
.mode-btn{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:var(--r-btn);border:var(--lw) solid var(--line);background:transparent;color:var(--muted);cursor:pointer;font-size:1rem;padding:0;flex:none}
.mode-btn:hover{background:var(--surface-2);color:var(--ink)}
.mode-btn .i-dark{display:none}
html[data-mode=dark] .mode-btn .i-light{display:none} html[data-mode=dark] .mode-btn .i-dark{display:inline}
@media (prefers-color-scheme:dark){html[data-mode=auto] .mode-btn .i-light{display:none} html[data-mode=auto] .mode-btn .i-dark{display:inline}}
.coupon-box summary{cursor:pointer;color:var(--accent);font-weight:600;font-size:.92rem;list-style:none}
.coupon-box summary::-webkit-details-marker{display:none}
.coupon-box[open] summary{margin-bottom:10px}
.coupon-box .copy input{text-transform:uppercase}
.sr-copy{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.mode-opts{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.side .side-foot{display:flex;gap:8px;margin-top:10px;align-items:center}
.side .side-foot form{flex:1}
`
  + modeCss()

