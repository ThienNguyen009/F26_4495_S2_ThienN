import { Box, Flex, Group, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

type Props = { title: string; subtitle: string; children: ReactNode }

// Split screen: black brand panel on the left (hidden on mobile), white form panel on the right.
export function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <Flex mih="100vh">
      

      <Flex flex={1} align="center" justify="center" p="xl" bg="white">
        <Box w="100%" maw={400}>
          <Group gap={10} mb={40}>
            <Box w={12} h={12} bg="brand.7" style={{ borderRadius: 3 }} />
            <Text fw={800} size="lg">
              Discharge Risk Console
            </Text>
          </Group>
          <Stack gap={4} mb={32}>
            <Title order={2}>
              {title}
            </Title>
            <Text c="ink.6" size="sm">
              {subtitle}
            </Text>
          </Stack>
          {children}
        </Box>
      </Flex>
    </Flex>
  )
}
