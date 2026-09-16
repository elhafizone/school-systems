import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import Link from 'next/link'

/**
 * Shared primitives.
 *
 * Plain server components with no client-side state, so they add nothing to
 * the JS bundle. Anything interactive lives in its own 'use client' module.
 */

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-ink-300',
  secondary:
    'bg-white text-ink-900 border border-ink-300 hover:bg-ink-50 disabled:text-ink-500',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 disabled:bg-ink-300',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-100',
}

const SIZES: Record<Size, string> = {
  // 44px min height across the board: a comfortable touch target for a
  // teacher tapping through this on a phone mid-lesson.
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-11 px-4 text-base',
  lg: 'min-h-12 px-5 text-base',
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-[--radius-control] font-medium transition-colors disabled:cursor-not-allowed'

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button className={cn(BUTTON_BASE, VARIANTS[variant], SIZES[size], className)} {...props} />
  )
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}) {
  return (
    <Link href={href} className={cn(BUTTON_BASE, VARIANTS[variant], SIZES[size], className)}>
      {children}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

const CONTROL =
  'w-full rounded-[--radius-control] border border-ink-300 bg-white px-3 py-2.5 text-base text-ink-900 placeholder:text-ink-500 disabled:bg-ink-50'

/**
 * Label + control + help/error, wired together.
 *
 * `htmlFor`/`id` and `aria-describedby` are assembled here rather than left to
 * each caller, so a screen reader always reaches the error text and it can't
 * be forgotten on one form out of twenty.
 */
export function Field({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: (ariaProps: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-700">
        {label}
        {required && (
          <span className="text-danger-700" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        ...(error ? { 'aria-invalid': true as const } : {}),
      })}
      {hint && (
        <p id={hintId} className="text-sm text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger-700">
          {error}
        </p>
      )}
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, 'min-h-28 resize-y', className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(CONTROL, 'appearance-none pr-8', className)} {...props} />
}

// ---------------------------------------------------------------------------
// Surfaces and feedback
// ---------------------------------------------------------------------------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-ink-100 bg-white', className)}>{children}</div>
  )
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {description && <p className="mt-1 text-ink-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
      )}
    >
      {children}
    </span>
  )
}

/**
 * Inline message. `role="alert"` on the error tone so assistive tech announces
 * a failed submission without the user having to go hunting for it.
 */
export function Alert({
  tone = 'danger',
  title,
  children,
}: {
  tone?: 'danger' | 'success' | 'warning'
  title?: string
  children?: ReactNode
}) {
  const styles = {
    danger: 'border-danger-600/30 bg-danger-50 text-danger-700',
    success: 'border-success-700/30 bg-success-50 text-success-700',
    warning: 'border-warning-700/30 bg-warning-50 text-warning-700',
  }[tone]

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-[--radius-control] border px-4 py-3 text-sm', styles)}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-ink-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Avatar — initials placeholder used wherever a photo is absent
// ---------------------------------------------------------------------------

export function Initials({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || '?'}
    </span>
  )
}
