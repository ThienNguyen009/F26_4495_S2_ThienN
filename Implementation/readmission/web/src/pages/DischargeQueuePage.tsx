import { Alert, Button, Group, Loader, Menu, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import { useEffect, useState, type CSSProperties } from 'react'
import { getQueue, type Queue, type QueuePatient } from '../api/queue'
import type { Tier } from '../api/scoring'
import classes from './DischargeQueuePage.module.css'

const TIERS: Tier[] = ['high', 'medium', 'low']
const TIER_LABEL: Record<Tier, string> = { high: 'High', medium: 'Medium', low: 'Low' }
const TIER_COLOR: Record<Tier, string> = { high: 'var(--risk-high)', medium: 'var(--risk-medium)', low: 'var(--risk-low)' }

const tierStyle = (tier: Tier) => ({ '--tier': TIER_COLOR[tier] }) as CSSProperties

function exportWorklist(rows: QueuePatient[]) {
  const header = ['encounter', 'age_band', 'primary_dx_group', 'los_days', 'prior_admissions', 'medications',
    'risk', 'tier', 'recommended_action']
  const lines = rows.map((r) => [r.encounter_id, r.age_band, r.diag_1_group, r.time_in_hospital, r.number_inpatient,
    r.num_medications, r.probability.toFixed(2), r.tier, `"${r.action}"`].join(','))
  const url = URL.createObjectURL(new Blob([[header.join(','), ...lines].join('\n') + '\n'], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `discharge_worklist_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function DischargeQueuePage() {
  const [queue, setQueue] = useState<Queue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Tier | 'all'>('all')

  useEffect(() => {
    getQueue().then(setQueue, (e: Error) => setError(e.message))
  }, [])

  const rows = queue?.patients.filter((p) => filter === 'all' || p.tier === filter) ?? []
  // bars are relative to the riskiest patient so the ranking stays readable at low base rates
  const maxRisk = Math.max(...(queue?.patients.map((p) => p.probability) ?? [0]), 0.01)

  return (
    <Stack gap="lg" className={classes.page}>
      <Group justify="space-between" align="flex-end" gap="md">
        <div>
          <Title order={1} fz={30} fw={800} lts={-0.5}>
            Discharges scheduled today
          </Title>
          <Text size="sm" c="gray.7" mt={4}>
            {queue ? `${queue.patients.length} patients` : 'Loading patients'} · demo cohort of held-out test
            encounters · sorted by predicted 30-day readmission risk
          </Text>
        </div>
        <Group gap="sm">
          <Menu position="bottom-end" shadow="sm">
            <Menu.Target>
              <Button variant="default" radius="md" disabled={!queue}>
                {filter === 'all' ? 'Filter' : `${TIER_LABEL[filter]} risk only`}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => setFilter('all')}>All patients</Menu.Item>
              {TIERS.map((t) => (
                <Menu.Item key={t} onClick={() => setFilter(t)} leftSection={<span className={classes.dot} style={tierStyle(t)} />}>
                  {TIER_LABEL[t]} risk
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          <Button radius="md" disabled={!rows.length} onClick={() => exportWorklist(rows)}>
            Export worklist
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert variant="light" color="red" title="Could not load the queue">
          {error}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            className={classes.stat}
            style={tierStyle(t)}
            data-active={filter === t || undefined}
            onClick={() => setFilter(filter === t ? 'all' : t)}
          >
            <Text size="sm" className={classes.statLabel}>
              <span className={classes.dot} />
              {TIER_LABEL[t]} risk
            </Text>
            <div className={classes.statValue}>{queue ? queue.counts[t] : '–'}</div>
            <Text size="xs" c="gray.7">
              {queue?.actions[t] ?? ' '}
            </Text>
          </button>
        ))}
        <div className={classes.stat}>
          <Text size="sm" className={classes.statLabel}>
            Expected readmissions
          </Text>
          <div className={classes.statValue}>{queue ? queue.expected_readmissions.toFixed(1) : '–'}</div>
          <Text size="xs" c="gray.7">
            Sum of predicted risk across today’s cohort
          </Text>
        </div>
      </SimpleGrid>

      <div className={classes.tableWrap}>
        {!queue && !error ? (
          <Group justify="center" p="xl">
            <Loader size="sm" color="brand" />
          </Group>
        ) : (
          <Table.ScrollContainer minWidth={900}>
            <Table verticalSpacing="sm" horizontalSpacing="md" className={classes.table}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Encounter</Table.Th>
                  <Table.Th>Age band</Table.Th>
                  <Table.Th>Primary dx group</Table.Th>
                  <Table.Th ta="right">LOS</Table.Th>
                  <Table.Th ta="right">Prior adm.</Table.Th>
                  <Table.Th ta="right">Meds</Table.Th>
                  <Table.Th>Risk</Table.Th>
                  <Table.Th>Recommended action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((p) => (
                  <Table.Tr key={p.encounter_id} style={tierStyle(p.tier)}>
                    <Table.Td className={classes.encounter}>{p.encounter_id}</Table.Td>
                    <Table.Td>{p.age_band}</Table.Td>
                    <Table.Td>{p.diag_1_group}</Table.Td>
                    <Table.Td ta="right">{p.time_in_hospital} d</Table.Td>
                    <Table.Td ta="right">{p.number_inpatient}</Table.Td>
                    <Table.Td ta="right">{p.num_medications}</Table.Td>
                    <Table.Td>
                      <Group gap={10} wrap="nowrap">
                        <span className={classes.bar}>
                          <span style={{ width: `${(p.probability / maxRisk) * 100}%` }} />
                        </span>
                        <span className={classes.prob}>{p.probability.toFixed(2)}</span>
                        <span className={classes.badge}>{TIER_LABEL[p.tier]}</span>
                      </Group>
                    </Table.Td>
                    <Table.Td>{p.action}</Table.Td>
                  </Table.Tr>
                ))}
                {queue && !rows.length && (
                  <Table.Tr>
                    <Table.Td colSpan={8} ta="center" c="gray.6" py="xl">
                      No patients in this tier today.
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </div>

      {queue && (
        <Text size="xs" c="gray.6">
          Scores come from the same model as Score one patient. High risk is {queue.high_threshold.toFixed(2)} or
          above and medium is {queue.medium_threshold.toFixed(2)} or above (the top 10% and next 10% of validation
          patients). Risk bars are scaled to the highest score in this cohort.
        </Text>
      )}
    </Stack>
  )
}
