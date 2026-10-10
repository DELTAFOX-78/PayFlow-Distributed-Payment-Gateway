import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { formatDate } from '../lib/format'
import type { ApiKey, ApiKeyCreated, Environment } from '../lib/types'
import {
  Badge, Button, Card, CopyButton, Empty, Field, Modal, Notice, PageHeader, Select, Spinner, useToast,
} from '../components/ui'

export default function ApiKeys() {
  const toast = useToast()
  const [keys, setKeys] = useState<ApiKey[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [env, setEnv] = useState<Environment>('TEST')
  const [busy, setBusy] = useState(false)
  const [secret, setSecret] = useState<ApiKeyCreated | null>(null)

  const load = useCallback(() => {
    api.listKeys().then(setKeys).catch((e: ApiError) => { setKeys([]); toast(e.message, 'bad') })
  }, [toast])
  useEffect(load, [load])

  const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : 'Request failed', 'bad')

  async function create() {
    setBusy(true)
    try { setSecret(await api.createKey(env)); setCreating(false); load() } catch (e) { fail(e) } finally { setBusy(false) }
  }
  async function rotate(k: ApiKey) {
    if (!confirm(`Rotate ${k.keyId}? The old secret keeps working for a 24 hour grace period.`)) return
    try { setSecret(await api.rotateKey(k.id)); load() } catch (e) { fail(e) }
  }
  async function revoke(k: ApiKey) {
    if (!confirm(`Revoke ${k.keyId}? Requests using it will stop working immediately.`)) return
    try { await api.revokeKey(k.id); toast('Key revoked'); load() } catch (e) { fail(e) }
  }

  return (
    <>
      <PageHeader
        title="API keys"
        subtitle="Authenticate server-to-server requests with HTTP Basic auth (key ID : secret)."
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Generate key</Button>}
      />

      <Card>
        {keys === null ? <Spinner /> : keys.length === 0 ? (
          <Empty
            icon={<KeyRound className="h-5 w-5" />}
            title="No API keys yet"
            hint="Generate a test key to start calling the API from your backend."
            action={<Button size="sm" onClick={() => setCreating(true)}>Generate key</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-5 py-3 font-medium">Key ID</th>
                  <th className="px-3 py-3 font-medium">Mode</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Last used</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-raised/40">
                    <td className="px-5 py-3.5"><code className="font-mono text-[13px]">{k.keyId}</code> <CopyButton value={k.keyId} label="" /></td>
                    <td className="px-3 py-3.5"><Badge tone={k.environment === 'LIVE' ? 'brand' : 'neutral'}>{k.environment === 'LIVE' ? 'Live' : 'Test'}</Badge></td>
                    <td className="px-3 py-3.5"><Badge tone={k.enabled ? 'ok' : 'bad'}>{k.enabled ? 'Active' : 'Revoked'}</Badge></td>
                    <td className="px-3 py-3.5 text-muted">{k.lastUsedAt ? formatDate(k.lastUsedAt) : 'Never'}</td>
                    <td className="px-3 py-3.5 text-muted">{formatDate(k.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => rotate(k)} disabled={!k.enabled}><RefreshCw className="h-3.5 w-3.5" /> Rotate</Button>
                        <Button size="sm" variant="danger" onClick={() => revoke(k)} disabled={!k.enabled}><Trash2 className="h-3.5 w-3.5" /> Revoke</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="Generate API key">
        <div className="space-y-4">
          <Field label="Environment" hint="Test keys never move real money.">
            <Select value={env} onChange={(e) => setEnv(e.target.value as Environment)}>
              <option value="TEST">Test</option>
              <option value="LIVE">Live</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={create} loading={busy}>Generate</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!secret} onClose={() => setSecret(null)} title="Save your key secret">
        {secret && (
          <div className="space-y-4">
            <Notice tone="warn">This secret is shown only once. Store it somewhere safe — we can't show it again.</Notice>
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Key ID</p>
              <div className="flex items-center justify-between rounded-lg bg-raised px-3 py-2">
                <code className="break-all font-mono text-[13px]">{secret.keyId}</code><CopyButton value={secret.keyId} />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Key secret</p>
              <div className="flex items-center justify-between rounded-lg bg-raised px-3 py-2">
                <code className="break-all font-mono text-[13px]">{secret.keySecret}</code><CopyButton value={secret.keySecret} />
              </div>
            </div>
            <div className="flex justify-end"><Button onClick={() => setSecret(null)}>I've saved it</Button></div>
          </div>
        )}
      </Modal>
    </>
  )
}
