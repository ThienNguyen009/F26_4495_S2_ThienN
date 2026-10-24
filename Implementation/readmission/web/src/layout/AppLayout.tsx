import { Button, Group, ScrollArea, Text } from '@mantine/core'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { logout } from '../api/auth'
import { useUser } from '../components/userContext'
import classes from './AppLayout.module.css'
import { NAV } from './nav'

// Shared shell for signed-in pages: brand + tabs on top, page content below.
export function AppLayout() {
  const user = useUser()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  async function handleSignOut() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <Group component="header" className={classes.header} justify="space-between" wrap="nowrap">
        <ScrollArea type="never" style={{ flex: 1 }}>
          <Group gap={4} wrap="nowrap">
            <span className={classes.brand}>Discharge Risk Console</span>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={classes.tab}
                aria-current={item.also?.includes(pathname) ? 'page' : undefined}
              >
                {item.label}
              </NavLink>
            ))}
          </Group>
        </ScrollArea>
        <Group gap="sm" wrap="nowrap" visibleFrom="sm">
          <Text size="sm" c="gray.7">
            {user.fullName}
          </Text>
          <Button variant="default" size="xs" radius="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </Group>
      </Group>
      <main className={classes.main}>
        <Outlet />
      </main>
    </>
  )
}
