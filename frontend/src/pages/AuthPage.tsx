import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck, Webhook, Zap } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { humanize } from '../lib/format'
import type { BusinessType } from '../lib/types'
import { Button, Field, Input, Notice, Select, useToast } from '../components/ui'
import { Logo, useTheme } from '../components/Layout'

const businessTypes: BusinessType[] = ['PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'TRUST']

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { login } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  useTheme() // applies the persisted theme on the logged-out screens too

  const [form, setForm] = useState({ name: '', email: '', password: '', businessName: '', businessType: 'PRIVATE_LIMITED' as BusinessType })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  useEffect(() => setError(null), [mode])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const fieldError = (name: string) => error?.fieldErrors.find((f) => f.field === name)?.message

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      if (mode === 'signup') {
        await api.signup(form)
        toast('Account created. Signing you in…')
      }
      await login(form.email, form.password)
      nav('/')
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong'))
    } finally {
      setBusy(false)
    }
  }

  const perks = [
    { icon: ShieldCheck, t: 'Vault-grade card security', d: 'Per-card envelope encryption; CVV is never stored.' },
    { icon: Webhook, t: 'Reliable webhooks', d: 'HMAC-signed delivery with retries and a dead-letter queue.' },
    { icon: Zap, t: 'Idempotent by design', d: 'Safe retries on every write with an idempotency key.' },
  ]

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand p-12 text-brand-ink lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-black/10 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20"><Zap className="h-4 w-4" fill="currentColor" /></div>
          <span className="font-semibold">Razorpay Console</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">Accept payments.<br />Ship faster.</h2>
          <p className="mt-4 text-lg opacity-80">Create orders, take cards, UPI and netbanking, and watch settlements land — all from one console.</p>
          <ul className="mt-10 space-y-5">
            {perks.map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15"><Icon className="h-4 w-4" /></div>
                <div><p className="font-medium">{t}</p><p className="text-sm opacity-75">{d}</p></div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs opacity-60">Sandbox environment · simulated bank responses</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm animate-rise space-y-5">
          <div className="lg:hidden"><Logo /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
            <p className="mt-1 text-sm text-muted">
              {mode === 'login' ? 'Sign in to your merchant console.' : 'Start accepting test payments in minutes.'}
            </p>
          </div>

          {error && <Notice tone="bad">{error.message}</Notice>}

          {mode === 'signup' && (
            <>
              <Field label="Your name" error={fieldError('name')}>
                <Input required maxLength={50} value={form.name} onChange={set('name')} placeholder="Asha Verma" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Business name" error={fieldError('businessName')}>
                  <Input maxLength={50} value={form.businessName} onChange={set('businessName')} placeholder="Acme Pvt Ltd" />
                </Field>
                <Field label="Business type">
                  <Select value={form.businessType} onChange={set('businessType')}>
                    {businessTypes.map((b) => <option key={b} value={b}>{humanize(b)}</option>)}
                  </Select>
                </Field>
              </div>
            </>
          )}
          <Field label="Email" error={fieldError('email')}>
            <Input type="email" required autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@company.com" />
          </Field>
          <Field label="Password" error={fieldError('password')} hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
            <Input
              type="password" required minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password} onChange={set('password')}
            />
          </Field>

          <Button type="submit" loading={busy} className="w-full">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>

          <p className="text-center text-sm text-muted">
            {mode === 'login' ? <>New here? <Link className="font-medium text-brand hover:underline" to="/signup">Create an account</Link></>
              : <>Already registered? <Link className="font-medium text-brand hover:underline" to="/login">Sign in</Link></>}
          </p>
        </form>
      </div>
    </div>
  )
}
