import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { AppLayout } from './layout/AppLayout'
import { NAV } from './layout/nav'
import { CohortIntakePage } from './pages/CohortIntakePage'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { DischargeQueuePage } from './pages/DischargeQueuePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ScorePatientPage } from './pages/ScorePatientPage'

function App() {
  return (
    <Routes>
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<CohortIntakePage />} />
        <Route path="/score" element={<ScorePatientPage />} />
        <Route path="/queue" element={<DischargeQueuePage />} />
        {NAV.slice(2).map((item) => (
          <Route key={item.to} path={item.to} element={<ComingSoonPage title={item.label} />} />
        ))}
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
