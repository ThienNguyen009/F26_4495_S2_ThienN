import { request } from './client'

// mirrors api/threshold_curve.json (served by GET /threshold)
export type CurvePoint = { threshold: number; flagged: number; recall: number; precision: number }

export type ThresholdCurve = {
  split: string
  n: number
  base_rate: number
  pr_auc: number
  high_threshold: number
  medium_threshold: number
  points: CurvePoint[] // ascending threshold
}

export const getThresholdCurve = () => request<ThresholdCurve>('/threshold')
