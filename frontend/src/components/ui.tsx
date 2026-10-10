import {
  createContext, useCallback, useContext, useEffect, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
} from 'react'
import { AlertCircle, Check, Copy, Loader2, X } from 'lucide-react'
import type { Tone } from '../lib/format'

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------- Button ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
}
export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }: BtnProps) {
  const styles = {
    primary: 'bg-brand text-brand-ink hover:opacity-90 shadow-sm',
    secondary: 'bg-surface text-ink border border-line hover:bg-raised',
    ghost: 'text-muted hover:text-ink hover:bg-raised',
    danger: 'bg-bad/10 text-bad hover:bg-bad/20',
  }[variant]
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        styles, className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

/* ---------- Card ---------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line bg-surface shadow-card', className)}>{children}</div>
}
export function CardHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

/* ---------- Form fields ---------- */
const field =
  'w-full rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-muted/60 ' +
  'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60'

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-bad">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(field, 'h-10', props.className)} />
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(field, 'h-10', props.className)} />
}

/* ---------- Badge ---------- */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const t = {
    ok: 'bg-ok/10 text-ok', warn: 'bg-warn/15 text-warn', bad: 'bg-bad/10 text-bad',
    brand: 'bg-brand-soft text-brand', neutral: 'bg-raised text-muted',
  }[tone]
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', t)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

/* ---------- Misc ---------- */
export function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'bad' | 'brand'; children: ReactNode }) {
  const t = { warn: 'bg-warn/10 text-warn', bad: 'bg-bad/10 text-bad', brand: 'bg-brand-soft text-brand' }[tone]
  return (
    <div className={cx('flex gap-2.5 rounded-xl px-3.5 py-3 text-sm', t)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="text-ink/80">{children}</div>
    </div>
  )
}

export function Empty({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">{icon}</div>
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Spinner() {
  return <div className="flex justify-center py-14"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1400) })
      }}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-raised hover:text-ink"
    >
      {done ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
      {label ?? (done ? 'Copied' : 'Copy')}
    </button>
  )
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md animate-rise rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-raised hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/* ---------- Toasts ---------- */
interface Toast { id: number; msg: string; tone: 'ok' | 'bad' }
const ToastCtx = createContext<(msg: string, tone?: 'ok' | 'bad') => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((msg: string, tone: 'ok' | 'bad' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex animate-rise items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-card">
            {t.tone === 'ok'
              ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
              : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
