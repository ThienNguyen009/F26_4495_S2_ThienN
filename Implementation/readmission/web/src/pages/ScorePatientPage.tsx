import {
  Alert,
  Anchor,
  Box,
  Button,
  Grid,
  Group,
  NativeSelect,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { addRecord, setQueued, type SavedRecord } from '../api/records'
import { predict, type Prediction, type Tier } from '../api/scoring'
import { AGE_BAND_NOTE } from '../components/ageBandText'
import classes from './ScorePatientPage.module.css'

const opts = (values: string[]) => values.map((v) => ({ value: v, label: v }))

const AGE_BANDS = ['[0-10)', '[10-20)', '[20-30)', '[30-40)', '[40-50)', '[50-60)', '[60-70)', '[70-80)', '[80-90)', '[90-100)']
  .map((v) => ({ value: v, label: v.replace('-', '–') }))
const DIAG_GROUPS = opts(['Circulatory', 'Respiratory', 'Digestive', 'Diabetes', 'Injury', 'Musculoskeletal', 'Genitourinary', 'Neoplasms', 'Other'])
const DISPOSITIONS = [
  { value: 'Home', label: 'Home, no services' },
  { value: 'Home with services', label: 'Home with services' },
  { value: 'Care facility', label: 'Care facility' },
  { value: 'Other hospital', label: 'Other hospital' },
  { value: 'Left AMA', label: 'Left against medical advice' },
  { value: 'Other', label: 'Other' },
]
const RACES = [
  { value: '', label: 'Not recorded' },
  ...opts(['Caucasian', 'AfricanAmerican', 'Hispanic', 'Asian', 'Other']),
]

const TIER_LABEL: Record<Tier, string> = { high: 'High risk', medium: 'Medium risk', low: 'Low risk' }
const TIER_COLOR: Record<Tier, string> = { high: 'var(--risk-high)', medium: 'var(--risk-medium)', low: 'var(--risk-low)' }

// plain-language help shown in the ? tooltip next to each field label
const HELP: Partial<Record<keyof typeof INITIAL, string>> = {
  race: 'Used only to check that the model treats groups fairly. It is never sent to the model.',
  age_band: `${AGE_BAND_NOTE} On its own, age has only a small effect on the risk score.`,
  gender: 'The patient’s recorded sex. It has almost no effect on the risk score.',
  admission_type: 'How the patient came in: emergency, urgent, planned (elective) or after an injury (trauma).',
  time_in_hospital: 'How many days the patient spent in hospital this time (1–14).',
  disposition_group:
    'Where the patient goes after leaving. A care facility or another hospital raises the risk; home without services lowers it.',
  number_inpatient:
    'How many times the patient was admitted to hospital in the past 12 months. This is the strongest single factor in the model.',
  number_emergency: 'Visits to the emergency department in the past 12 months.',
  number_outpatient: 'Clinic or doctor’s office visits in the past 12 months (not hospital stays).',
  diag_1_group:
    'The main reason for this stay, grouped by body system. For example, Circulatory means heart and blood vessels.',
  diag_2_group: 'The second most important condition recorded for this stay, grouped the same way.',
  number_diagnoses:
    'How many separate conditions were recorded for this stay. More conditions usually means a more complex patient.',
  num_lab_procedures: 'How many lab tests, such as blood tests, were done during this stay.',
  num_procedures: 'How many procedures other than lab tests, such as scans or surgery, were done during this stay (0–6).',
  num_medications: 'How many different medicines the patient was given during this stay.',
  A1Cresult:
    'A blood test showing average blood sugar over the past 2–3 months. Above 7% or 8% means diabetes is poorly controlled. “Not measured” means no test was done.',
  change: 'Whether any diabetes medicine was started, stopped or had its dose changed during this stay.',
}

function withHelp(field: keyof typeof INITIAL, label: string): ReactNode {
  const help = HELP[field]
  if (!help) return label
  return (
    <>
      {label}
      <Tooltip label={help} multiline w={280} withArrow events={{ hover: true, focus: true, touch: true }}>
        {/* preventDefault so clicking the ? doesn't move focus into the field */}
        <span className={classes.help} tabIndex={0} aria-label={help} onClick={(e) => e.preventDefault()}>
          ?
        </span>
      </Tooltip>
    </>
  )
}

const INITIAL = {
  // who this is — kept with the result, never sent to the model
  patientName: '',
  mrn: '',
  encounterId: '',
  unitBed: '',
  race: '',
  scoredBy: '',
  // clinical fields
  age_band: '[60-70)',
  gender: 'Female',
  admission_type: 'Emergency',
  time_in_hospital: 4,
  disposition_group: 'Home',
  number_inpatient: 0,
  number_emergency: 0,
  number_outpatient: 0,
  diag_1_group: 'Circulatory',
  diag_2_group: 'Diabetes',
  number_diagnoses: 7,
  num_lab_procedures: 40,
  num_procedures: 1,
  num_medications: 15,
  A1Cresult: 'None',
  change: 'No',
}

export function ScorePatientPage() {
  const [result, setResult] = useState<Prediction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState<SavedRecord | null>(null)
  const [saving, setSaving] = useState<'dataset' | 'queue' | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  // any edit after predicting/saving means the shown result no longer matches the form
  const form = useForm({
    initialValues: INITIAL,
    onValuesChange: () => {
      setSaved(null)
      setSaveError(null)
    },
  })

  function split(values: typeof INITIAL) {
    const { patientName, mrn, encounterId, unitBed, race, scoredBy, ...features } = values
    const identity = {
      patient_name: patientName, mrn, encounter_ref: encounterId, unit_bed: unitBed, race, scored_by: scoredBy,
    }
    return { identity, features }
  }

  async function handlePredict(values: typeof INITIAL) {
    setLoading(true)
    setError(null)
    setSaved(null)
    try {
      setResult(await predict(split(values).features))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // "Add to dataset" saves the record; "Add to queue" saves it (if not saved yet) and puts it on the queue
  async function handleSave(toQueue: boolean) {
    const { identity, features } = split(form.getValues())
    setSaving(toQueue ? 'queue' : 'dataset')
    setSaveError(null)
    try {
      if (!saved) {
        setSaved(await addRecord(identity, features, toQueue))
      } else if (toQueue && !saved.in_queue) {
        await setQueued(saved.id, true)
        setSaved({ ...saved, in_queue: true })
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(null)
    }
  }

  function handleClear() {
    form.reset()
    setResult(null)
    setError(null)
    setSaved(null)
    setSaveError(null)
  }

  const num = (field: keyof typeof INITIAL, label: string, min = 0, max?: number) => (
    <NumberInput label={withHelp(field, label)} min={min} max={max} allowDecimal={false} radius="md" {...form.getInputProps(field)} />
  )
  const select = (field: keyof typeof INITIAL, label: string, data: { value: string; label: string }[]) => (
    <NativeSelect label={withHelp(field, label)} data={data} radius="md" {...form.getInputProps(field)} />
  )

  return (
    <Stack gap="lg" className={classes.page}>
      <div>
        <Anchor component={Link} to="/" size="sm" c="var(--accent)">
          ← Cohort intake
        </Anchor>
        <Title order={1} fz={30} fw={800} lts={-0.5} mt={4}>
          Score one patient
        </Title>
        <Text size="sm" c="gray.7" mt={4}>
          Identify the patient, then fill in the clinical fields the model needs. Nothing is stored until you add the
          record to the queue or to the dataset.
        </Text>
      </div>

      <Grid gap="md" align="stretch">
        <Grid.Col span={{ base: 12, md: 7.9 }}>
          <form onSubmit={form.onSubmit(handlePredict)} style={{ height: '100%' }}>
            <Stack gap="md" h="100%">
              <Box className={`${classes.card} ${classes.identity}`}>
                <Group gap="sm" mb="sm" align="baseline">
                  <span className={classes.section}>Who this is</span>
                  <Text size="xs" c="gray.6">
                    Recorded with the result for the ward record and the subgroup audit. None of it reaches the model.
                  </Text>
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" verticalSpacing="sm">
                  <TextInput label="Patient name" placeholder="Surname, Given" radius="md" {...form.getInputProps('patientName')} />
                  <TextInput label="Medical record number" placeholder="MRN-0000000" radius="md" {...form.getInputProps('mrn')} />
                  <TextInput label="Encounter ID" placeholder="ENC-00000" radius="md" {...form.getInputProps('encounterId')} />
                  <TextInput label="Unit and bed" placeholder="4B — 12A" radius="md" {...form.getInputProps('unitBed')} />
                  {select('race', 'Recorded race (audit only)', RACES)}
                  <TextInput label="Scored by" placeholder="Name, role" radius="md" {...form.getInputProps('scoredBy')} />
                </SimpleGrid>
              </Box>

              <Stack className={classes.card} gap="sm" flex={1} justify="space-between">
                <Stack gap="sm">
                  <FieldSection title="Patient and stay">
                    {select('age_band', 'Age band', AGE_BANDS)}
                    {select('gender', 'Sex', opts(['Female', 'Male']))}
                    {select('admission_type', 'Admission type', opts(['Emergency', 'Urgent', 'Elective', 'Trauma', 'Other', 'Unknown']))}
                    {num('time_in_hospital', 'Length of stay (days)', 1, 14)}
                    {select('disposition_group', 'Discharge disposition', DISPOSITIONS)}
                  </FieldSection>
                  <FieldSection title="Prior utilisation, last 12 months">
                    {num('number_inpatient', 'Inpatient admissions')}
                    {num('number_emergency', 'Emergency visits')}
                    {num('number_outpatient', 'Outpatient visits')}
                  </FieldSection>
                  <FieldSection title="This admission">
                    {select('diag_1_group', 'Primary diagnosis group', DIAG_GROUPS)}
                    {select('diag_2_group', 'Secondary diagnosis group', DIAG_GROUPS)}
                    {num('number_diagnoses', 'Number of diagnoses', 1, 16)}
                    {num('num_lab_procedures', 'Lab procedures')}
                    {num('num_procedures', 'Procedures performed', 0, 6)}
                    {num('num_medications', 'Medications during stay')}
                    {select('A1Cresult', 'HbA1c result', [
                      { value: 'None', label: 'Not measured' },
                      { value: 'Norm', label: 'Normal' },
                      { value: '>7', label: 'Above 7%' },
                      { value: '>8', label: 'Above 8%' },
                    ])}
                    {select('change', 'Diabetes medication changed', [
                      { value: 'No', label: 'No' },
                      { value: 'Ch', label: 'Yes' },
                    ])}
                  </FieldSection>
                </Stack>

                <Stack gap="sm" className={classes.footer} mt="lg">
                  {error && (
                    <Alert variant="light" color="red" title="Could not score this record">
                      {error}
                    </Alert>
                  )}
                  {saveError && (
                    <Alert variant="light" color="red" title="Could not add to the dataset">
                      {saveError}
                    </Alert>
                  )}
                  {saved && (
                    <Alert
                      variant="light"
                      color="brand"
                      title={saved.in_queue ? 'Added to the discharge queue' : 'Added to the dataset'}
                    >
                      Saved as record #{saved.id} with a risk of {saved.probability.toFixed(2)}. The 30-day outcome is
                      left open until it is known.{' '}
                      {saved.in_queue ? (
                        <>
                          The patient is now ranked on the{' '}
                          <Anchor component={Link} to="/queue" c="brand.8" fw={600}>
                            discharge queue
                          </Anchor>
                          .
                        </>
                      ) : (
                        <Anchor component={Link} to={`/patient/record/${saved.id}`} c="brand.8" fw={600}>
                          Open the record
                        </Anchor>
                      )}
                    </Alert>
                  )}
                  <Group justify="space-between">
                    <Group gap="sm">
                      <Button type="submit" size="md" radius="md" loading={loading} px="xl">
                        Predict
                      </Button>
                      <Button
                        variant="outline"
                        size="md"
                        radius="md"
                        disabled={!result || !!saved || saving === 'queue'}
                        loading={saving === 'dataset'}
                        onClick={() => handleSave(false)}
                        title={!result ? 'Predict first, then add the record' : undefined}
                      >
                        {saved ? 'Added' : 'Add to dataset'}
                      </Button>
                    </Group>
                    <Button variant="default" size="md" radius="md" onClick={handleClear}>
                      Clear
                    </Button>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
                    <Text size="xs" c="gray.7" lh={1.55}>
                      <strong>Predict</strong> scores the record and leaves nothing behind. Only the clinical fields are
                      sent to the model.
                    </Text>
                    <Text size="xs" c="gray.7" lh={1.55}>
                      <strong>Add to dataset</strong> stores the record and its prediction with the outcome left open.
                      The 30-day label is written back when it is known, and the record then joins the pool available
                      for retraining.
                    </Text>
                  </SimpleGrid>
                </Stack>
              </Stack>
            </Stack>
          </form>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4.1 }}>
          <ResultColumn
            result={result}
            savedId={saved?.id ?? null}
            inQueue={saved?.in_queue ?? false}
            queueLoading={saving === 'queue'}
            onAddToQueue={() => handleSave(true)}
          />
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

function FieldSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <Text className={classes.section} mt={6} mb={6}>
        {title}
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" verticalSpacing="sm">
        {children}
      </SimpleGrid>
    </div>
  )
}

function ResultColumn({
  result,
  savedId,
  inQueue,
  queueLoading,
  onAddToQueue,
}: {
  result: Prediction | null
  savedId: number | null
  inQueue: boolean
  queueLoading: boolean
  onAddToQueue: () => void
}) {
  const saved = savedId !== null
  const tierStyle = result ? ({ '--tier': TIER_COLOR[result.tier] } as CSSProperties) : undefined
  const maxAbs = Math.max(0.01, ...(result?.contributions.map((c) => Math.abs(c.value)) ?? []))

  return (
    <Stack gap="md" h="100%">
      <Box className={classes.card} style={tierStyle}>
        <Group justify="space-between" mb={8}>
          <span className={classes.section}>Result</span>
          {result && (
            <span className={classes.savedPill} data-saved={saved || undefined}>
              {saved ? 'Saved to dataset' : 'Not saved'}
            </span>
          )}
        </Group>
        {result ? (
          <>
            <Group gap="md" align="center" mb="md">
              <span className={classes.score}>{result.probability.toFixed(2)}</span>
              <div>
                <span className={classes.tierBadge}>{TIER_LABEL[result.tier]}</span>
                <Text size="xs" c="gray.6" mt={4}>
                  Alert threshold {result.threshold.toFixed(2)}
                </Text>
              </div>
            </Group>
            <div className={classes.meter}>
              <div className={classes.meterFill} style={{ width: `${result.probability * 100}%` }} />
              <div className={classes.meterMark} style={{ left: `${result.threshold * 100}%` }} />
            </div>
          </>
        ) : (
          <Text size="sm" c="gray.6">
            Fill in the clinical fields and press Predict to see the 30-day readmission risk.
          </Text>
        )}
      </Box>

      <Box className={classes.card} flex={1}>
        <span className={classes.section}>Why</span>
        {result ? (
          <>
            <Text size="sm" c="gray.7" mt={4} mb="md">
              Largest contributions, from a base rate of {result.base_rate.toFixed(2)}.
            </Text>
            <Stack gap={6}>
              {result.contributions.map((c) => (
                <div key={c.feature} className={classes.contribRow}>
                  <Text size="sm" ta="right" lh={1.3}>
                    {c.feature}
                  </Text>
                  <div className={classes.contribBars}>
                    <div
                      className={classes.contribBar}
                      data-negative={c.value < 0 || undefined}
                      style={{ width: `${(Math.abs(c.value) / maxAbs) * 75}%` }}
                    />
                  </div>
                  <Text size="sm" fw={600} c={c.value < 0 ? 'var(--negative)' : 'var(--risk-high)'}>
                    {c.value > 0 ? '+' : '−'}
                    {Math.abs(c.value).toFixed(2)}
                  </Text>
                </div>
              ))}
            </Stack>
          </>
        ) : (
          <Text size="sm" c="gray.6" mt={4}>
            The factors that pushed this patient’s risk up or down will appear here.
          </Text>
        )}
      </Box>

      <Box className={classes.card}>
        <span className={classes.section}>Recommended action</span>
        <Text fw={700} mt={6} mb="md">
          {result ? result.action : '—'}
        </Text>
        <SimpleGrid cols={2} spacing="sm">
          {inQueue ? (
            <Button component={Link} to="/queue" size="md" radius="md" variant="light">
              In queue · open
            </Button>
          ) : (
            <Button
              size="md"
              radius="md"
              disabled={!result}
              loading={queueLoading}
              onClick={onAddToQueue}
              title={result ? 'Save this record and rank it on the discharge queue' : 'Predict first'}
            >
              Add to queue
            </Button>
          )}
          <Button
            component={Link}
            to={saved ? `/patient/record/${savedId}` : '/patients'}
            variant="default"
            size="md"
            radius="md"
            disabled={!saved}
            title={saved ? undefined : 'Add the record to the dataset first, then open its full page'}
          >
            Full explanation
          </Button>
        </SimpleGrid>
      </Box>

      <div className={classes.disclaimer}>
        Submitting calls the same scoring endpoint as the CSV upload and the replayed cohort.
        {(result?.placeholder ?? true) && ' Illustrative values — not model output.'}
      </div>
    </Stack>
  )
}
