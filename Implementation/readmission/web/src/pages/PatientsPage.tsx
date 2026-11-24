import { Alert, Anchor, Group, Loader, SegmentedControl, Select, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getQueue, type QueuePatient } from '../api/queue'
import { listRecords, type RecordSummary } from '../api/records'
import type { Tier } from '../api/scoring'
import { AgeBand, AgeBandLabel } from '../components/AgeBand'
import classes from './PatientsPage.module.css'

type Source = 'saved' | 'demo'
type Status = { label: string; kind: 'bad' | 'good' | 'warn' | 'muted' }

// one row shape for both sources
type Row = {
  key: string
  source: Source
  id: string
  href: string
  name: string | null
  mrn: string | null
  ageBand: string
  diag: string
  probability: number
  tier: Tier
  status: Status
  date: string | null
  inQueue: boolean
  search: string
}

const TIER_LABEL: Record<Tier, string> = { high: 'High', medium: 'Medium', low: 'Low' }
const TIER_COLOR: Record<Tier, string> = { high: 'var(--risk-high)', medium: 'var(--risk-medium)', low: 'var(--risk-low)' }
const SOURCE_LABEL: Record<Source, string> = { saved: 'Saved record', demo: 'Demo queue' }

function outcomeStatus(o: RecordSummary['outcome']): Status {
  if (o === 1) return { label: 'Readmitted', kind: 'bad' }
  if (o === 0) return { label: 'Not readmitted', kind: 'good' }
  return { label: 'Outcome pending', kind: 'muted' }
}

function decisionStatus(p: QueuePatient): Status {
  if (p.decision?.decision === 'accepted') return { label: 'Assigned', kind: 'good' }
  if (p.decision?.decision === 'overridden') return { label: 'Overridden', kind: 'warn' }
  return { label: 'No decision', kind: 'muted' }
}

function fromRecord(r: RecordSummary): Row {
  const id = r.encounter_ref ?? `REC-${r.id}`
  return {
    key: `saved-${r.id}`,
    source: 'saved',
    id,
    href: `/patient/record/${r.id}`,
    name: r.patient_name,
    mrn: r.mrn,
    ageBand: r.age_band,
    diag: r.diag_1_group,
    probability: r.probability,
    tier: r.tier,
    status: outcomeStatus(r.outcome),
    date: r.created_at,
    inQueue: r.in_queue,
    search: [r.patient_name, r.mrn, id, r.diag_1_group, r.unit_bed, r.scored_by].join(' ').toLowerCase(),
  }
}

function fromQueue(p: QueuePatient): Row {
  return {
    key: `demo-${p.encounter_id}`,
    source: 'demo',
    id: p.encounter_id,
    href: `/patient/${p.encounter_id}`,
    name: null,
    mrn: null,
    ageBand: p.age_band,
    diag: p.diag_1_group,
    probability: p.probability,
    tier: p.tier,
    status: decisionStatus(p),
    date: null,
    inQueue: true,
    search: [p.encounter_id, p.diag_1_group].join(' ').toLowerCase(),
  }
}

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function PatientsPage() {
  const [records, setRecords] = useState<RecordSummary[] | null>(null)
  const [queue, setQueue] = useState<QueuePatient[] | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<'all' | Source>('all')
  const [tier, setTier] = useState<'all' | Tier>('all')
  const [sort, setSort] = useState<'risk' | 'newest'>('risk')
  // set by the patient page after a delete
  const [deleted, setDeleted] = useState<string | null>(
    (useLocation().state as { deleted?: string } | null)?.deleted ?? null,
  )

  useEffect(() => {
    // load both independently so one failing doesn't hide the other
    listRecords().then(setRecords, (e: Error) => {
      setRecords([])
      setErrors((x) => [...x, `Saved records: ${e.message}`])
    })
    getQueue().then(
      (q) => setQueue(q.patients),
      (e: Error) => {
        setQueue([])
        setErrors((x) => [...x, `Demo queue: ${e.message}`])
      },
    )
  }, [])

  const all = useMemo(
    // saved records already in the queue come from `records`; take only demo patients from the queue
    () => [...(records ?? []).map(fromRecord), ...(queue ?? []).filter((p) => p.source === 'demo').map(fromQueue)],
    [records, queue],
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = all.filter(
      (r) => (source === 'all' || r.source === source) && (tier === 'all' || r.tier === tier) && (!q || r.search.includes(q)),
    )
    return filtered.sort((a, b) =>
      sort === 'newest'
        ? (b.date ?? '').localeCompare(a.date ?? '') || b.probability - a.probability
        : b.probability - a.probability,
    )
  }, [all, query, source, tier, sort])

  const loading = records === null || queue === null
  const savedCount = records?.length ?? 0
  const pending = records?.filter((r) => r.outcome === null).length ?? 0
  const highCount = all.filter((r) => r.tier === 'high').length

  return (
    <Stack gap="lg" className={classes.page}>
      <div>
        <Title order={1} fz={30} fw={800} lts={-0.5}>
          All patients
        </Title>
        <Text size="sm" c="gray.7" mt={4}>
          Records saved from Score one patient, plus today’s demo discharge queue. Open a patient to see why they were
          flagged{savedCount ? ' or to record their 30-day outcome' : ''}.
        </Text>
      </div>

      {deleted && (
        <Alert variant="light" color="brand" withCloseButton onClose={() => setDeleted(null)}>
          Deleted <strong>{deleted}</strong> and their follow-up decisions.
        </Alert>
      )}

      {errors.map((e) => (
        <Alert key={e} variant="light" color="red" title="Could not load every patient">
          {e}
        </Alert>
      ))}

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <Stat label="Patients" value={loading ? '–' : all.length} />
        <Stat label="Saved records" value={loading ? '–' : savedCount} />
        <Stat label="Outcome pending" value={loading ? '–' : pending} hint="Saved records still waiting for the 30-day result" />
        <Stat label="High risk" value={loading ? '–' : highCount} />
      </SimpleGrid>

      <Group gap="sm" align="flex-end" wrap="wrap">
        <TextInput
          label="Search"
          placeholder="Name, MRN, encounter or diagnosis"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          w={{ base: '100%', sm: 300 }}
        />
        <div>
          <Text size="sm" fw={500} mb={4}>
            Source
          </Text>
          <SegmentedControl
            value={source}
            onChange={(v) => setSource(v as typeof source)}
            data={[
              { value: 'all', label: 'All' },
              { value: 'saved', label: 'Saved records' },
              { value: 'demo', label: 'Demo queue' },
            ]}
          />
        </div>
        <Select
          label="Risk tier"
          value={tier}
          onChange={(v) => setTier((v ?? 'all') as typeof tier)}
          data={[
            { value: 'all', label: 'All tiers' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
          allowDeselect={false}
          w={140}
        />
        <Select
          label="Sort by"
          value={sort}
          onChange={(v) => setSort((v ?? 'risk') as typeof sort)}
          data={[
            { value: 'risk', label: 'Highest risk' },
            { value: 'newest', label: 'Newest saved' },
          ]}
          allowDeselect={false}
          w={160}
        />
      </Group>

      <div className={classes.tableWrap}>
        {loading ? (
          <Group justify="center" p="xl">
            <Loader size="sm" color="brand" />
          </Group>
        ) : (
          <Table.ScrollContainer minWidth={980}>
            <Table verticalSpacing="sm" horizontalSpacing="md" className={classes.table}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Patient</Table.Th>
                  <Table.Th>ID</Table.Th>
                  <Table.Th>Source</Table.Th>
                  <Table.Th>
                    <AgeBandLabel />
                  </Table.Th>
                  <Table.Th>Primary dx group</Table.Th>
                  <Table.Th>Risk</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Saved</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.key} style={{ '--tier': TIER_COLOR[r.tier] } as CSSProperties}>
                    <Table.Td>
                      {r.name ? (
                        <Text size="sm" fw={600}>
                          {r.name}
                        </Text>
                      ) : (
                        <Text size="sm" c="gray.6" fs="italic">
                          Not recorded
                        </Text>
                      )}
                      {r.mrn && (
                        <Text size="xs" c="gray.7">
                          {r.mrn}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Link to={r.href} state={{ from: '/patients' }} className={classes.idLink}>
                        {r.id}
                      </Link>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <span className={classes.source} data-source={r.source}>
                          {SOURCE_LABEL[r.source]}
                        </span>
                        {r.source === 'saved' && r.inQueue && <span className={classes.queueTag}>In queue</span>}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <AgeBand band={r.ageBand} />
                    </Table.Td>
                    <Table.Td>{r.diag}</Table.Td>
                    <Table.Td>
                      <Group gap={8} wrap="nowrap">
                        <span className={classes.prob}>{r.probability.toFixed(2)}</span>
                        <span className={classes.badge}>{TIER_LABEL[r.tier]}</span>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <span className={classes.status} data-kind={r.status.kind}>
                        {r.status.label}
                      </span>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c={r.date ? undefined : 'gray.6'}>
                        {r.date ? dateFmt.format(new Date(r.date)) : '—'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {!rows.length && (
                  <Table.Tr>
                    <Table.Td colSpan={8} py="xl">
                      <Text size="sm" c="gray.7" ta="center">
                        {source === 'saved' && !savedCount ? (
                          <>
                            No saved records yet. Score a patient on{' '}
                            <Anchor component={Link} to="/score" c="brand.7" fw={600}>
                              Score one patient
                            </Anchor>{' '}
                            and press <strong>Add to dataset</strong>.
                          </>
                        ) : (
                          'No patients match these filters.'
                        )}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </div>

      {!loading && (
        <Text size="xs" c="gray.6">
          Showing {rows.length} of {all.length}. Demo queue patients come from the de-identified UCI dataset, so they
          have no name or saved date.
        </Text>
      )}
    </Stack>
  )
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className={classes.stat} title={hint}>
      <Text size="sm" c="gray.8">
        {label}
      </Text>
      <div className={classes.statValue}>{value}</div>
    </div>
  )
}
