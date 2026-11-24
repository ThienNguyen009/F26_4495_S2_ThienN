import {
  Anchor,
  Button,
  Group,
  NumberInput,
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
  {
    value: 'csv',
    title: 'Upload a CSV',
    body: 'Upload a file of patients and get back a list ranked from highest to lowest risk.',
    foot: 'One row per patient · same fields as the form',
  },
  {
    value: 'single',
    title: 'Enter one patient',
    body: 'Fill in the model’s input features by hand for a single patient at the bedside.',
    foot: 'Ad-hoc scoring · makes the model inspectable',
  },
]

const SUBMIT: Record<Exclude<Mode, 'single'>, { label: string; hint: string }> = {
  replay: { label: 'Run replay', hint: 'Picked at random from 19,055 test patients' },
  csv: { label: 'Score file', hint: 'One row per patient, same 16 fields as the form' },
}

// same field names and values as PatientIn in api/scoring.py
const TEMPLATE_COLUMNS = [
  'age_band', 'gender', 'admission_type', 'time_in_hospital', 'disposition_group', 'number_inpatient',
  'number_emergency', 'number_outpatient', 'diag_1_group', 'diag_2_group', 'number_diagnoses',
  'num_lab_procedures', 'num_procedures', 'num_medications', 'A1Cresult', 'change',
]
const TEMPLATE_ROWS = [
  ['[70-80)', 'Female', 'Emergency', 7, 'Home', 3, 2, 4, 'Circulatory', 'Diabetes', 9, 48, 2, 18, 'None', 'No'],
  ['[50-60)', 'Male', 'Elective', 2, 'Home', 0, 0, 1, 'Musculoskeletal', 'Diabetes', 5, 30, 1, 10, 'Norm', 'No'],
  ['[80-90)', 'Female', 'Urgent', 9, 'Care facility', 2, 1, 0, 'Respiratory', 'Circulatory', 9, 60, 0, 22, '>8', 'Ch'],
]

function downloadTemplate() {
  const csv = [TEMPLATE_COLUMNS, ...TEMPLATE_ROWS].map((row) => row.join(',')).join('\n') + '\n'
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'patients_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function CohortIntakePage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Exclude<Mode, 'single'>>('csv')

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
          Choose how to bring in patients. All three ways use the same model.
        </Text>
      </div>

      <div>
        <Text size="xs" fw={500} c="gray.7" tt="uppercase" lts={0.5} mb={8}>
          Input mode
        </Text>
        <Radio.Group value={mode} onChange={handleModeChange}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
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

      <Stack className={classes.panel} gap="xl">
        {mode === 'csv' && <CsvForm />}
        <Group gap="md">
          <Button size="md" radius="md" disabled title="Not connected to the model yet">
            {SUBMIT[mode].label}
          </Button>
          <div>
            <Text size="xs" c="gray.6">
              {SUBMIT[mode].hint}
            </Text>
            <Text size="xs" c="gray.6">
              Not connected to the model yet.
            </Text>
          </div>
        </Group>
      </Stack>
    </Stack>
  )
}

function PanelHeading({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <Text fw={700} size="lg">
        {title}
      </Text>
      <Text size="sm" c="gray.7">
        {body}
      </Text>
    </div>
  )
}

function CsvForm() {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    setFile(e.dataTransfer.files[0] ?? null)
  }

  return (
    <Stack gap="lg">
      <PanelHeading
        title="Upload a CSV"
        body="Each row is one patient, with the same fields as the Score one patient form. Rows with a missing or invalid value come back with a reason instead of being skipped."
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
          {file ? `${(file.size / 1024).toFixed(1)} KB` : 'One row per patient · up to 10 MB'}
        </Text>
      </label>
      <Anchor
        component="button"
        type="button"
        size="sm"
        fw={600}
        c="var(--accent)"
        style={{ alignSelf: 'flex-start' }}
        onClick={downloadTemplate}
      >
        Download a template with example rows
      </Anchor>
      <div className={classes.note}>
        <strong>No outcomes in an uploaded file.</strong> The list is ranked by predicted risk only; there is nothing to
        check it against until patients actually return.
      </div>
    </Stack>
  )
}
