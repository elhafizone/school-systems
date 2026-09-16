'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { loginAction, type LoginState } from '@/app/login/actions'
import { Alert, Button, Field, Input } from '@/components/ui'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  )
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {})

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <Field id="email" label="Email address" required>
        {(aria) => (
          <Input
            {...aria}
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        )}
      </Field>

      <Field id="password" label="Password" required>
        {(aria) => (
          <Input {...aria} name="password" type="password" autoComplete="current-password" required />
        )}
      </Field>

      <SubmitButton />
    </form>
  )
}
