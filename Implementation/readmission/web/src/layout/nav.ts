// Console tabs, in header order. `also` lists sub-pages that keep the tab highlighted.
export const NAV: { to: string; label: string; also?: string[] }[] = [
  { to: '/', label: 'Cohort intake', also: ['/score'] },
  { to: '/queue', label: 'Discharge queue' },
  { to: '/patient', label: 'Patient' },
  { to: '/model', label: 'Model & fairness' },
  { to: '/threshold', label: 'Threshold & cost' },
]
