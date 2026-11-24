import { Box, Flex, Group, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

type Props = { title: string; subtitle: string; children: ReactNode }

// Sign-in / register shell: the form sits in a rounded card on the same light background as the console.
export function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <Flex mih="100vh" align="center" justify="center" p="md" bg="gray.0">
      <Box
        w="100%"
        maw={440}
        p={{ base: 'lg', sm: 36 }}
        bg="white"
        bd="1px solid var(--mantine-color-gray-3)"
        style={{ borderRadius: 'var(--mantine-radius-md)' }}
      >
        <Group gap={10} mb={32}>
          <Box w={12} h={12} bg="brand.7" style={{ borderRadius: 3 }} />
          <Text fw={800} size="lg">
            Discharge Risk Console
          </Text>
        </Group>
        <Stack gap={4} mb={28}>
          <Title order={2}>{title}</Title>
          <Text c="gray.7" size="sm">
            {subtitle}
          </Text>
        </Stack>
        {children}
      </Box>
    </Flex>
  )
}
