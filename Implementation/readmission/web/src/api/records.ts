import { post, request } from './client'
import type { Decision, DecisionIn, PatientDetail } from './queue'
import type { PatientFeatures, Tier } from './scoring'

// mirrors RecordIn / Identity in api/records.py
export type RecordIdentity = {
  patient_name?: string
  mrn?: string
  encounter_ref?: string
  unit_bed?: string
  race?: string
  scored_by?: string
}

export type SavedRecord = { id: number; created_at: string; probability: number; tier: Tier; in_queue: boolean }

// 1 = readmitted within 30 days, 0 = not, null = not known yet
export type Outcome = 0 | 1 | null

export type RecordSummary = {
  id: number
  created_at: string
  patient_name: string | null
  mrn: string | null
  encounter_ref: string | null
  unit_bed: string | null
  scored_by: string | null
  saved_by: string | null
  age_band: string
  diag_1_group: string
  probability: number
  tier: Tier
  outcome: Outcome
  in_queue: boolean
}

export type RecordDetail = PatientDetail &
  RecordSummary & { record_id: number; saved_probability: number; saved_tier: Tier }

export const addRecord = (identity: RecordIdentity, features: PatientFeatures, addToQueue = false) =>
  post<SavedRecord>('/records', { identity, features, add_to_queue: addToQueue })
export const setQueued = (id: number, inQueue: boolean) =>
  request<{ id: number; in_queue: boolean }>(`/records/${id}/queue`, {
    method: 'PUT',
    body: JSON.stringify({ in_queue: inQueue }),
  })
export const saveRecordDecision = (id: number, body: DecisionIn) => post<Decision>(`/records/${id}/decision`, body)
export const deleteRecord = (id: number) => request<void>(`/records/${id}`, { method: 'DELETE' })
export const listRecords = () => request<RecordSummary[]>('/records')
export const getRecord = (id: number | string) => request<RecordDetail>(`/records/${id}`)
export const setOutcome = (id: number, outcome: Outcome) =>
  request<{ id: number; outcome: Outcome }>(`/records/${id}/outcome`, {
    method: 'PUT',
    body: JSON.stringify({ outcome }),
  })
