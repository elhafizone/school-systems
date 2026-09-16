import { Badge, Card, Initials } from '@/components/ui'
import { createSignedUrl } from '@/lib/storage/media'
import type { Profile, StudentWithClass } from '@/lib/types/database'

/**
 * Identity block at the top of a student profile.
 *
 * Guardian details are passed in only by the admin view. Teachers and parents
 * never receive them, so a parent cannot see the other families in a class and
 * a teacher cannot mine guardian contact details from a profile page.
 */
export async function StudentSummary({
  student,
  guardians,
}: {
  student: StudentWithClass
  guardians?: Array<{ relationship: string; profile: Profile }>
}) {
  const photoUrl = student.photo_url ? await createSignedUrl(student.photo_url) : null

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-4">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`Photo of ${student.full_name}`}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <Initials name={student.full_name} size={64} />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-ink-900">
              {student.full_name}
            </h1>
            {!student.is_active && <Badge tone="warning">Inactive</Badge>}
          </div>

          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Detail label="Student code" value={student.student_code} />
            <Detail
              label="Class"
              value={
                student.classes
                  ? `${student.classes.name} · ${student.classes.grade}`
                  : 'Not assigned'
              }
            />
            {student.date_of_birth && (
              <Detail label="Date of birth" value={formatDate(student.date_of_birth)} />
            )}
            {student.gender && (
              <Detail label="Gender" value={student.gender === 'male' ? 'Male' : 'Female'} />
            )}
          </dl>
        </div>
      </div>

      {guardians && guardians.length > 0 && (
        <div className="mt-4 border-t border-ink-100 pt-4">
          <h2 className="text-sm font-medium text-ink-700">Parents and guardians</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {guardians.map(({ relationship, profile }) => (
              <li key={profile.id} className="text-ink-700">
                <span className="font-medium text-ink-900">{profile.full_name}</span>{' '}
                <span className="text-ink-500">({relationship})</span>
                {profile.phone && <span className="text-ink-500"> · {profile.phone}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-ink-500">{label}:</dt>
      <dd className="min-w-0 truncate font-medium text-ink-900">{value}</dd>
    </div>
  )
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
