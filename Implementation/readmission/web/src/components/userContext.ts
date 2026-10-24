import { createContext, useContext } from 'react'
import type { User } from '../api/auth'

export const UserContext = createContext<User | null>(null)

// Signed-in user for pages rendered inside <RequireAuth>.
export const useUser = () => useContext(UserContext)!
