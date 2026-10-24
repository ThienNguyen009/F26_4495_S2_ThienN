import { post, request } from './client'
import { clearToken } from './token'

export { clearToken, getToken } from './token'

export type LoginPayload = { email: string; password: string }
export type RegisterPayload = { fullName: string; organization: string; email: string; password: string }
export type User = { id: number; fullName: string; organization: string | null; email: string }

export const login = (payload: LoginPayload) => post<{ access_token: string }>('/auth/login', payload)
export const register = (payload: RegisterPayload) => post<{ id: number }>('/auth/register', payload)
export const me = () => request<User>('/auth/me')

export async function logout() {
  await post('/auth/logout', {}).catch(() => null) // sign out locally even if the server is down
  clearToken()
}
