import { CSS } from './styles'
import { CLIENT_JS } from './client'

/** Versão dos arquivos: muda sempre que o CSS ou o JS mudam, para o navegador não usar a cópia antiga. */
function hash(s: string) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
export const ASSET_VERSION = hash(CSS + CLIENT_JS)
