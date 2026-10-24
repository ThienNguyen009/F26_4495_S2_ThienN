import { Text, Title } from '@mantine/core'

// Placeholder for console tabs that aren't built yet.
export function ComingSoonPage({ title }: { title: string }) {
  return (
    <>
      <Title order={1} fz={30} fw={800} lts={-0.5}>
        {title}
      </Title>
      <Text size="sm" c="gray.7" mt={4}>
        This view isn’t built yet.
      </Text>
    </>
  )
}
