'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Alert, Button, Card, Field, Input, Select } from '@/components/ui'
import {
  assignTeacherAction,
  createStaffAccountAction,
  linkParentAction,
  saveClassAction,
  type ActionResult,
} from '@/app/admin/actions'
import type { Profile, SchoolClass, Student } from '@/lib/types/database'

const EMPTY: ActionResult = { ok: false }

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  )
}

/**
 * Reset the form and refresh the list once the server confirms a write.
 * Keeps every create form on this page behaving the same way.
 */
function useResetOnSuccess(ok: boolean) {
  const ref = useRef<HTMLFormElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (ok) {
      ref.current?.reset()
      router.refresh()
    }
  }, [ok, router])

  return ref
}

// ---------------------------------------------------------------------------

export function ClassForm() {
  const [state, action] = useActionState<ActionResult, FormData>(saveClassAction, EMPTY)
  const formRef = useResetOnSuccess(state.ok)
  const thisYear = new Date().getFullYear()

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-base font-semibold text-ink-900">Add a class</h2>
      <form ref={formRef} action={action} className="space-y-4" noValidate>
        {state.error && <Alert tone="danger">{state.error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="class-name" label="Class name" required>
            {(aria) => <Input {...aria} name="name" required maxLength={80} placeholder="Willow" />}
          </Field>

          <Field id="class-grade" label="Grade" required>
            {(aria) => <Input {...aria} name="grade" required maxLength={40} placeholder="Year 3" />}
          </Field>

          <Field id="class-year" label="Academic year" required>
            {(aria) => (
              <Input
                {...aria}
                name="academic_year"
                required
                defaultValue={`${thisYear}-${thisYear + 1}`}
                placeholder={`${thisYear}-${thisYear + 1}`}
              />
            )}
          </Field>
        </div>

        <Submit label="Add class" />
      </form>
    </Card>
  )
}

// ---------------------------------------------------------------------------

export function StaffAccountForm({ role }: { role: 'teacher' | 'parent' }) {
  const [state, action] = useActionState<ActionResult, FormData>(createStaffAccountAction, EMPTY)
  const formRef = useResetOnSuccess(state.ok)
  const noun = role === 'teacher' ? 'teacher' : 'parent'

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-base font-semibold text-ink-900">Add a {noun}</h2>

      <form ref={formRef} action={action} className="space-y-4" noValidate>
        {state.error && <Alert tone="danger">{state.error}</Alert>}
        {state.ok && <Alert tone="success">Account created. Share the password securely.</Alert>}

        <input type="hidden" name="role" value={role} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${role}-name`} label="Full name" required>
            {(aria) => <Input {...aria} name="full_name" required maxLength={120} />}
          </Field>

          <Field id={`${role}-email`} label="Email address" required>
            {(aria) => (
              <Input
                {...aria}
                name="email"
                type="email"
                required
                autoCapitalize="none"
                spellCheck={false}
              />
            )}
          </Field>

          <Field id={`${role}-phone`} label="Phone" hint="Optional">
            {(aria) => <Input {...aria} name="phone" type="tel" maxLength={30} />}
          </Field>

          <Field
            id={`${role}-password`}
            label="Temporary password"
            required
            hint="At least 10 characters. Give it to them in person or by phone, not by email."
          >
            {(aria) => <Input {...aria} name="password" type="text" required minLength={10} />}
          </Field>
        </div>

        <Submit label={`Create ${noun} account`} />
      </form>
    </Card>
  )
}

// ---------------------------------------------------------------------------

export function AssignTeacherForm({
  classId,
  teachers,
}: {
  classId: string
  teachers: Profile[]
}) {
  const [state, action] = useActionState<ActionResult, FormData>(assignTeacherAction, EMPTY)
  const formRef = useResetOnSuccess(state.ok)

  return (
    <form ref={formRef} action={action} className="space-y-3" noValidate>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="class_id" value={classId} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <Field id="assign-teacher" label="Assign a teacher">
            {(aria) => (
              <Select {...aria} name="teacher_id" required defaultValue="">
                <option value="" disabled>
                  Choose a teacher
                </option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Submit label="Assign" />
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------

export function LinkParentForm({
  parentId,
  students,
}: {
  parentId: string
  students: Student[]
}) {
  const [state, action] = useActionState<ActionResult, FormData>(linkParentAction, EMPTY)
  const formRef = useResetOnSuccess(state.ok)

  return (
    <form ref={formRef} action={action} className="space-y-3" noValidate>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="parent_id" value={parentId} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <Field id={`link-student-${parentId}`} label="Link to student">
            {(aria) => (
              <Select {...aria} name="student_id" required defaultValue="">
                <option value="" disabled>
                  Choose a student
                </option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name} · {student.student_code}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="basis-40">
          <Field id={`link-rel-${parentId}`} label="Relationship">
            {(aria) => (
              <Select {...aria} name="relationship" defaultValue="guardian">
                <option value="mother">Mother</option>
                <option value="father">Father</option>
                <option value="guardian">Guardian</option>
              </Select>
            )}
          </Field>
        </div>

        <Submit label="Link" />
      </div>
    </form>
  )
}
