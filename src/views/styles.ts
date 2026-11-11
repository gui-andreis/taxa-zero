export const CSS = /* css */ `
:root{
  --accent:#6d4aff; --accent-ink:#fff;
  --bg:#f7f7fb; --surface:#fff; --surface-2:#f1f0f7; --ink:#15132b; --muted:#6b6880; --line:#e6e4f0;
  --ok:#0f9d6b; --ok-bg:#e5f7ef; --warn:#b26b00; --warn-bg:#fff4e0; --bad:#c9314a; --bad-bg:#fdebee;
  --radius:16px; --shadow:0 1px 2px rgba(21,19,43,.04),0 8px 24px rgba(21,19,43,.06);
  color-scheme:light;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0e0d18; --surface:#17152a; --surface-2:#211f38; --ink:#f0eefc; --muted:#a19dbb; --line:#2c2a45;
  --ok:#3fd69a; --ok-bg:#12352a; --warn:#ffb547; --warn-bg:#3a2a10; --bad:#ff6b81; --bad-bg:#3d1520;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.3); color-scheme:dark;
}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none} a:hover{text-decoration:underline}
img{max-width:100%;display:block}
h1,h2,h3,h4{line-height:1.2;letter-spacing:-.02em;margin:0 0 .5em}
h1{font-size:clamp(2rem,4.5vw,3.1rem);font-weight:800}
h2{font-size:1.5rem;font-weight:750} h3{font-size:1.15rem;font-weight:700}
p{margin:0 0 1em}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.narrow{max-width:520px;margin:0 auto;padding:0 20px}
.muted{color:var(--muted)} .small{font-size:.875rem} .center{text-align:center}
.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap} .spread{justify-content:space-between}
.stack>*+*{margin-top:16px}
.grid{display:grid;gap:20px}
.g2{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.g3{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.g4{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}

/* topo */
.top{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:saturate(1.6) blur(14px);border-bottom:1px solid var(--line)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;height:64px;gap:16px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;color:var(--ink);font-size:1.05rem;letter-spacing:-.01em}
.brand:hover{text-decoration:none}
.brand img{height:34px;width:auto;border-radius:8px}
.brand .dot{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 50%,#ff7ab6));display:grid;place-items:center;color:#fff;font-size:.9rem}
.nav{display:flex;gap:6px;align-items:center}
.nav a{color:var(--muted);font-weight:550;padding:8px 12px;border-radius:10px;font-size:.95rem}
.nav a:hover{background:var(--surface-2);color:var(--ink);text-decoration:none}

/* botões e campos */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:12px;padding:12px 20px;font:inherit;font-weight:650;cursor:pointer;background:var(--accent);color:var(--accent-ink);transition:transform .08s,filter .15s,box-shadow .15s;box-shadow:0 6px 18px color-mix(in srgb,var(--accent) 30%,transparent);text-decoration:none!important;white-space:nowrap}
.btn:hover{filter:brightness(1.07)} .btn:active{transform:translateY(1px)}
.btn.lg{padding:16px 28px;font-size:1.08rem;border-radius:14px}
.btn.block{width:100%}
.btn.ghost{background:var(--surface);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line)}
.btn.ghost:hover{background:var(--surface-2)}
.btn.sm{padding:7px 12px;font-size:.85rem;border-radius:9px;box-shadow:none}
.btn.danger{background:var(--bad);box-shadow:none}
.btn.ok{background:var(--ok);box-shadow:none}
.btn[disabled]{opacity:.55;cursor:not-allowed}
label{display:block;font-weight:600;font-size:.9rem;margin-bottom:6px}
.hint{font-weight:400;color:var(--muted);font-size:.83rem;margin-top:5px}
input[type=text],input[type=email],input[type=password],input[type=number],input[type=url],input:not([type]),select,textarea{
  width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--ink);font:inherit;transition:border-color .15s,box-shadow .15s}
input:focus,select:focus,textarea:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 18%,transparent)}
textarea{min-height:110px;resize:vertical}
input[type=color]{width:56px;height:44px;border:1px solid var(--line);border-radius:11px;background:var(--surface);padding:4px}
.check{display:flex;gap:10px;align-items:flex-start;font-weight:500}
.check input{margin-top:5px;width:18px;height:18px;accent-color:var(--accent)}
.field+.field{margin-top:16px}

/* cartões */
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:24px}
.card.pad-lg{padding:32px}
.card h3{margin-bottom:.35em}
.section{padding:56px 0}
.badge{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:.78rem;font-weight:650;background:var(--surface-2);color:var(--muted);white-space:nowrap}
.badge.ok{background:var(--ok-bg);color:var(--ok)} .badge.warn{background:var(--warn-bg);color:var(--warn)} .badge.bad{background:var(--bad-bg);color:var(--bad)}
.badge.accent{background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent)}
.alert{padding:14px 16px;border-radius:12px;font-size:.93rem;margin-bottom:18px;border:1px solid transparent}
.alert.ok{background:var(--ok-bg);color:var(--ok)} .alert.warn{background:var(--warn-bg);color:var(--warn)} .alert.bad{background:var(--bad-bg);color:var(--bad)}
.alert.info{background:color-mix(in srgb,var(--accent) 10%,transparent);color:var(--ink);border-color:color-mix(in srgb,var(--accent) 25%,transparent)}

/* vitrine */
.hero{padding:72px 0 40px;text-align:center}
.hero p{font-size:1.2rem;color:var(--muted);max-width:620px;margin:0 auto}
.course-card{overflow:hidden;padding:0;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s;color:var(--ink)}
.course-card:hover{transform:translateY(-3px);text-decoration:none;box-shadow:0 2px 4px rgba(21,19,43,.05),0 18px 40px rgba(21,19,43,.12)}
.cover{aspect-ratio:16/9;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 40%,#ff9a62));display:grid;place-items:center;color:#fff;font-weight:800;font-size:1.4rem;padding:20px;text-align:center;overflow:hidden}
.cover img{width:100%;height:100%;object-fit:cover}
.course-card .body{padding:20px 22px 22px;display:flex;flex-direction:column;gap:6px;flex:1}
.price{font-weight:800;font-size:1.35rem;letter-spacing:-.02em}

/* página de vendas */
.sales{display:grid;grid-template-columns:1fr 380px;gap:40px;align-items:start;padding:48px 0 80px}
@media (max-width:900px){.sales{grid-template-columns:1fr}}
.sticky{position:sticky;top:88px}
.buybox .price{font-size:2.3rem}
.ticks{list-style:none;padding:0;margin:0}
.ticks li{padding:10px 0 10px 34px;position:relative;border-bottom:1px dashed var(--line)}
.ticks li:last-child{border:0}
.ticks li::before{content:"✓";position:absolute;left:0;top:10px;width:22px;height:22px;border-radius:50%;background:var(--ok-bg);color:var(--ok);display:grid;place-items:center;font-size:.8rem;font-weight:800}
.prose h2,.prose h3{margin-top:1.4em} .prose ul{padding-left:1.2em}
.curriculum details{border:1px solid var(--line);border-radius:12px;background:var(--surface);margin-bottom:10px}
.curriculum summary{padding:14px 18px;font-weight:650;cursor:pointer;list-style:none;display:flex;justify-content:space-between}
.curriculum summary::-webkit-details-marker{display:none}
.curriculum ol{margin:0;padding:0 18px 14px 40px;color:var(--muted)}
.trust{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;font-size:.82rem;color:var(--muted);margin-top:14px}

/* checkout */
.methods{display:grid;gap:10px}
.method{display:flex;gap:14px;align-items:center;border:1.5px solid var(--line);border-radius:14px;padding:14px 16px;cursor:pointer;background:var(--surface);transition:border-color .15s,background .15s;font-weight:600}
.method:has(input:checked){border-color:var(--accent);background:color-mix(in srgb,var(--accent) 7%,var(--surface))}
.method input{accent-color:var(--accent);width:18px;height:18px}
.method .sub{display:block;font-weight:400;font-size:.83rem;color:var(--muted)}
.qr{background:#fff;border-radius:16px;padding:14px;display:inline-block;border:1px solid var(--line)}
.qr svg,.qr img{width:240px;height:240px;display:block}
.copy{display:flex;gap:8px} .copy input{font-family:ui-monospace,Consolas,monospace;font-size:.8rem}
.steps{counter-reset:s;list-style:none;padding:0;margin:0;text-align:left}
.steps li{counter-increment:s;padding:6px 0 6px 36px;position:relative}
.steps li::before{content:counter(s);position:absolute;left:0;top:6px;width:24px;height:24px;border-radius:50%;background:var(--surface-2);font-size:.8rem;font-weight:700;display:grid;place-items:center}
.pulse{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--warn);animation:p 1.4s infinite}
@keyframes p{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--warn) 60%,transparent)}100%{box-shadow:0 0 0 12px transparent}}

/* player */
.player{display:grid;grid-template-columns:1fr 340px;gap:24px;padding:28px 0 60px}
@media (max-width:960px){.player{grid-template-columns:1fr}}
.video{aspect-ratio:16/9;background:#000;border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow)}
.video video,.video iframe{width:100%;height:100%;border:0;display:block}
.video.empty{display:grid;place-items:center;color:#aaa}
.lessons{padding:8px;max-height:calc(100vh - 140px);overflow:auto}
.lessons h4{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:14px 10px 6px}
.lessons a{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:10px;color:var(--ink);font-size:.93rem}
.lessons a:hover{background:var(--surface-2);text-decoration:none}
.lessons a.on{background:color-mix(in srgb,var(--accent) 13%,transparent);color:var(--accent);font-weight:650}
.progress{height:6px;border-radius:9px;background:var(--surface-2);overflow:hidden}
.progress span{display:block;height:100%;background:var(--accent)}

/* admin */
.admin{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
@media (max-width:860px){.admin{grid-template-columns:1fr}.side{position:static!important;height:auto!important}}
.side{background:var(--surface);border-right:1px solid var(--line);padding:20px 14px;position:sticky;top:0;height:100vh;overflow:auto}
.side .brand{padding:4px 10px 20px}
.side nav a{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:10px;color:var(--muted);font-weight:560;margin-bottom:2px}
.side nav a:hover{background:var(--surface-2);color:var(--ink);text-decoration:none}
.side nav a.on{background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent)}
.side nav .ico{width:20px;text-align:center}
.main{padding:28px clamp(16px,3vw,40px) 60px;min-width:0}
.page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:24px}
.page-head h1{font-size:1.75rem;margin:0}
.kpi .label{color:var(--muted);font-size:.85rem;font-weight:600}
.kpi .value{font-size:1.9rem;font-weight:800;letter-spacing:-.03em;margin-top:4px}
.chart{display:flex;align-items:flex-end;gap:4px;height:160px;padding-top:10px}
.chart .bar{flex:1;background:color-mix(in srgb,var(--accent) 75%,transparent);border-radius:5px 5px 2px 2px;min-height:2px;position:relative}
.chart .bar:hover{background:var(--accent)}
.chart .bar:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);font-size:.75rem;padding:4px 8px;border-radius:6px;white-space:nowrap;z-index:2}
table{width:100%;border-collapse:collapse;font-size:.92rem}
th{text-align:left;font-weight:650;color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;padding:10px 12px;border-bottom:1px solid var(--line)}
td{padding:12px;border-bottom:1px solid var(--line);vertical-align:middle}
tr:last-child td{border-bottom:0}
.table-wrap{overflow-x:auto;padding:4px 8px}
.empty-state{text-align:center;padding:48px 20px;color:var(--muted)}
.empty-state .big{font-size:2.4rem;margin-bottom:8px}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}
.tabs a{padding:7px 14px;border-radius:999px;background:var(--surface);border:1px solid var(--line);color:var(--muted);font-size:.88rem;font-weight:600}
.tabs a.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.tabs a:hover{text-decoration:none}
.lesson-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;margin-bottom:8px;background:var(--surface)}
fieldset{border:1px solid var(--line);border-radius:var(--radius);padding:22px;margin:0 0 20px;background:var(--surface)}
legend{font-weight:750;padding:0 8px;font-size:1.02rem}
.upload-bar{height:8px;background:var(--surface-2);border-radius:9px;overflow:hidden;margin-top:8px;display:none}
.upload-bar span{display:block;height:100%;width:0;background:var(--accent);transition:width .2s}
footer.foot{border-top:1px solid var(--line);padding:28px 0;color:var(--muted);font-size:.85rem;margin-top:40px}
footer.foot .wrap{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.auth{min-height:calc(100vh - 64px);display:grid;place-items:center;padding:40px 0}
.auth .card{width:100%}
`
