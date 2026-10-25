import {
  Anchor,
  Button,
  Grid,
  Group,
  Radio,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import classes from './CohortIntakePage.module.css'

type Mode = 'replay' | 'csv' | 'single'

const MODES: { value: Mode; title: string; body: string; foot: string }[] = [
  // {
  //   value: 'replay',
  //   title: 'Replay test cohort',
  //   body: 'Sample encounters from the held-out test set and present them as a day’s discharge list.',
  //   foot: 'True outcomes known · for demonstration and validation',
  // },
  // {
  //   value: 'csv',
  //   title: 'Upload a CSV',
  //   body: 'Drop in an extract of discharge records and get back a ranked worklist.',
  //   foot: 'How an analyst would use it before any integration',
  // },
  {
    value: 'single',
    title: 'Enter one patient',
    body: 'Fill in the model’s input features by hand for a single patient at the bedside.',
    foot: 'Ad-hoc scoring · makes the model inspectable',
  },
]

// const PIPELINE = [
//   {
//     title: 'Schema validation',
//     body: 'Pydantic checks every column, type, and permitted category. Rows that fail are rejected with a reason, not silently dropped.',
//     color: 'var(--mantine-color-brand-4)',
//   },
//   {
//     title: 'Feature pipeline',
//     body: 'The same scikit-learn transformer fitted during training — missing-value handling, diagnosis grouping, encoding.',
//     color: 'var(--mantine-color-brand-4)',
//   },
//   {
//     title: 'Model inference',
//     body: 'The versioned XGBoost pipeline returns a probability per encounter.',
//     color: 'var(--mantine-color-brand-4)',
//   },
//   {
//     title: 'SHAP attribution',
//     body: 'Per-patient contributions computed alongside the prediction, so the explanation is never reconstructed after the fact.',
//     color: 'var(--mantine-color-brand-4)',
//   },
//   {
//     title: 'Risk tier and action',
//     body: 'Thresholds from the precision-recall curve assign low, medium, or high, and the tier rule attaches the recommended follow-up.',
//     color: '#b8860b',
//   },
//   {
//     title: 'Written to the queue',
//     body: 'Scored encounters land in PostgreSQL and appear on the discharge queue.',
//     color: 'var(--mantine-color-brand-8)',
//   },
// ]

const SUBMIT: Record<Exclude<Mode, 'single'>, { label: string; hint: string }> = {
  replay: { label: 'Score cohort', hint: 'Draws from the held-out test partition · n = 15,231' },
  csv: { label: 'Score file', hint: 'One row per encounter, same columns as the training data' },
}

export function CohortIntakePage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Exclude<Mode, 'single'>>('replay')

  // single-patient entry has its own page
  function handleModeChange(value: string) {
    if (value === 'single') navigate('/score')
    else setMode(value as Exclude<Mode, 'single'>)
  }

  return (
    <Stack gap="lg" className={classes.page}>
      <div>
        <Title order={1} fz={30} fw={800} lts={-0.5}>
          Where the records come from
        </Title>
        <Text size="sm" c="gray.7" mt={4}>
          Training runs once, offline, on the full UCI dataset. Scoring runs on demand, on whatever discharge records
          arrive through one of these three routes.
        </Text>
      </div>

      <div>
        <Text size="xs" fw={500} c="gray.7" tt="uppercase" lts={0.5} mb={8}>
          Input mode
        </Text>
        <Radio.Group value={mode} onChange={handleModeChange}>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {MODES.map((m) => (
              <Radio.Card key={m.value} value={m.value} className={classes.modeCard}>
                <Group gap={12} wrap="nowrap" align="center">
                  <Radio.Indicator color="var(--accent)" />
                  <Text fw={700}>{m.title}</Text>
                </Group>
                <Text size="sm" c="gray.8" mt={8}>
                  {m.body}
                </Text>
                <Text size="xs" c="gray.6" mt={12}>
                  {m.foot}
                </Text>
                {m.value === 'single' && (
                  <Anchor component="span" size="xs" fw={600} c="var(--accent)" display="block" mt={10}>
                    See the form →
                  </Anchor>
                )}
              </Radio.Card>
            ))}
          </SimpleGrid>
        </Radio.Group>
      </div>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 7.5 }}>
          <Stack className={classes.panel} justify="space-between" gap="xl">
            {mode === 'replay' && <ReplayForm />}
            {mode === 'csv' && <CsvForm />}
            <Group gap="md">
              <Button size="md" radius="md">
                {SUBMIT[mode].label}
              </Button>
              <Text size="xs" c="gray.6">
                {SUBMIT[mode].hint}
              </Text>
            </Group>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4.5 }}>
          
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

// function PanelHeading({ title, body }: { title: string; body: string }) {
//   return (
//     <div>
//       <Text fw={700} size="lg">
//         {title}
//       </Text>
//       <Text size="sm" c="gray.7">
//         {body}
//       </Text>
//     </div>
//   )
// }

function ReplayForm() {
  return (
    <Stack gap="lg">
      {/* <PanelHeading
        title="Replay a test cohort"
        body="Draws encounters the model never saw during training. Because their true outcomes are recorded, the queue can be checked against what actually happened."
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <NumberInput label="Cohort size" defaultValue={42} min={1} max={500} suffix=" encounters" radius="md" />
        <NumberInput label="Sample seed" defaultValue={20260916} hideControls radius="md" />
        <Select
          label="Present as"
          defaultValue="today"
          allowDeselect={false}
          radius="md"
          data={[
            { value: 'today', label: "Today's discharges" },
            { value: 'week', label: "This week's discharges" },
          ]}
        />
      </SimpleGrid>
      <div className={classes.note}>
        <strong>Outcomes are known for this cohort.</strong> After scoring, the queue gains a column marking which
        flagged patients were in fact readmitted within 30 days — the retrospective check that makes a demo convincing.
      </div> */}
    </Stack>
  )
}

function CsvForm() {
  // const [file, setFile] = useState<File | null>(null)
  // const [dragging, setDragging] = useState(false)
  // console.log(file);
  // console.log(dragging);
 

  return (
    <Stack gap="lg">
      {/* <PanelHeading
        title="Upload a CSV"
        body="Each row is one discharge encounter. Rows are validated against the training schema before scoring; any that fail come back with a reason."
      />
      <label
        className={classes.dropzone}
        data-dragging={dragging || undefined}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input type="file" accept=".csv,text/csv" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Text fw={600} size="sm">
          {file ? file.name : 'Drop a CSV here or click to browse'}
        </Text>
        <Text size="xs" c="gray.6">
          {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Same columns as diabetic_data.csv · up to 10 MB'}
        </Text>
      </label>
      <div className={classes.note}>
        <strong>No outcomes in an uploaded file.</strong> The worklist is ranked by predicted risk only; there is
        nothing to check it against until patients actually return.
      </div> */}
    </Stack>
  )
}
