import {
  Alert,
  Anchor,
  Button,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getPatient, saveDecision, type Decision, type DecisionIn, type PatientDetail } from '../api/queue'
import {
  deleteRecord,
  getRecord,
  saveRecordDecision,
  setOutcome,
  setQueued,
  type Outcome,
  type RecordDetail,
} from '../api/records'
import type { Tier } from '../api/scoring'
import { AgeBand, AgeBandLabel } from '../components/AgeBand'
import classes from './PatientPage.module.css'

const TIER_LABEL: Record<Tier, string> = { high: 'High risk tier', medium: 'Medium risk tier', low: 'Low risk tier' }
const TIER_COLOR: Record<Tier, string> = { high: 'var(--risk-high)', medium: 'var(--risk-medium)', low: 'var(--risk-low)' }

const DISPOSITION: Record<string, string> = { Home: 'Home, no services' }
const A1C: Record<string, string> = { None: 'Not measured', Norm: 'Normal', '>7': 'Above 7%', '>8': 'Above 8%' }

function tierRule(d: PatientDetail) {
  const hi = d.high_threshold.toFixed(2)
  const med = d.medium_threshold.toFixed(2)
  if (d.tier === 'high') return `Tier rule: scores of ${hi} or above are high risk, the top 10% of validation patients.`
  if (d.tier === 'medium') return `Tier rule: scores from ${med} up to ${hi} are medium risk, the next 10% of validation patients.`
  return `Tier rule: scores below ${med} are low risk, the remaining 80% of validation patients.`
}

type Kind = 'queue' | 'record'
type Detail = PatientDetail | RecordDetail
const isRecord = (d: Detail): d is RecordDetail => 'record_id' in d

// /patient/:encounterId  → demo queue patient (accept / override)
// /patient/record/:id    → record saved from Score one patient (record the 30-day outcome)
export function PatientPage() {
  const { encounterId, recordId } = useParams()
  if (recordId) return <PatientDetailView key={`record-${recordId}`} kind="record" id={recordId} />
  if (encounterId) return <PatientDetailView key={encounterId} kind="queue" id={encounterId} />
  return <Navigate to="/patients" replace />
}

function PatientDetailView({ kind, id }: { kind: Kind; id: string }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const from = (useLocation().state as { from?: string } | null)?.from

  useEffect(() => {
    const load = kind === 'record' ? getRecord(id) : getPatient(id)
    load.then(setDetail, (e: Error) => setError(e.message))
  }, [kind, id])

  const toPatients = kind === 'record' || from === '/patients'
  const back = (
    <Anchor component={Link} to={toPatients ? '/patients' : '/queue'} size="sm" c="brand.7" fw={600}>
      ← Back to {toPatients ? 'all patients' : 'discharge queue'}
    </Anchor>
  )

  if (error)
    return (
      <Stack gap="md">
        {back}
        <Alert variant="light" color="red" title="Could not load this patient">
          {error}
        </Alert>
      </Stack>
    )
  if (!detail)
    return (
      <Group justify="center" p="xl">
        <Loader size="sm" color="brand" />
      </Group>
    )

  const r = detail.record
  const style = { '--tier': TIER_COLOR[detail.tier] } as CSSProperties

  return (
    <Stack gap="lg" className={classes.page} style={style}>
      <div>
        {back}
        <Title order={1} fz={30} fw={800} lts={-0.5} mt={6}>
          {detail.patient_name && `${detail.patient_name} · `}
          {detail.encounter_id} · <AgeBand band={r.age_band} /> · {r.diag_1_group}
        </Title>
        <Text size="sm" c="gray.7" mt={4}>
          {r.admission_type} admission · {r.time_in_hospital}-day stay · discharge to{' '}
          {(DISPOSITION[r.disposition_group] ?? r.disposition_group).toLowerCase()}
        </Text>
      </div>

      <div className={classes.layout}>
        <Stack gap="md">
          <RiskCard detail={detail} />
          <WhyCard detail={detail} />
        </Stack>
        <Stack gap="md">
          {isRecord(detail) ? (
            <>
              <QueueCard detail={detail} onChange={(in_queue) => setDetail({ ...detail, in_queue })} />
              {detail.in_queue ? (
                <ActionCard
                  detail={detail}
                  save={(body) => saveRecordDecision(detail.record_id, body)}
                  onDecision={(d) => setDetail({ ...detail, decision: d })}
                />
              ) : (
                <RecommendationCard detail={detail} />
              )}
              <OutcomeCard detail={detail} onChange={(outcome) => setDetail({ ...detail, outcome })} />
            </>
          ) : (
            <ActionCard
              detail={detail}
              save={(body) => saveDecision(detail.encounter_id, body)}
              onDecision={(d) => setDetail({ ...detail, decision: d })}
            />
          )}
          <RecordCard detail={detail} />
        </Stack>
      </div>
    </Stack>
  )
}

function RiskCard({ detail }: { detail: PatientDetail }) {
  return (
    <div className={`${classes.card} ${classes.riskCard}`}>
      <div>
        <div className={classes.section}>Risk score</div>
        <div className={classes.score}>{detail.probability.toFixed(2)}</div>
      </div>
      <div className={classes.meterBlock}>
        <span className={classes.tierBadge}>{TIER_LABEL[detail.tier]}</span>
        <div className={classes.meter}>
          <div className={classes.meterFill} style={{ width: `${detail.probability * 100}%` }} />
          <div className={classes.meterMark} style={{ left: `${detail.high_threshold * 100}%` }} />
        </div>
        <div className={classes.meterScale}>
          <span>0.00</span>
          <span className={classes.meterMarkLabel} style={{ left: `${detail.high_threshold * 100}%` }}>
            Alert threshold {detail.high_threshold.toFixed(2)}
          </span>
          <span>1.00</span>
        </div>
      </div>
    </div>
  )
}

function WhyCard({ detail }: { detail: PatientDetail }) {
  // one shared scale: the zero line sits where the largest "lowers" and "raises" bars both fit
  const values = detail.contributions.map((c) => c.value)
  const maxUp = Math.max(0, ...values)
  const maxDown = Math.max(0, ...values.map((v) => -v))
  const span = Math.max(maxUp + maxDown, 0.005)
  const zero = (maxDown / span) * 100
  const chartStyle = { '--zero': `${zero}%` } as CSSProperties

  return (
    <div className={classes.card}>
      <Text fw={700} size="lg">
        Why this patient was {detail.tier === 'low' ? 'not flagged' : 'flagged'}
      </Text>
      <Text size="sm" c="gray.7">
        SHAP contributions to this prediction in probability points, starting from a base rate of{' '}
        {detail.base_rate.toFixed(2)}.
      </Text>
      <Group gap="lg" mt="sm" mb="md">
        <span className={classes.legend} style={{ '--c': 'var(--risk-high)' } as CSSProperties}>
          Raises risk
        </span>
        <span className={classes.legend} style={{ '--c': 'var(--negative)' } as CSSProperties}>
          Lowers risk
        </span>
      </Group>
      <div className={classes.contribChart} style={chartStyle}>
        {detail.contributions.map((c) => {
          const width = (Math.abs(c.value) / span) * 100
          return (
            <div key={c.feature} className={classes.contribRow}>
              <Text size="sm" ta="right" lh={1.3} className={classes.contribLabel}>
                {c.feature}
              </Text>
              <div className={classes.contribTrack}>
                <div
                  className={classes.contribBar}
                  data-negative={c.value < 0 || undefined}
                  style={{ left: `${c.value < 0 ? zero - width : zero}%`, width: `${width}%` }}
                />
              </div>
              <Text size="sm" fw={600} ta="right" className={classes.contribValue} data-negative={c.value < 0 || undefined}>
                {c.value > 0 ? '+' : '−'}
                {Math.abs(c.value).toFixed(3)}
              </Text>
            </div>
          )
        })}
        <div className={classes.contribRow} aria-hidden>
          <span />
          <div className={classes.contribAxis}>
            <span style={{ left: 'var(--zero)' }}>0</span>
          </div>
          <span />
        </div>
      </div>
    </div>
  )
}

function ActionCard({
  detail,
  save,
  onDecision,
}: {
  detail: PatientDetail
  save: (body: DecisionIn) => Promise<Decision>
  onDecision: (d: Decision) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const d = detail.decision

  async function submit(body: DecisionIn) {
    setSaving(true)
    setError(null)
    try {
      onDecision(await save(body))
      setOverrideOpen(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={classes.card}>
      <div className={classes.section}>Recommended action</div>
      <Title order={2} fz={22} fw={800} mt={6} lh={1.25}>
        {detail.action}
      </Title>
      <Text size="sm" c="gray.8" mt="xs">
        {tierRule(detail)}
      </Text>

      {d && (
        <div className={classes.status} data-overridden={d.decision === 'overridden' || undefined}>
          <Text size="sm" fw={700}>
            {d.decision === 'accepted' ? 'Accepted & assigned' : 'Overridden'}: {d.action}
          </Text>
          {d.reason && (
            <Text size="sm" c="gray.8">
              Reason: {d.reason}
            </Text>
          )}
          <Text size="xs" c="gray.7">
            {d.by ?? 'Unknown user'} · {new Date(d.at).toLocaleString()}
          </Text>
        </div>
      )}

      {error && (
        <Alert variant="light" color="red" mt="md" p="xs">
          {error}
        </Alert>
      )}

      <Group grow mt="md" gap="sm">
        <Button
          size="md"
          radius="md"
          loading={saving && !overrideOpen}
          onClick={() => submit({ decision: 'accepted', action: detail.action })}
        >
          {d ? 'Accept again' : 'Accept & assign'}
        </Button>
        <Button variant="default" size="md" radius="md" onClick={() => setOverrideOpen(true)}>
          Override
        </Button>
      </Group>

      <OverrideModal
        opened={overrideOpen}
        detail={detail}
        saving={saving}
        onClose={() => setOverrideOpen(false)}
        onSubmit={(action, reason) => submit({ decision: 'overridden', action, reason })}
      />
    </div>
  )
}

function OverrideModal({
  opened,
  detail,
  saving,
  onClose,
  onSubmit,
}: {
  opened: boolean
  detail: PatientDetail
  saving: boolean
  onClose: () => void
  onSubmit: (action: string, reason: string) => void
}) {
  const options = Object.values(detail.actions).filter((a) => a !== detail.action)
  const [action, setAction] = useState<string | null>(options[0] ?? null)
  const [reason, setReason] = useState('')

  return (
    <Modal opened={opened} onClose={onClose} title="Override the recommended action" centered radius="md">
      <Stack gap="md">
        <Text size="sm" c="gray.7">
          The model recommends <strong>{detail.action}</strong>. Choose what the team will do instead and say why; the
          reason is saved with your name.
        </Text>
        <Select
          label="Action instead"
          data={options}
          value={action}
          onChange={setAction}
          allowDeselect={false}
          searchable
          // lets staff type a different action that isn't one of the tier defaults
          onSearchChange={(s) => s && !options.includes(s) && setAction(s)}
        />
        <Textarea
          label="Reason"
          placeholder="e.g. Already enrolled in a community heart-failure programme"
          autosize
          minRows={3}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!action || !reason.trim()} onClick={() => action && onSubmit(action, reason)}>
            Save override
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

const OUTCOME_OPTIONS: { value: string; label: string; outcome: Outcome }[] = [
  { value: 'pending', label: 'Not known yet', outcome: null },
  { value: '1', label: 'Readmitted within 30 days', outcome: 1 },
  { value: '0', label: 'Not readmitted', outcome: 0 },
]

// Saved records: staff write back the real 30-day result once it is known.
function OutcomeCard({ detail, onChange }: { detail: RecordDetail; onChange: (o: Outcome) => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = detail.outcome === null ? 'pending' : String(detail.outcome)

  async function choose(value: string) {
    const outcome = OUTCOME_OPTIONS.find((o) => o.value === value)!.outcome
    setSaving(true)
    setError(null)
    try {
      await setOutcome(detail.record_id, outcome)
      onChange(outcome)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={classes.card}>
      <div className={classes.section}>30-day outcome</div>
      <Text size="sm" c="gray.8" mt={6} mb="sm">
        Was this patient readmitted within 30 days of discharge? Once known, the record can join the pool for
        retraining and for checking the model.
      </Text>
      <SegmentedControl
        fullWidth
        orientation="vertical"
        value={current}
        onChange={choose}
        disabled={saving}
        data={OUTCOME_OPTIONS.map(({ value, label }) => ({ value, label }))}
      />
      {saving && (
        <Group gap={6} mt="xs">
          <Loader size={12} color="brand" />
          <Text size="xs" c="gray.7">
            Saving…
          </Text>
        </Group>
      )}
      {error && (
        <Alert variant="light" color="red" mt="sm" p="xs">
          {error}
        </Alert>
      )}
    </div>
  )
}

// Saved records: put on / take off the Discharge queue, or delete permanently.
function QueueCard({ detail, onChange }: { detail: RecordDetail; onChange: (inQueue: boolean) => void }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState<'queue' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const who = detail.patient_name ?? detail.encounter_id

  async function toggle() {
    setBusy('queue')
    setError(null)
    try {
      await setQueued(detail.record_id, !detail.in_queue)
      onChange(!detail.in_queue)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setBusy('delete')
    setError(null)
    try {
      await deleteRecord(detail.record_id)
      navigate('/patients', { replace: true, state: { deleted: who } })
    } catch (e) {
      setError((e as Error).message)
      setConfirmOpen(false)
      setBusy(null)
    }
  }

  return (
    <div className={classes.card}>
      <div className={classes.section}>Discharge queue</div>
      <Text size="sm" c="gray.8" mt={6}>
        {detail.in_queue ? (
          <>
            <strong>On today’s queue.</strong> Ranked with the other discharges; assign follow-up below.
          </>
        ) : (
          'Not on the queue. Add this patient to rank them with today’s discharges and assign follow-up.'
        )}
      </Text>
      {error && (
        <Alert variant="light" color="red" mt="sm" p="xs">
          {error}
        </Alert>
      )}
      <Group grow mt="md" gap="sm">
        <Button
          variant={detail.in_queue ? 'default' : 'filled'}
          size="md"
          loading={busy === 'queue'}
          disabled={busy === 'delete'}
          onClick={toggle}
        >
          {detail.in_queue ? 'Remove from queue' : 'Add to queue'}
        </Button>
        {detail.in_queue && (
          <Button component={Link} to="/queue" variant="default" size="md">
            Open queue
          </Button>
        )}
      </Group>
      <Button
        variant="subtle"
        color="red"
        size="compact-sm"
        mt="md"
        onClick={() => setConfirmOpen(true)}
        disabled={busy !== null}
      >
        Delete patient record…
      </Button>

      <Modal opened={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete this patient?" centered>
        <Stack gap="md">
          <Text size="sm">
            This permanently deletes <strong>{who}</strong>: the saved record, its score, its 30-day outcome and any
            follow-up decisions. It can’t be undone.
          </Text>
          {detail.in_queue && (
            <Text size="sm" c="gray.7">
              If the patient just shouldn’t be on today’s queue, use <strong>Remove from queue</strong> instead.
            </Text>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setConfirmOpen(false)} disabled={busy === 'delete'}>
              Cancel
            </Button>
            <Button color="red" loading={busy === 'delete'} onClick={remove}>
              Delete permanently
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  )
}

// Saved records not on the queue have no accept / override workflow; show the recommendation only.
function RecommendationCard({ detail }: { detail: RecordDetail }) {
  const changed = detail.saved_probability !== detail.probability
  return (
    <div className={classes.card}>
      <div className={classes.section}>Recommended action</div>
      <Title order={2} fz={22} fw={800} mt={6} lh={1.25}>
        {detail.action}
      </Title>
      <Text size="sm" c="gray.8" mt="xs">
        {tierRule(detail)}
      </Text>
      {changed && (
        <Text size="xs" c="gray.7" mt="xs">
          Scored {detail.saved_probability.toFixed(2)} ({detail.saved_tier}) when saved; the current model gives{' '}
          {detail.probability.toFixed(2)}.
        </Text>
      )}
    </div>
  )
}

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function RecordCard({ detail }: { detail: Detail }) {
  const r = detail.record
  const saved = isRecord(detail) ? detail : null
  const rows: [ReactNode, ReactNode][] = [
    [
      'Patient name',
      detail.patient_name ?? (
        <Tooltip
          label={
            saved
              ? 'No name was entered when this record was saved.'
              : 'The demo patients come from the de-identified UCI dataset, which has no names. Records that include a name show it here.'
          }
          multiline
          w={260}
          withArrow
          events={{ hover: true, focus: true, touch: true }}
        >
          <Text component="span" size="sm" c="gray.7" fw={500} fs="italic" tabIndex={0} style={{ cursor: 'help' }}>
            {saved ? 'Not recorded' : 'Not recorded (de-identified dataset)'}
          </Text>
        </Tooltip>
      ),
    ],
    ...(saved
      ? ([
          ['Medical record number', saved.mrn ?? '—'],
          ['Unit and bed', saved.unit_bed ?? '—'],
          ['Scored by', saved.scored_by ?? '—'],
          ['Saved', `${dateFmt.format(new Date(saved.created_at))}${saved.saved_by ? ` by ${saved.saved_by}` : ''}`],
        ] as [ReactNode, ReactNode][])
      : []),
    [<AgeBandLabel key="l" />, <AgeBand key="v" band={r.age_band} />],
    ['Gender', r.gender],
    ['Primary diagnosis group', r.diag_1_group],
    ['Secondary diagnosis group', r.diag_2_group],
    ['Admission type', r.admission_type],
    ['Length of stay', `${r.time_in_hospital} days`],
    ['Inpatient admissions, prior year', r.number_inpatient],
    ['Emergency visits, prior year', r.number_emergency],
    ['Outpatient visits, prior year', r.number_outpatient],
    ['Medications', r.num_medications],
    ['Diagnoses recorded', r.number_diagnoses],
    ['Lab procedures', r.num_lab_procedures],
    ['Procedures performed', r.num_procedures],
    ['HbA1c result', A1C[r.A1Cresult] ?? r.A1Cresult],
    ['Diabetes medication changed', r.change === 'Ch' ? 'Yes' : 'No'],
    ['Discharge disposition', DISPOSITION[r.disposition_group] ?? r.disposition_group],
  ]
  return (
    <div className={classes.card}>
      <div className={classes.section}>Encounter record</div>
      <dl className={classes.record}>
        {rows.map(([k, v], i) => (
          <div key={i}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <Text size="xs" c="gray.6" mt="sm">
        {saved
          ? `Saved record #${saved.record_id} from Score one patient. Identity fields are kept for the ward record and never reach the model.`
          : 'De-identified held-out test encounter from the UCI diabetes dataset, used as a demo discharge.'}
      </Text>
    </div>
  )
}
