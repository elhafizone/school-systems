'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Card, Field, Input, Textarea, cn } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { addNoteAction, prepareUploadAction, recordMediaAction } from '@/lib/actions/content'
import {
  ACCEPT_IMAGES,
  ACCEPT_VIDEOS,
  MEDIA_BUCKET,
  checkUpload,
  formatBytes,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
} from '@/lib/storage/upload'

type Mode = 'photo' | 'video' | 'note'

/**
 * The teacher's primary tool.
 *
 * Optimised for the common case: open a student, tap one of three buttons,
 * capture or pick, save. The title and description stay optional so a photo
 * can be filed in two taps, and the form is never a multi-step wizard.
 */
export function AddContent({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [mode, setMode] = useState<Mode>('photo')

  return (
    <Card className="p-4">
      <h2 className="text-base font-semibold text-ink-900">Add to {studentName}&rsquo;s timeline</h2>

      <div role="tablist" aria-label="Type of entry" className="mt-3 flex gap-2">
        {(['photo', 'video', 'note'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              'min-h-11 flex-1 rounded-[--radius-control] border px-3 text-sm font-medium capitalize',
              mode === m
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-ink-300 bg-white text-ink-700 hover:bg-ink-50',
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {mode === 'note' ? (
          <NoteForm studentId={studentId} />
        ) : (
          <MediaForm key={mode} studentId={studentId} kind={mode === 'photo' ? 'image' : 'video'} />
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------

function NoteForm({ studentId }: { studentId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('student_id', studentId)
    setError(null)

    startTransition(async () => {
      const result = await addNoteAction({ ok: false }, formData)
      if (result.ok) {
        formRef.current?.reset()
        router.refresh()
      } else {
        setError(result.error ?? 'The note could not be saved.')
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      <Field id="note-title" label="Title" hint="Optional">
        {(aria) => <Input {...aria} name="title" maxLength={160} />}
      </Field>

      <Field id="note-body" label="Note" required>
        {(aria) => (
          <Textarea {...aria} name="description" required maxLength={4000} rows={4} />
        )}
      </Field>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? 'Saving…' : 'Save note'}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------

function MediaForm({ studentId, kind }: { studentId: string; kind: 'image' | 'video' }) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  const isImage = kind === 'image'
  const limit = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null
    setError(null)

    if (!picked) {
      setFile(null)
      return
    }

    // Same rules the server applies, run here purely for immediate feedback.
    const check = checkUpload(picked, kind)
    if (!check.ok) {
      setFile(null)
      setError(check.error)
      event.target.value = ''
      return
    }

    setFile(picked)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || busy) return

    const formData = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)

    try {
      // 1. Ask the server to authorize and name the object.
      const prepared = await prepareUploadAction({
        studentId,
        kind,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      })

      if (!prepared.ok || !prepared.path) {
        setError(prepared.error ?? 'That file could not be uploaded.')
        return
      }

      // 2. Send the bytes straight to storage. Going direct keeps a 100 MB
      //    video off the application server entirely; the storage policy still
      //    checks this teacher against this student before accepting it.
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(prepared.path, file, { contentType: file.type, upsert: false })

      if (uploadError) {
        setError('The upload did not complete. Check your connection and try again.')
        return
      }

      // 3. Record it, with size and type read back from storage server-side.
      const recorded = await recordMediaAction({
        studentId,
        storagePath: prepared.path,
        kind,
        title: (formData.get('title') as string) ?? null,
        description: (formData.get('description') as string) ?? null,
      })

      if (!recorded.ok) {
        setError(recorded.error ?? 'The upload could not be saved.')
        return
      }

      formRef.current?.reset()
      setFile(null)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      {isImage ? (
        <div className="grid grid-cols-2 gap-2">
          {/*
            Two entry points on purpose. `capture` opens the camera directly,
            which is what a teacher wants mid-lesson; without it they can pick
            something taken earlier. Offering both avoids the common trap of
            forcing one and stranding the other.
          */}
          <FilePicker
            id="take-photo"
            label="Take photo"
            accept={ACCEPT_IMAGES}
            capture="environment"
            onChange={onPick}
          />
          <FilePicker
            id="choose-photo"
            label="Choose photo"
            accept={ACCEPT_IMAGES}
            onChange={onPick}
          />
        </div>
      ) : (
        <FilePicker id="choose-video" label="Choose video" accept={ACCEPT_VIDEOS} onChange={onPick} />
      )}

      <p className="text-sm text-ink-500">
        {isImage ? 'JPG, PNG, WebP or HEIC' : 'MP4, MOV or WebM'}, up to {formatBytes(limit)}.
      </p>

      {file && (
        <p className="rounded-[--radius-control] bg-ink-50 px-3 py-2 text-sm text-ink-700">
          Selected: <span className="font-medium">{file.name}</span> ({formatBytes(file.size)})
        </p>
      )}

      <Field id="media-title" label="Title" hint="Optional">
        {(aria) => <Input {...aria} name="title" maxLength={160} />}
      </Field>

      <Field id="media-description" label="Description" hint="Optional">
        {(aria) => <Textarea {...aria} name="description" maxLength={4000} rows={2} />}
      </Field>

      <Button type="submit" disabled={!file || busy} className="w-full sm:w-auto">
        {busy ? 'Uploading…' : `Save ${isImage ? 'photo' : 'video'}`}
      </Button>

      {busy && (
        <p role="status" className="text-sm text-ink-500">
          Uploading. Keep this page open until it finishes.
        </p>
      )}
    </form>
  )
}

function FilePicker({
  id,
  label,
  accept,
  capture,
  onChange,
}: {
  id: string
  label: string
  accept: string
  capture?: 'environment' | 'user'
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center justify-center rounded-[--radius-control] border border-ink-300 bg-white px-3 text-sm font-medium text-ink-900 hover:bg-ink-50"
    >
      {label}
      <input
        id={id}
        type="file"
        accept={accept}
        capture={capture}
        onChange={onChange}
        className="sr-only"
      />
    </label>
  )
}
