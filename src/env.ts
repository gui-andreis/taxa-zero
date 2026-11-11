export type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  /** Código pedido para criar o primeiro administrador. */
  SETUP_CODE?: string
}

export type Admin = { id: number; email: string }
export type Student = { id: number; name: string; email: string }

export type Vars = {
  admin: Admin | null
  student: Student | null
  settings: Settings
}

export type AppEnv = { Bindings: Bindings; Variables: Vars }

export type Settings = Record<string, string>

export type OrderStatus =
  | 'pending' // aguardando pagamento
  | 'awaiting_confirmation' // comprador disse que pagou (Pix manual)
  | 'paid' // pago: acesso liberado
  | 'refund_requested' // pediu reembolso (Pix manual): acesso bloqueado até o vendedor devolver
  | 'refunded' // reembolsado: sem acesso
  | 'disputed' // contestação no cartão: sem acesso
  | 'cancelled' // cancelado/expirado

export type PaymentMethod = 'pix_manual' | 'mp_pix' | 'mp_card'

export type Course = {
  id: number
  slug: string
  title: string
  subtitle: string
  description: string
  bullets: string
  price_cents: number
  cover_key: string | null
  published: number
  created_at: number
}

export type Module = { id: number; course_id: number; title: string; position: number }

export type Lesson = {
  id: number
  module_id: number
  title: string
  description: string
  position: number
  video_type: 'none' | 'r2' | 'bunny' | 'embed'
  video_ref: string | null
  duration_text: string
}

export type Order = {
  id: string
  course_id: number
  student_id: number
  amount_cents: number
  method: PaymentMethod
  status: OrderStatus
  provider_payment_id: string | null
  pix_payload: string | null
  checkout_url: string | null
  created_at: number
  paid_at: number | null
  refunded_at: number | null
  note: string | null
}
