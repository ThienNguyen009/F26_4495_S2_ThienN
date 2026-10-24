import { Alert, Anchor, Button, Checkbox, Group, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { isEmail, isNotEmpty, useForm } from '@mantine/form'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { AuthLayout } from '../components/AuthLayout'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { registered?: boolean; from?: string } | null
  const registered = state?.registered
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: '', password: '', remember: false },
    validate: {
      email: isEmail('Enter a valid email'),
      password: isNotEmpty('Password is required'),
    },
  })

  async function handleSubmit(values: typeof form.values) {
    setLoading(true)
    setError(null)
    try {
      const { access_token } = await login({ email: values.email, password: values.password })
      const storage = values.remember ? localStorage : sessionStorage
      storage.setItem('token', access_token)
      navigate(state?.from ?? '/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back. Enter your credentials to continue.">
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap="md">
          {registered && !error && (
            <Alert variant="light" color="brand">
              Account created. You can sign in now.
            </Alert>
          )}
          {error && (
            <Alert variant="light" color="red" title="Sign in failed">
              {error}
            </Alert>
          )}
          <TextInput
            label="Email"
            placeholder="thiennguyen1120@gmail.com"
            autoComplete="email"
            key={form.key('email')}
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            placeholder="Your password"
            autoComplete="current-password"
            key={form.key('password')}
            {...form.getInputProps('password')}
          />
          <Group justify="space-between">
            <Checkbox
              label="Remember me"
              key={form.key('remember')}
              {...form.getInputProps('remember', { type: 'checkbox' })}
            />
          </Group>
          <Button type="submit" fullWidth size="md" loading={loading} tt="uppercase">
            Sign in
          </Button>
          <Text size="sm" ta="center">
            No account?{' '}
            <Anchor component={Link} to="/register" fw={700} underline="always">
              Create one
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  )
}
