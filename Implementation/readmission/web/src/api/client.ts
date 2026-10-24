import { getToken } from './token'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    // FastAPI sends a string for HTTPException and a list of errors for validation failures
    const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail
    throw new Error(detail ?? `Server returned ${res.status}`)
  }
  return res.json()
}

export const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) })
