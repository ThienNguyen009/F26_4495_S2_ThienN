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
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { predict, type Prediction, type Tier } from '../api/scoring'
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
  const form = useForm({ initialValues: INITIAL })

  async function handlePredict(values: typeof INITIAL) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { patientName, mrn, encounterId, unitBed, race, scoredBy, ...features } = values
    setLoading(true)
    setError(null)
    try {
      setResult(await predict(features))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    form.reset()
    setResult(null)
    setError(null)
  }

  const num = (field: keyof typeof INITIAL, label: string, min = 0, max?: number) => (
    <NumberInput label={label} min={min} max={max} allowDecimal={false} radius="md" {...form.getInputProps(field)} />
  )
  const select = (field: keyof typeof INITIAL, label: string, data: { value: string; label: string }[]) => (
    <NativeSelect label={label} data={data} radius="md" {...form.getInputProps(field)} />
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
                    {num('num_medications', 'Discharge medications')}
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
                  <Group justify="space-between">
                    <Group gap="sm">
                      <Button type="submit" size="md" radius="md" loading={loading} px="xl">
                        Predict
                      </Button>
                      <Button
                        variant="outline"
                        size="md"
                        radius="md"
                        disabled={!result}
                        title="Saving to the dataset isn't built yet"
                      >
                        Add to dataset
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
          <ResultColumn result={result} />
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

function ResultColumn({ result }: { result: Prediction | null }) {
  const tierStyle = result ? ({ '--tier': TIER_COLOR[result.tier] } as CSSProperties) : undefined
  const maxAbs = Math.max(0.01, ...(result?.contributions.map((c) => Math.abs(c.value)) ?? []))

  return (
    <Stack gap="md" h="100%">
      <Box className={classes.card} style={tierStyle}>
        <Group justify="space-between" mb={8}>
          <span className={classes.section}>Result</span>
          {result && <span className={classes.savedPill}>Not saved</span>}
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
          <Button size="md" radius="md" disabled={!result} title="The discharge queue isn't built yet">
            Add to queue
          </Button>
          <Button component={Link} to="/patient" variant="default" size="md" radius="md" disabled={!result}>
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
