import { Alert, Group, Loader, NumberInput, SimpleGrid, Slider, Stack, Table, Text, Title } from '@mantine/core'
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { getThresholdCurve, type CurvePoint, type ThresholdCurve } from '../api/threshold'
import classes from './ThresholdCostPage.module.css'

// Example assumptions, not cited figures; staff replace them with their own.
const DEFAULT_COSTS = { readmission: 15000, intervention: 300, prevented: 25 }
type Costs = typeof DEFAULT_COSTS

// table rows: thresholds that flag roughly these shares of discharges
const CANDIDATE_SHARES = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.6]

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (x: number) => `${Math.round(x * 100)}%`
const per100 = (x: number) => (x * 100).toFixed(1)

const closest = (pts: CurvePoint[], key: keyof CurvePoint, target: number) =>
  pts.reduce((best, p) => (Math.abs(p[key] - target) < Math.abs(best[key] - target) ? p : best))

// all figures per 100 discharges
function economics(p: CurvePoint, baseRate: number, c: Costs) {
  const flagged = p.flagged * 100
  const caught = p.recall * baseRate * 100
  const interventionCost = flagged * c.intervention
  const avoided = caught * (c.prevented / 100) * c.readmission
  return { flagged, caught, interventionCost, avoided, net: avoided - interventionCost }
}

export function ThresholdCostPage() {
  const [curve, setCurve] = useState<ThresholdCurve | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CurvePoint | null>(null)
  const [costs, setCosts] = useState<Costs>(DEFAULT_COSTS)

  useEffect(() => {
    getThresholdCurve().then(
      (c) => {
        setCurve(c)
        setSelected(closest(c.points, 'threshold', c.high_threshold))
      },
      (e: Error) => setError(e.message),
    )
  }, [])

  const best = useMemo(() => {
    if (!curve) return null
    return curve.points.reduce((a, b) =>
      economics(b, curve.base_rate, costs).net > economics(a, curve.base_rate, costs).net ? b : a,
    )
  }, [curve, costs])

  const candidates = useMemo(() => {
    if (!curve || !selected || !best) return []
    const rows = new Map<number, CurvePoint>()
    for (const s of CANDIDATE_SHARES) {
      const p = closest(curve.points, 'flagged', s)
      rows.set(p.threshold, p)
    }
    rows.set(selected.threshold, selected)
    rows.set(best.threshold, best)
    return [...rows.values()].sort((a, b) => b.threshold - a.threshold)
  }, [curve, selected, best])

  if (error)
    return (
      <Alert variant="light" color="red" title="Could not load the threshold curve">
        {error}
      </Alert>
    )
  if (!curve || !selected || !best)
    return (
      <Group justify="center" p="xl">
        <Loader size="sm" color="brand" />
      </Group>
    )

  const sel = economics(selected, curve.base_rate, costs)
  const selIndex = curve.points.indexOf(selected)
  const highTier = closest(curve.points, 'threshold', curve.high_threshold)
  const mediumTier = closest(curve.points, 'threshold', curve.medium_threshold)
  const maxNet = Math.max(...candidates.map((p) => Math.abs(economics(p, curve.base_rate, costs).net)), 1)

  return (
    <Stack gap="lg">
      <div>
        <Title order={1} fz={30} fw={800} lts={-0.5}>
          Where to set the alert threshold
        </Title>
        <Text size="sm" c="gray.7" mt={4} maw={900}>
          Lower the threshold and you catch more at-risk patients, but you spend follow-up capacity on people who were
          never going to come back. This page shows that trade-off on the validation set (
          {curve.n.toLocaleString()} patients the model was not trained on) so the threshold is picked on evidence.
        </Text>
      </div>

      <div className={classes.layout}>
        <div className={classes.card}>
          <Text fw={700}>Precision–recall curve</Text>
          <Text size="sm" c="gray.7">
            XGBoost on the form fields · PR-AUC {curve.pr_auc.toFixed(2)}. Hover to read a point, click to select it.
          </Text>
          <PrCurve curve={curve} selected={selected} onSelect={setSelected} />
        </div>

        <Stack gap="md">
          <div className={classes.card}>
            <Text size="xs" fw={600} tt="uppercase" lts={0.6} c="gray.7">
              Selected operating point
            </Text>
            <div className={classes.hero}>{selected.threshold.toFixed(3)}</div>
            <Slider
              min={0}
              max={curve.points.length - 1}
              value={selIndex}
              onChange={(i) => setSelected(curve.points[i])}
              label={(i) => curve.points[i].threshold.toFixed(3)}
              color="brand"
              size="sm"
              mb="md"
              aria-label="Alert threshold"
            />
            <Text size="sm" c="gray.8">
              Flags {Math.round(sel.flagged)} of every 100 discharges. Catches {pct(selected.recall)} of the patients
              who will return ({sel.caught.toFixed(1)} per 100), while about{' '}
              {Math.round(sel.flagged * (1 - selected.precision))} of those flagged would not have come back.
            </Text>
            <SimpleGrid cols={3} mt="md" pt="md" className={classes.statRow}>
              <Stat label="Recall" value={selected.recall.toFixed(2)} />
              <Stat label="Precision" value={selected.precision.toFixed(2)} />
              <Stat label="Flagged" value={pct(selected.flagged)} />
            </SimpleGrid>
          </div>

          <div className={classes.note}>
            <Text size="sm" fw={700} mb={4}>
              Cost assumptions
            </Text>
            <Text size="xs" c="gray.7" mb="sm">
              Example values, not cited figures. Replace them with your hospital’s numbers. The curve doesn’t depend on
              them, but the best threshold does.
            </Text>
            <Stack gap="xs">
              <NumberInput
                label="Cost of one readmission"
                prefix="$"
                thousandSeparator=","
                min={0}
                value={costs.readmission}
                onChange={(v) => setCosts({ ...costs, readmission: Number(v) || 0 })}
                size="xs"
              />
              <NumberInput
                label="Cost of one follow-up intervention"
                prefix="$"
                thousandSeparator=","
                min={0}
                value={costs.intervention}
                onChange={(v) => setCosts({ ...costs, intervention: Number(v) || 0 })}
                size="xs"
              />
              <NumberInput
                label="Readmissions prevented by follow-up"
                suffix="%"
                min={0}
                max={100}
                value={costs.prevented}
                onChange={(v) => setCosts({ ...costs, prevented: Number(v) || 0 })}
                size="xs"
              />
            </Stack>
          </div>
        </Stack>
      </div>

      <div className={classes.card}>
        <Text fw={700}>Candidate thresholds</Text>
        <Text size="sm" c="gray.7">
          Per 100 discharges, under the cost assumptions above. Best under these costs: threshold{' '}
          {best.threshold.toFixed(3)} ({money.format(economics(best, curve.base_rate, costs).net)} net per 100). Click
          a row to select it.
        </Text>
        <Table.ScrollContainer minWidth={900} mt="sm">
          <Table verticalSpacing="sm" horizontalSpacing="md" className={classes.table}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Threshold</Table.Th>
                <Table.Th ta="right">Flagged</Table.Th>
                <Table.Th ta="right">Recall</Table.Th>
                <Table.Th ta="right">Precision</Table.Th>
                <Table.Th ta="right">Readmissions caught</Table.Th>
                <Table.Th ta="right">Intervention cost</Table.Th>
                <Table.Th ta="right">Avoided cost</Table.Th>
                <Table.Th>Net benefit</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {candidates.map((p) => {
                const e = economics(p, curve.base_rate, costs)
                const tags = [
                  p === highTier && 'High tier',
                  p === mediumTier && 'Medium tier',
                  p === best && 'Best',
                ].filter(Boolean)
                return (
                  <Table.Tr
                    key={p.threshold}
                    className={classes.row}
                    data-selected={p === selected || undefined}
                    onClick={() => setSelected(p)}
                  >
                    <Table.Td>
                      <Group gap={8} wrap="nowrap">
                        <span className={classes.mono}>{p.threshold.toFixed(3)}</span>
                        {tags.map((t) => (
                          <span key={String(t)} className={classes.tag}>
                            {t}
                          </span>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">{Math.round(e.flagged)}</Table.Td>
                    <Table.Td ta="right">{p.recall.toFixed(2)}</Table.Td>
                    <Table.Td ta="right">{p.precision.toFixed(2)}</Table.Td>
                    <Table.Td ta="right">{per100(p.recall * curve.base_rate)}</Table.Td>
                    <Table.Td ta="right">{money.format(e.interventionCost)}</Table.Td>
                    <Table.Td ta="right">{money.format(e.avoided)}</Table.Td>
                    <Table.Td>
                      <Group gap={10} wrap="nowrap">
                        <span className={classes.netBar}>
                          <span
                            data-negative={e.net < 0 || undefined}
                            style={{ width: `${(Math.abs(e.net) / maxNet) * 100}%` }}
                          />
                        </span>
                        <span>{money.format(e.net)}</span>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Text size="xs" c="gray.6" mt="sm">
          Net benefit = readmissions caught × share prevented × cost of a readmission − patients flagged × cost of a
          follow-up. Base rate on the validation set is {pct(curve.base_rate)}. The high and medium tiers in the
          Discharge queue use thresholds {curve.high_threshold.toFixed(3)} and {curve.medium_threshold.toFixed(3)}.
        </Text>
      </div>
    </Stack>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="xs" c="gray.7">
        {label}
      </Text>
      <Text fw={800} fz={20}>
        {value}
      </Text>
    </div>
  )
}

// ---- chart -------------------------------------------------------------------------------

const W = 640
const H = 340
const M = { l: 52, r: 20, t: 16, b: 44 }

function PrCurve({
  curve,
  selected,
  onSelect,
}: {
  curve: ThresholdCurve
  selected: CurvePoint
  onSelect: (p: CurvePoint) => void
}) {
  const [hover, setHover] = useState<CurvePoint | null>(null)
  const pts = curve.points
  const yMax = Math.ceil(Math.max(...pts.map((p) => p.precision)) * 10) / 10
  const x = (r: number) => M.l + r * (W - M.l - M.r)
  const y = (p: number) => H - M.b - (p / yMax) * (H - M.t - M.b)
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.recall).toFixed(1)},${y(p.precision).toFixed(1)}`).join('')
  const yTicks = Array.from({ length: Math.round(yMax * 10) + 1 }, (_, i) => i / 10)

  function pointAt(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const recall = (((e.clientX - rect.left) / rect.width) * W - M.l) / (W - M.l - M.r)
    return closest(pts, 'recall', recall)
  }

  const show = hover
  return (
    <div className={classes.chart}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Precision against recall on the validation set. Selected threshold ${selected.threshold.toFixed(3)}: recall ${selected.recall.toFixed(2)}, precision ${selected.precision.toFixed(2)}.`}
        onMouseMove={(e) => setHover(pointAt(e))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => onSelect(pointAt(e))}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className={classes.grid} />
            <text x={M.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className={classes.tick}>
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
          <text key={t} x={x(t)} y={H - M.b + 18} textAnchor="middle" className={classes.tick}>
            {t.toFixed(1)}
          </text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" className={classes.axisLabel}>
          Recall: share of readmissions caught
        </text>
        <text transform={`translate(14 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" className={classes.axisLabel}>
          Precision
        </text>

        {/* flagging at random gives precision = base rate at every recall */}
        <line x1={x(0)} x2={x(1)} y1={y(curve.base_rate)} y2={y(curve.base_rate)} className={classes.baseline} />
        <text x={x(1)} y={y(curve.base_rate) - 6} textAnchor="end" className={classes.tick}>
          Random ranking ({curve.base_rate.toFixed(2)})
        </text>

        <path d={path} className={classes.line} />

        <line x1={x(selected.recall)} x2={x(selected.recall)} y1={M.t} y2={H - M.b} className={classes.selLine} />
        <circle cx={x(selected.recall)} cy={y(selected.precision)} r={6} className={classes.selDot} />
        <text
          x={x(selected.recall) + (selected.recall > 0.75 ? -10 : 10)}
          y={M.t + 12}
          textAnchor={selected.recall > 0.75 ? 'end' : 'start'}
          className={classes.selLabel}
        >
          {selected.threshold.toFixed(3)} threshold
        </text>

        {show && (
          <>
            <line x1={x(show.recall)} x2={x(show.recall)} y1={M.t} y2={H - M.b} className={classes.crosshair} />
            <circle cx={x(show.recall)} cy={y(show.precision)} r={4.5} className={classes.hoverDot} />
          </>
        )}
      </svg>
      {show && (
        <div
          className={classes.tooltip}
          style={{
            left: `${(x(show.recall) / W) * 100}%`,
            top: `${(y(show.precision) / H) * 100}%`,
            transform: `translate(${show.recall > 0.6 ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
          }}
        >
          <strong>Threshold {show.threshold.toFixed(3)}</strong>
          <span>Recall {show.recall.toFixed(2)}</span>
          <span>Precision {show.precision.toFixed(2)}</span>
          <span>Flags {pct(show.flagged)}</span>
        </div>
      )}
    </div>
  )
}
