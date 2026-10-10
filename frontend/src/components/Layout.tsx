import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Banknote, CreditCard, KeyRound, LayoutDashboard, LogOut, Menu, Moon, Receipt, Sun, UserCog, Webhook, X, Zap,
} from 'lucide-react'
import { useAuth } from '../lib/auth'

const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/orders', label: 'Orders', icon: Receipt },
  { to: '/settlements', label: 'Settlements', icon: Banknote },
  { to: '/api-keys', label: 'API keys', icon: KeyRound },
  { to: '/webhooks', label: 'Webhooks', icon: Webhook },
  { to: '/account', label: 'Account', icon: UserCog },
]

export function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('rzp.theme')
      if (saved) return saved === 'dark'
    } catch { /* ignore */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('rzp.theme', dark ? 'dark' : 'light') } catch { /* ignore */ }
  }, [dark])
  return [dark, () => setDark((d) => !d)] as const
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-ink">
        <Zap className="h-4 w-4" fill="currentColor" />
      </div>
      <span className="text-[15px] font-semibold tracking-tight">Razorpay <span className="text-muted font-normal">Console</span></span>
    </div>
  )
}

export default function Layout() {
  const { logout, merchantId, role } = useAuth()
  const [dark, toggle] = useTheme()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5"><Logo /></div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to} to={to} end={end}
            className={({ isActive }) =>
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ' +
              (isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-raised hover:text-ink')
            }
          >
            <Icon className="h-4 w-4" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 space-y-2 rounded-xl border border-line bg-raised/60 p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
            {(role ?? 'M').slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium">{role ?? 'Merchant'}</p>
            <p className="truncate font-mono text-[11px] text-muted">{merchantId?.slice(0, 13) ?? 'signed in'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={toggle} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-xs text-muted hover:text-ink">
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} {dark ? 'Light' : 'Dark'}
          </button>
          <button onClick={logout} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-xs text-muted hover:text-bad">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-surface/80 backdrop-blur lg:block">
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-64 animate-rise bg-surface">{sidebar}</aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/80 px-4 py-3 backdrop-blur lg:hidden">
          <Logo />
          <button onClick={() => setOpen((o) => !o)} className="rounded-md p-1.5 text-muted hover:bg-raised" aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
        <main className="mx-auto w-full max-w-6xl animate-fade px-4 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
