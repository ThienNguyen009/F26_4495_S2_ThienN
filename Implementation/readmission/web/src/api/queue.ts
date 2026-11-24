import { post, request } from './client'
import type { PatientFeatures, Tier } from './scoring'

export type Decision = {
  decision: 'accepted' | 'overridden'
  action: string
  reason: string | null
  by: string | null
  at: string
}

// mirrors GET /queue in api/queue.py
export type QueuePatient = {
  encounter_id: string // ENC-… for demo patients; the saved encounter ref or REC-… for saved records
  source: 'demo' | 'saved'
  record_id: number | null
  patient_name: string | null
  age_band: string
  diag_1_group: string
  time_in_hospital: number
  number_inpatient: number
  num_medications: number
  disposition_group: string
  probability: number
  tier: Tier
  action: string
  decision: Decision | null
}

export type Queue = {
  patients: QueuePatient[]
  counts: Record<Tier, number>
  expected_readmissions: number
  high_threshold: number
  medium_threshold: number
  actions: Record<Tier, string>
}

// mirrors GET /queue/{encounter_id}
export type PatientDetail = {
  encounter_id: string
  patient_name: string | null // null when the source is de-identified
  record: PatientFeatures
  probability: number
  tier: Tier
  high_threshold: number
  medium_threshold: number
  base_rate: number
  contributions: { feature: string; value: number }[]
  action: string
  actions: Record<Tier, string>
  decision: Decision | null
}

export type DecisionIn = { decision: Decision['decision']; action: string; reason?: string }

export const getQueue = () => request<Queue>('/queue')
export const getPatient = (encounterId: string) => request<PatientDetail>(`/queue/${encodeURIComponent(encounterId)}`)
export const saveDecision = (encounterId: string, body: DecisionIn) =>
  post<Decision>(`/queue/${encodeURIComponent(encounterId)}/decision`, body)
