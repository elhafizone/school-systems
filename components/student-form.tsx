'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Alert, Button, Field, Input, Select } from '@/components/ui'
import { saveStudentAction, type ActionResult } from '@/app/admin/actions'
import type { SchoolClass, Student } from '@/lib/types/database'

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  )
}

/** Create and edit share one form; the presence of `student` decides which. */
export function StudentForm({
  student,
  classes,
}: {
  student?: Student
  classes: SchoolClass[]
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(saveStudentAction, {
    ok: false,
  })
  const router = useRouter()

  useEffect(() => {
    if (state.ok) router.push('/admin/students')
  }, [state.ok, router])

  return (
    <form action={formAction} className="max-w-xl space-y-5" noValidate>
      {student && <input type="hidden" name="id" value={student.id} />}

      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <Field
        id="full_name"
        label="Full name"
        required
        hint="As it should appear to teachers and parents."
      >
        {(aria) => (
          <Input {...aria} name="full_name" defaultValue={student?.full_name} required maxLength={120} />
        )}
      </Field>

      <Field
        id="student_code"
        label="Student code"
        required
        hint="The school's own reference, e.g. 2026-014. Letters, numbers, - and _."
      >
        {(aria) => (
          <Input
            {...aria}
            name="student_code"
            defaultValue={student?.student_code}
            required
            maxLength={32}
          />
        )}
      </Field>

      <Field id="class_id" label="Class">
        {(aria) => (
          <Select {...aria} name="class_id" defaultValue={student?.class_id ?? ''}>
            <option value="">Not assigned</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.name} · {schoolClass.grade} · {schoolClass.academic_year}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="date_of_birth" label="Date of birth">
          {(aria) => (
            <Input
              {...aria}
              name="date_of_birth"
              type="date"
              defaultValue={student?.date_of_birth ?? ''}
            />
          )}
        </Field>

        <Field id="gender" label="Gender">
          {(aria) => (
            <Select {...aria} name="gender" defaultValue={student?.gender ?? ''}>
              <option value="">Not recorded</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </Select>
          )}
        </Field>
      </div>

      <div className="flex gap-3">
        <Submit label={student ? 'Save changes' : 'Add student'} />
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
