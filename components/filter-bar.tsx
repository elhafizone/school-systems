import { Button, Card, Input, Select } from '@/components/ui'
import Link from 'next/link'

export interface FilterField {
  name: string
  label: string
  type: 'search' | 'select' | 'date'
  value?: string
  options?: Array<{ value: string; label: string }>
  placeholder?: string
}

/**
 * Server-side search and filtering.
 *
 * A plain GET form: the browser builds the query string, the server does the
 * filtering, and the result is a real URL an administrator can bookmark or
 * share. No client JavaScript, and no possibility of pulling the whole student
 * body into the browser to filter it there.
 */
export function FilterBar({
  action,
  fields,
  hasFilters,
}: {
  action: string
  fields: FilterField[]
  hasFilters: boolean
}) {
  return (
    <Card className="mb-4 p-4">
      <form method="get" action={action} className="flex flex-wrap items-end gap-3">
        {fields.map((field) => (
          <div key={field.name} className="min-w-0 flex-1 basis-48">
            <label
              htmlFor={`filter-${field.name}`}
              className="mb-1.5 block text-sm font-medium text-ink-700"
            >
              {field.label}
            </label>

            {field.type === 'select' ? (
              <Select id={`filter-${field.name}`} name={field.name} defaultValue={field.value ?? ''}>
                <option value="">All</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id={`filter-${field.name}`}
                name={field.name}
                type={field.type === 'date' ? 'date' : 'search'}
                defaultValue={field.value ?? ''}
                placeholder={field.placeholder}
              />
            )}
          </div>
        ))}

        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            Apply
          </Button>
          {hasFilters && (
            <Link
              href={action}
              className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-ink-700 hover:underline"
            >
              Clear
            </Link>
          )}
        </div>
      </form>
    </Card>
  )
}
