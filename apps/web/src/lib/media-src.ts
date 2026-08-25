import { API_URL } from './backend'

function uploadFileName(url: string): string | undefined {
  return url.match(/\/(?:api\/)?uploads\/([^/?#]+)$/)?.[1]
}

/** Same-origin BFF URL for signed-in pages. */
export function toMediaSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const file = uploadFileName(url)
  return file ? `/api/proxy/uploads/${file}` : url
}

/** Direct Nest URL for public pages (vendor profile, logged-out). */
export function toPublicMediaSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const file = uploadFileName(url)
  return file ? `${API_URL}/api/uploads/${file}` : url
}

export function lookCoverSrc(
  item:
    | {
        imageUrl?: string | null
        coverUrl?: string | null
        media?: { url: string; isCover?: boolean; mediaType?: string }[]
      }
    | null
    | undefined,
): string | undefined {
  if (!item) return undefined
  const media = item.media ?? []
  const cover =
    item.coverUrl ??
    item.imageUrl ??
    media.find((m) => m.isCover)?.url ??
    media.find((m) => m.mediaType !== 'EXTERNAL')?.url ??
    media[0]?.url
  return toMediaSrc(cover)
}
