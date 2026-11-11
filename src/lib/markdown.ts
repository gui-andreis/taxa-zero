/**
 * Markdown bem simples e SEGURO (escapa todo HTML antes).
 * Suporta: ## títulos, **negrito**, *itálico*, [links](https://...), listas com "- " e parágrafos.
 */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener nofollow">$1</a>')
}

export function markdown(src: string): string {
  const lines = escapeHtml(src.replace(/\r\n/g, '\n')).split('\n')
  const out: string[] = []
  let para: string[] = []
  let list: string[] = []
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join('<br>'))}</p>`)
    para = []
  }
  const flushList = () => {
    if (list.length) out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`)
    list = []
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      flushPara()
      flushList()
      const level = Math.min(h[1].length + 1, 4)
      out.push(`<h${level}>${inline(h[2])}</h${level}>`)
    } else if (/^[-*]\s+/.test(line)) {
      flushPara()
      list.push(line.replace(/^[-*]\s+/, ''))
    } else if (!line.trim()) {
      flushPara()
      flushList()
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()
  return out.join('\n')
}
