import { request } from './client'
import type { Tier } from './scoring'

// mirrors GET /queue in api/queue.py
export type QueuePatient = {
  encounter_id: string
  age_band: string
  diag_1_group: string
  time_in_hospital: number
  number_inpatient: number
  num_medications: number
  disposition_group: string
  probability: number
  tier: Tier
  action: string
}

export type Queue = {
  patients: QueuePatient[]
  counts: Record<Tier, number>
  expected_readmissions: number
  high_threshold: number
  medium_threshold: number
  actions: Record<Tier, string>
}

export const getQueue = () => request<Queue>('/queue')
