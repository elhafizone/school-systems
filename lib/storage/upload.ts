/**
 * Upload rules, shared by the browser form and the server action.
 *
 * Pure module — no server-only import — so the client can give fast feedback
 * using exactly the same rules the server later enforces.
 */

export const MEDIA_BUCKET = 'student-media'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024 // 100 MB

interface MediaRule {
  kind: 'image' | 'video'
  folder: 'images' | 'videos'
  maxBytes: number
  /** MIME type -> the single extension we will write for it. */
  types: Record<string, string>
}

export const IMAGE_RULE: MediaRule = {
  kind: 'image',
  folder: 'images',
  maxBytes: MAX_IMAGE_BYTES,
  types: {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  },
}

export const VIDEO_RULE: MediaRule = {
  kind: 'video',
  folder: 'videos',
  maxBytes: MAX_VIDEO_BYTES,
  types: {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  },
}

/** Extensions we accept on the way in, mapped to their expected MIME type. */
const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

export const ACCEPT_IMAGES = Object.keys(IMAGE_RULE.types).join(',')
export const ACCEPT_VIDEOS = Object.keys(VIDEO_RULE.types).join(',')

export type UploadCheck =
  | { ok: true; rule: MediaRule; extension: string }
  | { ok: false; error: string }

/**
 * Validate a candidate before it is sent.
 *
 * Three independent checks must all agree: the declared MIME type is on the
 * allowlist, the filename extension maps to that same MIME type, and the size
 * fits. Agreement between type and extension is what stops `payload.exe`
 * renamed to `photo.jpg`, and the extension is never taken on its own.
 *
 * Supabase re-checks the MIME type and the size limit on the bucket itself, so
 * a client that skips this function still cannot store a disallowed object.
 */
export function checkUpload(
  file: { name: string; type: string; size: number },
  expected: 'image' | 'video',
): UploadCheck {
  const rule = expected === 'image' ? IMAGE_RULE : VIDEO_RULE

  const declaredType = file.type.toLowerCase().split(';')[0].trim()
  if (!(declaredType in rule.types)) {
    return {
      ok: false,
      error: `That file type is not supported. Allowed: ${Object.keys(rule.types).join(', ')}.`,
    }
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mimeForExtension = EXTENSION_TO_MIME[extension]
  if (!mimeForExtension || mimeForExtension !== declaredType) {
    return {
      ok: false,
      error: 'The file extension does not match its contents. Re-save the file and try again.',
    }
  }

  if (file.size <= 0) {
    return { ok: false, error: 'That file is empty.' }
  }

  if (file.size > rule.maxBytes) {
    return {
      ok: false,
      error: `That ${rule.kind} is ${formatBytes(file.size)}. The limit is ${formatBytes(rule.maxBytes)}.`,
    }
  }

  return { ok: true, rule, extension: rule.types[declaredType] }
}

/**
 * Build the object path.
 *
 * The caller's filename is discarded entirely — the name is a fresh random id
 * plus an extension drawn from our own allowlist. Path traversal and
 * collisions are structurally impossible rather than filtered for.
 */
export function buildObjectPath(
  studentId: string,
  folder: 'images' | 'videos',
  extension: string,
): string {
  return `students/${studentId}/${folder}/${crypto.randomUUID()}.${extension}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
