// "Remember me" puts the token in localStorage, otherwise sessionStorage (see LoginPage).
export const getToken = () => localStorage.getItem('token') ?? sessionStorage.getItem('token')

export function clearToken() {
  localStorage.removeItem('token')
  sessionStorage.removeItem('token')
}
