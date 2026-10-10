import { useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, Building2, Landmark, ShieldCheck } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { humanize } from '../lib/format'
import type { BusinessType, MerchantProfile } from '../lib/types'
import {
  Badge, Button, Card, CardHeader, Field, Input, Notice, PageHeader, Select, Spinner, StatusBadge, useToast,
} from '../components/ui'

const BUSINESS_TYPES: BusinessType[] = ['PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'TRUST']

function errorText(e: unknown) {
  if (!(e instanceof ApiError)) return 'Something went wrong'
  const fields = e.fieldErrors.map((f) => f.message).join('. ')
  return fields ? `${e.message}: ${fields}` : e.message
}

export default function Account() {
  const toast = useToast()
  const [profile, setProfile] = useState<MerchantProfile | null>(null)

  useEffect(() => { api.me().then(setProfile).catch((e: ApiError) => toast(e.message, 'bad')) }, [toast])

  if (!profile) return <Spinner />

  return (
    <>
      <PageHeader title="Account" subtitle="Business profile, settlement account and verification." />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <ProfileForm profile={profile} onSaved={setProfile} />
          <SettlementAccountForm profile={profile} onSaved={setProfile} />
        </div>
        <div className="lg:col-span-2">
          <KycCard profile={profile} onSaved={setProfile} />
        </div>
      </div>
    </>
  )
}

function ProfileForm({ profile, onSaved }: { profile: MerchantProfile; onSaved: (p: MerchantProfile) => void }) {
  const toast = useToast()
  const [form, setForm] = useState({
    name: profile.name,
    businessName: profile.businessName ?? '',
    businessType: profile.businessType ?? ('PRIVATE_LIMITED' as BusinessType),
    contactNumber: profile.contactNumber ?? '',
    websiteUrl: profile.websiteUrl ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try { onSaved(await api.updateMe(form)); toast('Profile saved') }
    catch (err) { toast(errorText(err), 'bad') }
    finally { setBusy(false) }
  }

  return (
    <Card>
      <CardHeader title="Business profile" hint={profile.email} />
      <form onSubmit={save} className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name"><Input required minLength={2} maxLength={50} value={form.name} onChange={set('name')} /></Field>
          <Field label="Contact number"><Input maxLength={20} value={form.contactNumber} onChange={set('contactNumber')} placeholder="+91…" /></Field>
          <Field label="Business name"><Input maxLength={50} value={form.businessName} onChange={set('businessName')} /></Field>
          <Field label="Business type">
            <Select value={form.businessType} onChange={set('businessType')}>
              {BUSINESS_TYPES.map((b) => <option key={b} value={b}>{humanize(b)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Website"><Input type="url" maxLength={200} value={form.websiteUrl} onChange={set('websiteUrl')} placeholder="https://" /></Field>
        <div className="flex justify-end"><Button type="submit" loading={busy}><Building2 className="h-4 w-4" /> Save profile</Button></div>
      </form>
    </Card>
  )
}

function SettlementAccountForm({ profile, onSaved }: { profile: MerchantProfile; onSaved: (p: MerchantProfile) => void }) {
  const toast = useToast()
  const [form, setForm] = useState({
    accountNumber: '',
    ifsc: profile.settlementAccount?.ifsc ?? '',
    accountHolderName: profile.settlementAccount?.accountHolderName ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      onSaved(await api.saveSettlementAccount({ ...form, ifsc: form.ifsc.toUpperCase() }))
      setForm((f) => ({ ...f, accountNumber: '' }))
      toast('Settlement account saved')
    } catch (err) { toast(errorText(err), 'bad') }
    finally { setBusy(false) }
  }

  return (
    <Card>
      <CardHeader
        title="Settlement account"
        hint="Payouts are sent here."
        action={profile.settlementAccountConfigured ? <Badge tone="ok">Configured</Badge> : <Badge tone="warn">Required</Badge>}
      />
      <form onSubmit={save} className="space-y-4 p-5">
        {profile.settlementAccount && (
          <p className="rounded-lg bg-raised px-3 py-2 text-sm">
            Current account <span className="font-mono">{profile.settlementAccount.maskedAccountNumber}</span>
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account number" hint="9 to 18 digits">
            <Input required inputMode="numeric" className="font-mono" value={form.accountNumber} onChange={set('accountNumber')}
              placeholder={profile.settlementAccount ? 'Enter to replace' : ''} />
          </Field>
          <Field label="IFSC" hint="e.g. HDFC0001234">
            <Input required className="font-mono uppercase" maxLength={11} value={form.ifsc} onChange={set('ifsc')} />
          </Field>
        </div>
        <Field label="Account holder name">
          <Input required minLength={3} maxLength={200} value={form.accountHolderName} onChange={set('accountHolderName')} />
        </Field>
        <div className="flex justify-end"><Button type="submit" loading={busy}><Landmark className="h-4 w-4" /> Save account</Button></div>
      </form>
    </Card>
  )
}

function KycCard({ profile, onSaved }: { profile: MerchantProfile; onSaved: (p: MerchantProfile) => void }) {
  const toast = useToast()
  const [panId, setPanId] = useState(profile.panId ?? '')
  const [gstId, setGstId] = useState(profile.gstId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try { onSaved(await api.submitKyc({ panId: panId.toUpperCase(), gstId: gstId.toUpperCase() || undefined })); toast('KYC complete: your account is active') }
    catch (err) { setError(errorText(err)) }
    finally { setBusy(false) }
  }

  const active = profile.merchantStatus === 'ACTIVE'

  return (
    <Card className="self-start">
      <CardHeader title="Verification (KYC)" action={<StatusBadge status={profile.merchantStatus} />} />
      <div className="space-y-4 p-5">
        {active ? (
          <div className="flex gap-3 rounded-xl bg-ok/10 p-4 text-sm">
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-ok" />
            <div>
              <p className="font-medium">Your account is verified and active.</p>
              <p className="text-muted">PAN {profile.panId}{profile.gstId ? ` · GSTIN ${profile.gstId}` : ''}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Notice tone="brand">
              <span className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Sandbox verification: any well-formed PAN is approved instantly.</span>
            </Notice>
            {!profile.settlementAccountConfigured && (
              <Notice tone="warn">Add a settlement account first. KYC cannot be completed without one.</Notice>
            )}
            <Field label="PAN" hint="e.g. ABCDE1234F">
              <Input required className="font-mono uppercase" maxLength={10} value={panId} onChange={(e) => setPanId(e.target.value)} />
            </Field>
            <Field label="GSTIN (optional)" hint="15 characters">
              <Input className="font-mono uppercase" maxLength={15} value={gstId} onChange={(e) => setGstId(e.target.value)} />
            </Field>
            {error && <Notice tone="bad">{error}</Notice>}
            <Button type="submit" loading={busy} disabled={!profile.settlementAccountConfigured} className="w-full">
              Submit for verification
            </Button>
          </form>
        )}
      </div>
    </Card>
  )
}
