// Console tabs, in header order. `also` lists sub-pages that keep the tab highlighted;
// an entry ending in '/' matches every path under it.
export const NAV: { to: string; label: string; also?: string[] }[] = [
  { to: '/', label: 'Cohort intake', also: ['/score'] },
  { to: '/queue', label: 'Discharge queue' },
  { to: '/patients', label: 'Patients', also: ['/patient/'] },
  { to: '/model', label: 'Model & fairness' },
  { to: '/threshold', label: 'Threshold & cost' },
]
