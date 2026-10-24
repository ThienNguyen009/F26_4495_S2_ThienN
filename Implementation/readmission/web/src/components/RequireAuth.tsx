import { Center, Loader } from '@mantine/core'
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { clearToken, getToken, me, type User } from '../api/auth'
import { UserContext } from './userContext'

// Checks the stored token with /auth/me; sends the visitor to /login if it's missing or invalid.
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [user, setUser] = useState<User | null>(null)
  const [failed, setFailed] = useState(!getToken())

  useEffect(() => {
    if (failed) return
    me()
      .then(setUser)
      .catch(() => {
        clearToken()
        setFailed(true)
      })
  }, [failed])

  if (failed) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!user) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    )
  }
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}
