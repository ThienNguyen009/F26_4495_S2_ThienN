import { post } from './client'

// Clinical fields only — mirrors PatientIn in api/scoring.py.
export type PatientFeatures = {
  age_band: string
  gender: string
  admission_type: string
  time_in_hospital: number
  disposition_group: string
  number_inpatient: number
  number_emergency: number
  number_outpatient: number
  diag_1_group: string
  diag_2_group: string
  number_diagnoses: number
  num_lab_procedures: number
  num_procedures: number
  num_medications: number
  A1Cresult: string
  change: string
}

export type Tier = 'low' | 'medium' | 'high'

export type Prediction = {
  probability: number
  tier: Tier
  threshold: number
  base_rate: number
  contributions: { feature: string; value: number }[]
  action: string
  placeholder: boolean
}

export const predict = (features: PatientFeatures) => post<Prediction>('/predict', features)
