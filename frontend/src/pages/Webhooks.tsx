import { useState } from 'react'
import { Tabs } from '../components/ui'
import WebhookEndpoints from './WebhookEndpoints'
import WebhookDeliveries from './WebhookDeliveries'

type Tab = 'endpoints' | 'deliveries'

export default function Webhooks() {
  const [tab, setTab] = useState<Tab>('endpoints')
  return (
    <>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[{ id: 'endpoints', label: 'Endpoints' }, { id: 'deliveries', label: 'Deliveries' }]}
      />
      {tab === 'endpoints' ? <WebhookEndpoints /> : <WebhookDeliveries />}
    </>
  )
}
