import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { AppLayout } from './layout/AppLayout'
import { NAV } from './layout/nav'
import { CohortIntakePage } from './pages/CohortIntakePage'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { DischargeQueuePage } from './pages/DischargeQueuePage'
import { LoginPage } from './pages/LoginPage'
import { PatientPage } from './pages/PatientPage'
import { PatientsPage } from './pages/PatientsPage'
import { RegisterPage } from './pages/RegisterPage'
import { ScorePatientPage } from './pages/ScorePatientPage'
import { ThresholdCostPage } from './pages/ThresholdCostPage'

// Built pages by path. Tabs in NAV that aren't listed here show ComingSoonPage.
const PAGES: Record<string, ReactNode> = {
  '/': <CohortIntakePage />,
  '/score': <ScorePatientPage />,
  '/queue': <DischargeQueuePage />,
  '/threshold': <ThresholdCostPage />,
  '/patients': <PatientsPage />,
  '/patient': <Navigate to="/patients" replace />,
  '/patient/:encounterId': <PatientPage />,
  '/patient/record/:recordId': <PatientPage />,
}

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
        {Object.entries(PAGES).map(([path, element]) => (
          <Route key={path} path={path} element={element} />
        ))}
        {/* any tab without a built page yet gets a placeholder, wherever it sits in NAV */}
        {NAV.filter((item) => !(item.to in PAGES)).map((item) => (
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
