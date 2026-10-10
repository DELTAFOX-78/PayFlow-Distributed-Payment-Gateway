import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './lib/auth'
import AuthPage from './pages/AuthPage'
import Overview from './pages/Overview'
import Payments from './pages/Payments'
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'
import Settlements from './pages/Settlements'
import ApiKeys from './pages/ApiKeys'
import Webhooks from './pages/Webhooks'
import Account from './pages/Account'

export default function App() {
  const { token } = useAuth()

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="payments" element={<Payments />} />
        <Route path="payments/new" element={<Checkout />} />
        <Route path="orders" element={<Orders />} />
        <Route path="settlements" element={<Settlements />} />
        <Route path="api-keys" element={<ApiKeys />} />
        <Route path="webhooks" element={<Webhooks />} />
        <Route path="account" element={<Account />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
