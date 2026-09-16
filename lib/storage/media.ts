import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { MEDIA_BUCKET } from '@/lib/storage/upload'

/**
 * Serving private media.
 *
 * Objects in student-media are never public. Display works by minting a signed
 * URL at render time, which expires on its own. The signing call goes through
 * the session-bound client, so Supabase applies the storage policies: a parent
 * asking to sign an object belonging to another family gets an error rather
 * than a URL. Authorization is therefore enforced at the moment of signing,
 * not merely by keeping the path secret.
 */

/** Short enough that a leaked URL stops working quickly, long enough to view. */
export const SIGNED_URL_TTL_SECONDS = 60 * 10

export async function createSignedUrl(
  storagePath: string,
  expiresIn: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error || !data) return null
  return data.signedUrl
}

/**
 * Sign many paths at once for a timeline render.
 *
 * Uses the batch endpoint so a page of twenty photos costs one request rather
 * than twenty. Paths the caller may not read come back without a URL and are
 * simply omitted from the map, which the UI renders as an unavailable item.
 */
export async function createSignedUrls(
  storagePaths: string[],
  expiresIn: number = SIGNED_URL_TTL_SECONDS,
): Promise<Map<string, string>> {
  const unique = [...new Set(storagePaths.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(unique, expiresIn)

  if (error || !data) return new Map()

  const map = new Map<string, string>()
  for (const entry of data) {
    if (entry.signedUrl && entry.path) map.set(entry.path, entry.signedUrl)
  }
  return map
}

/**
 * Read an object's true size and content type from storage.
 *
 * Used when recording an upload so the database stores what the storage layer
 * actually received, not what the browser claimed it was sending.
 */
export async function statObject(
  storagePath: string,
): Promise<{ size: number; mimeType: string } | null> {
  const supabase = await createClient()

  const lastSlash = storagePath.lastIndexOf('/')
  const folder = storagePath.slice(0, lastSlash)
  const filename = storagePath.slice(lastSlash + 1)

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list(folder, { search: filename, limit: 1 })

  if (error || !data || data.length === 0) return null

  const found = data.find((o) => o.name === filename)
  if (!found) return null

  const meta = found.metadata as { size?: number; mimetype?: string } | null
  if (!meta?.size || !meta.mimetype) return null

  return { size: meta.size, mimeType: meta.mimetype }
}

/** Remove an object. Storage policies decide whether the caller may. */
export async function removeObject(storagePath: string): Promise<void> {
  const supabase = await createClient()
  await supabase.storage.from(MEDIA_BUCKET).remove([storagePath])
}
