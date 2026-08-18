'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Check, ExternalLink, ImagePlus, Link2, Plus, Star, Trash2, X } from 'lucide-react'
import { proxyClient } from '@/lib/proxy-client'
import type {
  InspirationCategory,
  InspirationVisibility,
  VendorPost,
  VendorPostTag,
} from '@/lib/api.types'

const POSTS_LIMIT = 50
const MEDIA_LIMIT = 10
const TAGS_LIMIT = 10

const CATEGORIES: { id: InspirationCategory; label: string }[] = [
  { id: 'FASHION', label: 'Fashion' },
  { id: 'FOOD', label: 'Food' },
  { id: 'DECOR', label: 'Decor' },
  { id: 'MUSIC', label: 'Music' },
  { id: 'VENUE', label: 'Venue' },
  { id: 'PERFORMANCE', label: 'Performance' },
  { id: 'OTHER', label: 'Other' },
]

function apiError(err: unknown, fallback: string) {
  const msg = (err as { response?: { data?: { message?: unknown } } }).response?.data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  return typeof msg === 'string' ? msg : fallback
}

function visibilityLabel(v: InspirationVisibility) {
  if (v === 'DRAFT') return 'Draft'
  if (v === 'INSPIRATION') return 'Inspiration'
  return 'Profile'
}

export function PortfolioClient({
  initialPosts,
  initialExternalUrl,
  initialExternalLabel,
}: {
  initialPosts: VendorPost[]
  initialExternalUrl: string | null
  initialExternalLabel: string | null
}) {
  const [posts, setPosts] = useState(initialPosts)
  const [editing, setEditing] = useState<VendorPost | null>(null)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState<{ id: string; message: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [externalUrl, setExternalUrl] = useState(initialExternalUrl ?? '')
  const [externalLabel, setExternalLabel] = useState(initialExternalLabel ?? '')
  const [savingExternal, startExternal] = useTransition()

  useEffect(() => {
    if (!flash) return
    const hide = window.setTimeout(() => setFlash(null), 3500)
    document
      .getElementById(`look-${flash.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return () => window.clearTimeout(hide)
  }, [flash])

  async function createPost() {
    if (posts.length >= POSTS_LIMIT) {
      setError(`Portfolio is limited to ${POSTS_LIMIT} posts`)
      return
    }
    setCreating(true)
    setError('')
    try {
      const { data } = await proxyClient.post<VendorPost>('/vendors/me/posts', {
        title: 'Untitled look',
        category: 'OTHER',
        visibility: 'PROFILE',
      })
      setPosts((prev) => [data, ...prev])
      setEditing(data)
    } catch (err: unknown) {
      setError(apiError(err, 'Could not create post'))
    } finally {
      setCreating(false)
    }
  }

  function upsert(next: VendorPost) {
    setPosts((prev) => prev.map((p) => (p.id === next.id ? next : p)))
    setEditing((curr) => (curr?.id === next.id ? next : curr))
  }

  function handlePosted(next: VendorPost) {
    setPosts((prev) => prev.map((p) => (p.id === next.id ? next : p)))
    setEditing(null)
    setError('')
    setFlash({
      id: next.id,
      message:
        next.visibility === 'INSPIRATION'
          ? 'Your look is live on Inspiration'
          : next.visibility === 'DRAFT'
            ? 'Draft saved'
            : 'Posted to your profile',
    })
  }

  function removeLocal(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id))
    setEditing(null)
  }

  function saveExternal() {
    startExternal(async () => {
      setError('')
      try {
        await proxyClient.patch('/vendors/me', {
          externalPortfolioUrl: externalUrl.trim() || null,
          externalPortfolioLabel: externalLabel.trim() || null,
        })
      } catch (err: unknown) {
        setError(apiError(err, 'Could not save external portfolio link'))
      }
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display text-3xl font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Portfolio
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
            Looks on your profile. Turn on Inspiration to show them in the public feed.
          </p>
        </div>
        <button
          type="button"
          disabled={creating || posts.length >= POSTS_LIMIT}
          onClick={() => void createPost()}
          className="inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
          style={{
            background: 'var(--color-brand-primary)',
            color: 'var(--color-primary-foreground)',
          }}
        >
          <Plus size={15} />
          {creating ? 'Creating…' : 'New look'}
        </button>
      </div>

      <div
        className="space-y-3 rounded-2xl p-4"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          External portfolio
        </p>
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          Optional link out (Instagram, website). Couples can visit it; they cannot save or ask
          about it.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
          <input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://"
            className="h-9 rounded-xl px-3 text-sm"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
          <input
            value={externalLabel}
            onChange={(e) => setExternalLabel(e.target.value)}
            placeholder="Label (e.g. Instagram)"
            className="h-9 rounded-xl px-3 text-sm"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
          <button
            type="button"
            disabled={savingExternal}
            onClick={saveExternal}
            className="h-9 rounded-xl px-4 text-sm font-medium disabled:opacity-40"
            style={{
              background: 'var(--color-brand-primary)',
              color: 'var(--color-primary-foreground)',
            }}
          >
            {savingExternal ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs" style={{ color: 'var(--color-error, #c45c4a)' }}>
          {error}
        </p>
      )}

      {posts.length === 0 ? (
        <div
          className="space-y-3 rounded-2xl p-10 text-center"
          style={{ background: 'var(--card-bg)', border: '1px dashed var(--color-border)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            No looks yet
          </p>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            Add a titled post with photos. JPEG, PNG, WebP, or GIF, up to 10 MB each.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {posts.map((post) => (
            <li id={`look-${post.id}`} key={post.id}>
              <button
                type="button"
                onClick={() => setEditing(post)}
                className="w-full overflow-hidden rounded-2xl text-left transition-shadow"
                style={{
                  background: 'var(--card-bg)',
                  border: `1px solid ${flash?.id === post.id ? 'var(--color-brand-primary)' : 'var(--color-border)'}`,
                  boxShadow:
                    flash?.id === post.id
                      ? '0 0 0 3px color-mix(in srgb, var(--color-brand-primary) 28%, transparent)'
                      : undefined,
                }}
              >
                <div className="relative aspect-square" style={{ background: 'var(--input-bg)' }}>
                  {post.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-xs"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      No photo
                    </div>
                  )}
                  <span
                    className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
                  >
                    {visibilityLabel(post.visibility)}
                  </span>
                </div>
                <div className="p-2.5">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {post.title}
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-muted)' }}>
                    {post.media.length}/{MEDIA_LIMIT} media
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <PostEditor
          post={editing}
          onClose={() => setEditing(null)}
          onChange={upsert}
          onPosted={handlePosted}
          onDeleted={removeLocal}
          onError={setError}
        />
      )}

      {flash && (
        <div
          className="fixed bottom-6 left-1/2 z-[80] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-2xl px-4 py-3 shadow-2xl"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          role="status"
        >
          <span
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{
              background: 'var(--color-brand-primary)',
              color: 'var(--color-primary-foreground)',
            }}
          >
            <Check size={14} />
          </span>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {flash.message}
          </p>
        </div>
      )}
    </div>
  )
}

function PostEditor({
  post,
  onClose,
  onChange,
  onPosted,
  onDeleted,
  onError,
}: {
  post: VendorPost
  onClose: () => void
  onChange: (post: VendorPost) => void
  onPosted: (post: VendorPost) => void
  onDeleted: (id: string) => void
  onError: (msg: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(post.title)
  const [description, setDescription] = useState(post.description)
  const [categories, setCategories] = useState<InspirationCategory[]>(
    post.categories?.length ? post.categories : [post.category],
  )
  const [location, setLocation] = useState(post.location ?? '')
  const [from, setFrom] = useState(post.priceRangeFrom?.toString() ?? '')
  const [to, setTo] = useState(post.priceRangeTo?.toString() ?? '')
  const [costNote, setCostNote] = useState(post.costNote ?? '')
  const [visibility, setVisibility] = useState<InspirationVisibility>(post.visibility)
  const [tags, setTags] = useState(post.tagItems.map((t) => t.label))
  const [tagDraft, setTagDraft] = useState('')
  const [suggestions, setSuggestions] = useState<VendorPostTag[]>([])
  const [linkUrl, setLinkUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setTitle(post.title)
    setDescription(post.description)
    setCategories(post.categories?.length ? post.categories : [post.category])
    setLocation(post.location ?? '')
    setFrom(post.priceRangeFrom?.toString() ?? '')
    setTo(post.priceRangeTo?.toString() ?? '')
    setCostNote(post.costNote ?? '')
    setVisibility(post.visibility)
    setTags(post.tagItems.map((t) => t.label))
  }, [post.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    proxyClient
      .get<VendorPostTag[]>('/inspiration/tags')
      .then(({ data }) => setSuggestions(Array.isArray(data) ? data : []))
      .catch(() => setSuggestions([]))
  }, [])

  async function saveMeta() {
    setSaving(true)
    onError('')
    try {
      const { data } = await proxyClient.patch<VendorPost>(`/vendors/me/posts/${post.id}`, {
        title: title.trim(),
        description,
        categories,
        location: location.trim() || null,
        priceRangeFrom: from ? Number(from) : null,
        priceRangeTo: to ? Number(to) : null,
        costNote: costNote.trim() || null,
        tags,
        visibility,
      })
      setDone(true)
      await new Promise((resolve) => window.setTimeout(resolve, 700))
      onPosted(data)
    } catch (err: unknown) {
      onError(apiError(err, 'Could not post look'))
      setSaving(false)
    }
  }

  async function uploadFile(file: File) {
    if (post.media.length >= MEDIA_LIMIT) {
      onError(`A look can have at most ${MEDIA_LIMIT} photos or links`)
      return
    }
    setUploading(true)
    onError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await proxyClient.post<VendorPost>(`/vendors/me/posts/${post.id}/media`, fd)
      onChange(data)
    } catch (err: unknown) {
      onError(apiError(err, 'Upload failed'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function addLink() {
    if (!linkUrl.trim()) return
    setUploading(true)
    onError('')
    try {
      const { data } = await proxyClient.post<VendorPost>(
        `/vendors/me/posts/${post.id}/media/link`,
        {
          url: linkUrl.trim(),
        },
      )
      setLinkUrl('')
      onChange(data)
    } catch (err: unknown) {
      onError(apiError(err, 'Could not add link'))
    } finally {
      setUploading(false)
    }
  }

  async function setCover(mediaId: string) {
    try {
      const { data } = await proxyClient.patch<VendorPost>(
        `/vendors/me/posts/${post.id}/media/${mediaId}`,
      )
      onChange(data)
    } catch (err: unknown) {
      onError(apiError(err, 'Could not set cover'))
    }
  }

  async function removeMedia(mediaId: string) {
    try {
      const { data } = await proxyClient.delete<VendorPost>(
        `/vendors/me/posts/${post.id}/media/${mediaId}`,
      )
      onChange(data)
    } catch (err: unknown) {
      onError(apiError(err, 'Could not remove media'))
    }
  }

  async function removePost() {
    if (!confirm('Delete this look?')) return
    try {
      await proxyClient.delete(`/vendors/me/posts/${post.id}`)
      onDeleted(post.id)
    } catch (err: unknown) {
      onError(apiError(err, 'Could not delete look'))
    }
  }

  function addTag(raw: string) {
    const label = raw.trim()
    if (!label || tags.includes(label) || tags.length >= TAGS_LIMIT) return
    setTags((prev) => [...prev, label])
    setTagDraft('')
  }

  const filteredSuggestions = suggestions
    .filter((s) => {
      const q = tagDraft.trim().toLowerCase()
      if (!q) return false
      return s.label.toLowerCase().includes(q) && !tags.includes(s.label)
    })
    .slice(0, 6)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border p-5 shadow-2xl"
        style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center justify-between">
          <h2
            className="font-display text-lg font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Edit look
          </h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} style={{ color: 'var(--color-muted)' }} />
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 w-full rounded-xl px-3 text-sm"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            Description
          </span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full resize-none rounded-xl px-3 py-2 text-sm"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
        </label>

        <div className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            Categories
            <span className="ml-1 font-normal">(select all that apply)</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const active = categories.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setCategories((prev) => {
                      if (prev.includes(c.id)) {
                        return prev.length === 1 ? prev : prev.filter((id) => id !== c.id)
                      }
                      return [...prev, c.id]
                    })
                  }
                  className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm"
                  style={{
                    background: active ? 'var(--color-brand-primary)' : 'var(--input-bg)',
                    border: `1px solid ${active ? 'var(--color-brand-primary)' : 'var(--color-border)'}`,
                    color: active ? 'var(--color-primary-foreground)' : 'var(--color-foreground)',
                  }}
                >
                  {active && <Check size={12} />}
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            Location
          </span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="h-9 w-full rounded-xl px-3 text-sm"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
              From (CAD)
            </span>
            <input
              type="number"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-full rounded-xl px-3 text-sm"
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
              To (CAD)
            </span>
            <input
              type="number"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-full rounded-xl px-3 text-sm"
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
              Cost note
            </span>
            <input
              value={costNote}
              onChange={(e) => setCostNote(e.target.value)}
              className="h-9 w-full rounded-xl px-3 text-sm"
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            />
          </label>
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            Tags ({tags.length}/{TAGS_LIMIT})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  background: 'color-mix(in srgb, var(--color-brand-primary) 12%, transparent)',
                  color: 'var(--color-brand-primary)',
                }}
              >
                {tag} <X size={10} />
              </button>
            ))}
          </div>
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag(tagDraft.replace(',', ''))
              }
            }}
            placeholder="Type a tag and press Enter"
            disabled={tags.length >= TAGS_LIMIT}
            className="h-9 w-full rounded-xl px-3 text-sm"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
          {filteredSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {filteredSuggestions.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => addTag(s.label)}
                  className="rounded-full px-2 py-0.5 text-[11px]"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            Visibility
          </span>
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'DRAFT' as const, label: 'Draft' },
              { id: 'PROFILE' as const, label: 'On my profile' },
              { id: 'INSPIRATION' as const, label: 'Inspiration feed' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setVisibility(opt.id)}
                className="h-8 rounded-lg px-3 text-xs font-medium"
                style={
                  visibility === opt.id
                    ? {
                        background: 'var(--color-brand-primary)',
                        color: 'var(--color-primary-foreground)',
                      }
                    : {
                        background: 'var(--card-bg)',
                        color: 'var(--color-muted)',
                        border: '1px solid var(--color-border)',
                      }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
            Inspiration also appears on your profile. Needs a title and at least one photo or link.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
              Photos & links ({post.media.length}/{MEDIA_LIMIT})
            </span>
            <button
              type="button"
              disabled={uploading || post.media.length >= MEDIA_LIMIT}
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-medium disabled:opacity-40"
              style={{
                background: 'var(--color-brand-primary)',
                color: 'var(--color-primary-foreground)',
              }}
            >
              <ImagePlus size={12} />
              {uploading ? 'Uploading…' : 'Add photo'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadFile(file)
              }}
            />
          </div>
          <div className="flex gap-2">
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://… (external photo or video)"
              className="h-9 flex-1 rounded-xl px-3 text-sm"
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            />
            <button
              type="button"
              disabled={uploading || !linkUrl.trim() || post.media.length >= MEDIA_LIMIT}
              onClick={() => void addLink()}
              className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-medium disabled:opacity-40"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
            >
              <Link2 size={12} /> Add link
            </button>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {post.media.map((m) => (
              <li
                key={m.id}
                className="relative aspect-square overflow-hidden rounded-xl"
                style={{ background: 'var(--card-bg)' }}
              >
                {m.mediaType === 'EXTERNAL' ? (
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center"
                  >
                    <ExternalLink size={16} style={{ color: 'var(--color-muted)' }} />
                    <span
                      className="line-clamp-2 text-[10px]"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      Link
                    </span>
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                )}
                {m.isCover && (
                  <span className="absolute top-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                    Cover
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/70 to-transparent p-1">
                  {!m.isCover && (
                    <button
                      type="button"
                      onClick={() => void setCover(m.id)}
                      className="text-brand-900 inline-flex h-6 flex-1 items-center justify-center gap-0.5 rounded bg-white/90 text-[10px]"
                    >
                      <Star size={10} /> Cover
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void removeMedia(m.id)}
                    className="h-6 rounded bg-white/90 px-1.5 text-[10px] text-red-700"
                    aria-label="Remove"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => void removePost()}
            className="h-9 rounded-xl px-3 text-xs font-medium"
            style={{ color: '#b91c1c' }}
          >
            Delete look
          </button>
          <button
            type="button"
            disabled={saving || done || !title.trim()}
            onClick={() => void saveMeta()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
            style={{
              background: 'var(--color-brand-primary)',
              color: 'var(--color-primary-foreground)',
            }}
          >
            {done ? (
              <>
                <Check size={15} />
                {visibility === 'INSPIRATION'
                  ? 'You’re live'
                  : visibility === 'DRAFT'
                    ? 'Draft saved'
                    : 'Posted'}
              </>
            ) : saving ? (
              visibility === 'DRAFT' ? (
                'Saving…'
              ) : (
                'Posting…'
              )
            ) : visibility === 'DRAFT' ? (
              'Save draft'
            ) : visibility === 'INSPIRATION' ? (
              'Go live'
            ) : (
              'Post'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
