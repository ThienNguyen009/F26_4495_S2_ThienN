import { Alert, Anchor, Button, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { hasLength, isEmail, isNotEmpty, matchesField, useForm } from '@mantine/form'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { AuthLayout } from '../components/AuthLayout'

export function RegisterPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { fullName: '', organization: '', email: '', password: '', confirmPassword: '' },
    validate: {
      fullName: isNotEmpty('Full name is required'),
      email: isEmail('Enter a valid email'),
      password: hasLength({ min: 8 }, 'Password must be at least 8 characters'),
      confirmPassword: matchesField('password', 'Passwords do not match'),
    },
  })

  async function handleSubmit(values: typeof form.values) {
    setLoading(true)
    setError(null)
    try {
      const { fullName, organization, email, password } = values
      await register({ fullName, organization, email, password })
      navigate('/login', { state: { registered: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Create account" subtitle="Register to start screening discharges.">
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap="md">
          {error && (
            <Alert variant="light" color="red" title="Registration failed">
              {error}
            </Alert>
          )}
          <TextInput
            label="Full name"
            placeholder="Jane Doe"
            autoComplete="name"
            key={form.key('fullName')}
            {...form.getInputProps('fullName')}
          />
          <TextInput
            label="Organization"
            placeholder="Hospital or clinic (optional)"
            autoComplete="organization"
            key={form.key('organization')}
            {...form.getInputProps('organization')}
          />
          <TextInput
            label="Email"
            placeholder="thiennguyen1120@gmail.com"
            autoComplete="email"
            key={form.key('email')}
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            key={form.key('password')}
            {...form.getInputProps('password')}
          />
          <PasswordInput
            label="Confirm password"
            placeholder="Repeat your password"
            autoComplete="new-password"
            key={form.key('confirmPassword')}
            {...form.getInputProps('confirmPassword')}
          />
          <Button type="submit" fullWidth size="md" loading={loading} tt="uppercase">
            Create account
          </Button>
          <Text size="sm" ta="center">
            Already registered?{' '}
            <Anchor component={Link} to="/login" fw={700} underline="always">
              Sign in
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  )
}
