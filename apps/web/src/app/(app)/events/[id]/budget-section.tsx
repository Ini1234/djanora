'use client'

import { useState, useTransition, useRef, useEffect, useCallback, useMemo } from 'react'
import { useHydratedState, useSyncedState } from '@/lib/use-synced-state'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Upload,
  FileText,
  Image as ImageIcon,
  Loader2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Store,
  Search,
  Star,
  BadgeCheck,
  MessageSquare,
  Send,
  Mail,
  Phone,
  Globe,
  BookUser,
  Sparkles,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { getErrorMessage } from '@/lib/errors'
import { proxyClient } from '@/lib/proxy-client'
import { useLazyGet } from '@/lib/use-lazy-get'
import { TableSkeleton } from '@/components/ui/skeleton'
import { DataPortMenu } from '@/components/data-port-menu'
import { VENDOR_CATEGORY_KEYS, getVendorCategoryLabel } from '@/lib/vendor-categories'
import type { EventBudgetItem, BudgetReceipt, UserVendorContact } from '@/lib/api.types'
import {
  BUDGET_HEADERS,
  budgetExportRows,
  capImportRows,
  parseBudgetTable,
} from '@/lib/data-port-maps'
import { fileBase } from '@/lib/sheet-io'
import { useMoodBoardLinks } from './mood-board-context'
import { useEventAccess } from './event-access-context'
import { EventItemComments } from './event-item-comments'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorOption {
  id: string
  slug: string
  businessName: string
  category: string
  isVerified: boolean
  averageRating: number | null
  totalReviews: number
  estimatedPriceFrom: number | null
  estimatedPriceTo: number | null
  currency: string
  city: string | null
  avatarUrl: string | null
}

function existingInquiryId(err: unknown): string | null {
  const res = (err as { response?: { status?: number; data?: { inquiryId?: unknown } } }).response
  if (res?.status !== 409) return null
  return typeof res.data?.inquiryId === 'string' ? res.data.inquiryId : null
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BudgetSectionProps {
  eventId: string
  eventTitle?: string
  initialItems?: EventBudgetItem[]
  totalBudget: number
  focusItemId?: string
  onCollapse?: () => void
}

// ─── Edit / Add modal ─────────────────────────────────────────────────────────

interface EditModalProps {
  eventId: string
  item?: EventBudgetItem
  onClose: () => void
  onSaved: (item: EventBudgetItem) => void
}

function EditModal({ eventId, item, onClose, onSaved }: EditModalProps) {
  const tCat = useTranslations('vendorCategories')
  const isNew = !item
  const [category, setCategory] = useState<string>(item?.category ?? 'OTHER')
  const [label, setLabel] = useState(item?.label ?? '')
  const [vendorName, setVendorName] = useState(item?.vendorName ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [allocated, setAllocated] = useState(String(item?.allocatedAmount ?? ''))
  const [spent, setSpent] = useState(String(item?.spentAmount ?? ''))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Registered vendor picker
  const [vendorSearch, setVendorSearch] = useState('')
  const [customMode, setCustomMode] = useState(false)
  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [selectedVendorProfileId, setSelectedVendorProfileId] = useState<string | null>(
    item?.vendorProfileId ?? null,
  )

  // Personal contact book
  const [myContacts, setMyContacts] = useState<UserVendorContact[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    item?.userVendorContactId ?? null,
  )
  // New contact fields (for saving to contact book)
  const [newContactEmail, setNewContactEmail] = useState(item?.userVendorContact?.email ?? '')
  const [newContactPhone, setNewContactPhone] = useState(item?.userVendorContact?.phone ?? '')
  const [newContactWebsite, setNewContactWebsite] = useState(item?.userVendorContact?.website ?? '')
  const [saveToContacts, setSaveToContacts] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)

  // Contact details shown only for non-registered vendors (custom name or personal contact)
  // Never shown when a system vendor profile is linked
  const showContactFields = !!vendorName && !selectedVendorProfileId

  // Fetch registered vendors
  const fetchVendors = useCallback(async (cat: string) => {
    setLoadingVendors(true)
    try {
      const { data } = await proxyClient.get<VendorOption[]>(`/vendors?category=${cat}`)
      setVendors(Array.isArray(data) ? data : [])
    } catch {
      setVendors([])
    } finally {
      setLoadingVendors(false)
    }
  }, [])

  // Fetch user's personal contacts
  const fetchContacts = useCallback(async (cat: string) => {
    try {
      const { data } = await proxyClient.get<UserVendorContact[]>(
        `/vendor-contacts?category=${cat}`,
      )
      setMyContacts(Array.isArray(data) ? data : [])
    } catch {
      /* silent */
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      fetchVendors(category)
      fetchContacts(category)
    })
    return () => {
      cancelled = true
    }
  }, [category, fetchVendors, fetchContacts])

  const filteredVendors = vendors.filter(
    (v) =>
      v.businessName.toLowerCase().includes(vendorSearch.toLowerCase()) ||
      (v.city ?? '').toLowerCase().includes(vendorSearch.toLowerCase()),
  )

  const filteredContacts = myContacts.filter((c) =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()),
  )

  const handleCategoryChange = (cat: string) => {
    setCategory(cat)
    setVendorName('')
    setNewContactEmail('')
    setNewContactPhone('')
    setNewContactWebsite('')
    setVendorSearch('')
    setContactSearch('')
    setCustomMode(false)
    setSelectedVendorProfileId(null)
    setSelectedContactId(null)
    setSaveToContacts(false)
  }

  const handleSave = () => {
    const allocatedNum = parseInt(allocated, 10)
    if (isNaN(allocatedNum) || allocatedNum < 0) {
      setError('Allocated amount must be a positive number')
      return
    }

    startTransition(async () => {
      setError('')
      try {
        // If custom vendor + saveToContacts, create/update the contact first
        let resolvedContactId = selectedContactId
        if (showContactFields && saveToContacts && !selectedContactId) {
          const { data: created } = await proxyClient.post<UserVendorContact>('/vendor-contacts', {
            name: vendorName.trim(),
            category: category,
            email: newContactEmail.trim() || undefined,
            phone: newContactPhone.trim() || undefined,
            website: newContactWebsite.trim() || undefined,
          })
          resolvedContactId = created.id
        }

        const url = isNew ? `/events/${eventId}/budget` : `/events/${eventId}/budget/${item.id}`

        const payload = {
          ...(isNew && { category }),
          label: label.trim() || null,
          vendorName: vendorName.trim() || null,
          vendorProfileId: selectedVendorProfileId ?? null,
          userVendorContactId: resolvedContactId ?? null,
          notes: notes.trim() || null,
          allocatedAmount: allocatedNum,
          spentAmount: parseInt(spent, 10) || 0,
        }

        const { data: saved } = isNew
          ? await proxyClient.post<EventBudgetItem>(url, payload)
          : await proxyClient.patch<EventBudgetItem>(url, payload)

        onSaved(saved)
        onClose()
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Something went wrong'))
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="overlay absolute inset-0 backdrop-blur-sm" onClick={onClose} />
      <div className="sheet relative z-10 flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border shadow-2xl">
        {/* Header */}
        <div className="border-border flex shrink-0 items-center justify-between border-b px-5 py-4">
          <h3 className="text-foreground text-sm font-semibold">
            {isNew ? 'Add budget item' : 'Edit budget item'}
          </h3>
          <button onClick={onClose} className="icon-btn" type="button" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {/* Category */}
          <div>
            <label className="label">Category</label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              disabled={!isNew}
              className="input"
            >
              {VENDOR_CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {getVendorCategoryLabel(key, tCat)}
                </option>
              ))}
            </select>
          </div>

          {/* Custom label */}
          <div>
            <label className="label">
              Custom label <span className="text-muted">(optional)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`e.g. "Second photographer"`}
              className="input"
            />
          </div>

          {/* ── Vendor picker ── */}
          <div>
            <label className="label">
              Vendor <span className="text-muted">(optional)</span>
            </label>

            {/* Selected vendor chip */}
            {vendorName && (
              <div className="mb-2 flex items-center gap-2">
                <div className="bg-gold-500/10 border-gold-500/25 text-foreground flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  {selectedContactId ? (
                    <BookUser size={13} className="text-foreground shrink-0" />
                  ) : (
                    <Store size={13} className="text-foreground shrink-0" />
                  )}
                  <span className="truncate">{vendorName}</span>
                  {selectedContactId && (
                    <span className="text-muted shrink-0 text-[10px]">saved contact</span>
                  )}
                  {selectedVendorProfileId && (
                    <BadgeCheck
                      size={11}
                      className="text-foreground shrink-0"
                      aria-label="Registered vendor"
                    />
                  )}
                </div>
                <button
                  onClick={() => {
                    setVendorName('')
                    setVendorSearch('')
                    setContactSearch('')
                    setCustomMode(false)
                    setSelectedVendorProfileId(null)
                    setSelectedContactId(null)
                    setNewContactEmail('')
                    setNewContactPhone('')
                    setNewContactWebsite('')
                    setSaveToContacts(false)
                  }}
                  className="text-muted rounded-lg p-1.5 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  title="Remove"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {!vendorName && (
              <div className="border-border bg-card overflow-hidden rounded-xl border">
                {loadingVendors ? (
                  <div className="text-muted flex items-center justify-center gap-2 py-6 text-xs">
                    <Loader2 size={13} className="animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <>
                    {/* My saved contacts section */}
                    {filteredContacts.length > 0 && !customMode && (
                      <div className="border-border border-b">
                        <div className="text-muted flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                          <BookUser size={9} />
                          My contacts
                        </div>
                        {myContacts.length > 3 && (
                          <div className="border-border flex items-center gap-2 border-b px-3 py-1.5">
                            <Search size={10} className="text-muted shrink-0" />
                            <input
                              type="text"
                              value={contactSearch}
                              onChange={(e) => setContactSearch(e.target.value)}
                              placeholder="Search contacts…"
                              className="placeholder:text-muted text-foreground flex-1 bg-transparent text-xs focus:outline-none"
                            />
                          </div>
                        )}
                        <ul className="divide-border max-h-32 divide-y overflow-y-auto">
                          {filteredContacts.map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setVendorName(c.name)
                                  setSelectedContactId(c.id)
                                  setNewContactEmail(c.email ?? '')
                                  setNewContactPhone(c.phone ?? '')
                                  setNewContactWebsite(c.website ?? '')
                                  // Clear registered-vendor state — mutually exclusive
                                  setSelectedVendorProfileId(null)
                                }}
                                className="group hover:bg-foreground/5 flex w-full items-center gap-3 px-3 py-2 text-left transition-colors"
                              >
                                <div className="bg-foreground/5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                                  <BookUser size={10} className="text-muted" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="group-hover:text-foreground text-foreground block truncate text-sm transition-colors">
                                    {c.name}
                                  </span>
                                  {(c.email || c.phone) && (
                                    <span className="text-muted block truncate text-[10px]">
                                      {c.email ?? c.phone}
                                    </span>
                                  )}
                                </div>
                                <Check
                                  size={11}
                                  className="text-foreground shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Registered vendors list */}
                    {vendors.length > 0 && !customMode && (
                      <>
                        <div className="text-muted border-border flex items-center gap-1.5 border-b px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                          <Store size={9} />
                          Registered vendors
                        </div>
                        {/* Search */}
                        <div className="border-border flex items-center gap-2 border-b px-3 py-2">
                          <Search size={11} className="text-muted shrink-0" />
                          <input
                            ref={searchRef}
                            type="text"
                            value={vendorSearch}
                            onChange={(e) => setVendorSearch(e.target.value)}
                            placeholder={`Search ${vendors.length} ${getVendorCategoryLabel(category, tCat)} vendors…`}
                            className="placeholder:text-muted text-foreground flex-1 bg-transparent text-xs focus:outline-none"
                          />
                          {vendorSearch && (
                            <button
                              onClick={() => setVendorSearch('')}
                              className="text-muted hover:text-foreground transition-colors"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>

                        {/* Vendor rows */}
                        <ul className="divide-border max-h-40 divide-y overflow-y-auto">
                          {filteredVendors.map((v) => (
                            <li key={v.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setVendorName(v.businessName)
                                  setSelectedVendorProfileId(v.id)
                                  // Clear personal-contact state — registered vendors are not editable
                                  setSelectedContactId(null)
                                  setNewContactEmail('')
                                  setNewContactPhone('')
                                  setNewContactWebsite('')
                                  setSaveToContacts(false)
                                }}
                                className="group hover:bg-foreground/5 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
                              >
                                {v.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={v.avatarUrl}
                                    alt=""
                                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="bg-foreground/5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                                    <Store size={13} className="text-muted" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="group-hover:text-foreground text-foreground truncate text-sm transition-colors">
                                      {v.businessName}
                                    </span>
                                    {v.isVerified && (
                                      <BadgeCheck
                                        size={12}
                                        className="text-foreground shrink-0"
                                        aria-label="Verified"
                                      />
                                    )}
                                  </div>
                                  <div className="mt-0.5 flex items-center gap-2">
                                    {v.city && (
                                      <span className="text-muted text-[10px]">{v.city}</span>
                                    )}
                                    {v.averageRating !== null && (
                                      <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                                        <Star size={8} fill="currentColor" />
                                        {v.averageRating.toFixed(1)}
                                        <span className="text-muted">({v.totalReviews})</span>
                                      </span>
                                    )}
                                    {v.estimatedPriceFrom !== null && (
                                      <span className="text-muted text-[10px]">
                                        from {v.currency}${v.estimatedPriceFrom.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Check
                                  size={12}
                                  className="text-foreground shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                />
                              </button>
                            </li>
                          ))}

                          {filteredVendors.length === 0 && (
                            <li className="text-muted px-3 py-4 text-center text-xs italic">
                              No vendors found for &ldquo;{vendorSearch}&rdquo;
                            </li>
                          )}
                        </ul>

                        {/* Footer — add custom */}
                        <div className="border-border border-t">
                          <button
                            type="button"
                            onClick={() => {
                              setCustomMode(true)
                              setVendorSearch('')
                            }}
                            className="text-muted hover:text-foreground hover:bg-foreground/5 flex w-full items-center gap-2 px-3 py-2.5 text-xs transition-colors"
                          >
                            <Plus size={11} />
                            My vendor isn&apos;t listed — add manually
                          </button>
                        </div>
                      </>
                    )}

                    {/* No vendors registered OR custom mode */}
                    {(vendors.length === 0 || customMode) && (
                      <>
                        {customMode && vendors.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomMode(false)
                              setVendorSearch('')
                            }}
                            className="text-muted hover:text-foreground border-border flex w-full items-center gap-2 border-b px-3 py-2 text-[11px] transition-colors"
                          >
                            ← Back to vendor list
                          </button>
                        )}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <Store size={12} className="text-muted shrink-0" />
                          <input
                            autoFocus
                            type="text"
                            value={vendorSearch}
                            onChange={(e) => setVendorSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && vendorSearch.trim()) {
                                setVendorName(vendorSearch.trim())
                                setVendorSearch('')
                                setSaveToContacts(true)
                              }
                            }}
                            placeholder={
                              vendors.length === 0
                                ? 'No vendors registered — type a name & press Enter'
                                : 'Type vendor name and press Enter'
                            }
                            className="placeholder:text-muted text-foreground flex-1 bg-transparent text-sm focus:outline-none"
                          />
                          {vendorSearch.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                setVendorName(vendorSearch.trim())
                                setVendorSearch('')
                                setSaveToContacts(true)
                              }}
                              className="bg-gold-600/15 border-gold-500/25 text-foreground hover:bg-gold-600/25 shrink-0 rounded-md border px-2 py-0.5 text-[10px] transition-colors"
                            >
                              Add
                            </button>
                          )}
                        </div>
                        {vendors.length === 0 && (
                          <p className="text-muted px-3 pb-2.5 text-[10px]">
                            Vendors who sign up will appear here automatically.
                          </p>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Contact details — only for non-registered vendors ── */}
          {showContactFields && (
            <div className="border-border bg-foreground/5 space-y-3 rounded-xl border px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-muted text-[11px] font-semibold tracking-wider uppercase">
                  Contact details
                </p>
                {/* Save to contacts toggle */}
                {!selectedContactId && (
                  <button
                    type="button"
                    onClick={() => setSaveToContacts((v) => !v)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] transition-colors',
                      saveToContacts
                        ? 'bg-gold-600/20 border-gold-500/30 text-foreground'
                        : 'text-muted hover:text-foreground border-border bg-foreground/5',
                    )}
                  >
                    <BookUser size={9} />
                    {saveToContacts ? 'Saving to my contacts' : 'Save to my contacts'}
                  </button>
                )}
                {selectedContactId && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <Check size={9} />
                    From my contacts
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <div className="flex items-center gap-2.5">
                  <Mail size={13} className="text-muted shrink-0" />
                  <input
                    type="email"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    placeholder="vendor@email.com"
                    className="input min-w-0 flex-1"
                  />
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone size={13} className="text-muted shrink-0" />
                  <input
                    type="tel"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="input min-w-0 flex-1"
                  />
                </div>
                <div className="flex items-center gap-2.5">
                  <Globe size={13} className="text-muted shrink-0" />
                  <input
                    type="url"
                    value={newContactWebsite}
                    onChange={(e) => setNewContactWebsite(e.target.value)}
                    placeholder="https://vendor-website.com"
                    className="input min-w-0 flex-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">
                Allocated (CA$) <span className="text-muted">*</span>
              </label>
              <input
                type="number"
                value={allocated}
                onChange={(e) => setAllocated(e.target.value)}
                min={0}
                placeholder="0"
                className="input"
              />
            </div>
            <div>
              <label className="label">Spent (CA$)</label>
              <input
                type="number"
                value={spent}
                onChange={(e) => setSpent(e.target.value)}
                min={0}
                placeholder="0"
                className="input"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">
              Notes <span className="text-muted">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Payment terms, contract info, etc."
              className="input"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="border-border flex shrink-0 items-center justify-end gap-2 border-t px-5 py-4">
          <button onClick={onClose} className="btn btn-secondary btn-sm" type="button">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || !allocated}
            className="btn btn-primary btn-sm"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {isNew ? 'Add item' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Linked inspirations (budget) ────────────────────────────────────────────

function LinkedBudgetInspirations({ budgetItemId }: { budgetItemId: string }) {
  const { loading, entriesByBudgetId } = useMoodBoardLinks()
  const items = entriesByBudgetId.get(budgetItemId) ?? []

  if (loading) return null
  if (items.length === 0) return null

  return (
    <div>
      <p className="text-muted mb-2 flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase">
        <Sparkles size={10} /> Linked Inspiration ({items.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map(({ id, inspirationItem: insp }) => (
          <div
            key={id}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {insp.imageUrl && (
              // Dynamic inspiration thumbs; next/image needs a known remote host.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={insp.imageUrl} alt={insp.title} className="h-5 w-5 rounded object-cover" />
            )}
            <span className="text-muted max-w-[120px] truncate">{insp.title}</span>
            <span className="text-muted text-[10px]">
              {insp.category.charAt(0) + insp.category.slice(1).toLowerCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Receipt uploader ─────────────────────────────────────────────────────────

interface ReceiptUploaderProps {
  eventId: string
  item: EventBudgetItem
  onUploaded: (receipt: BudgetReceipt) => void
}

function ReceiptUploader({ eventId, item, onUploaded }: ReceiptUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data: receipt } = await proxyClient.post<BudgetReceipt>(
        `/events/${eventId}/budget/${item.id}/receipts`,
        fd,
      )
      onUploaded(receipt)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Upload failed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="text-muted hover:text-foreground flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {uploading ? 'Uploading…' : 'Add receipt'}
      </button>
      {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
    </div>
  )
}

// ─── Receipt thumbnail ────────────────────────────────────────────────────────

function ReceiptThumb({
  receipt,
  eventId,
  onDeleted,
}: {
  receipt: BudgetReceipt
  eventId: string
  onDeleted: (id: string) => void
}) {
  const { canEdit } = useEventAccess()
  const [deleting, setDeleting] = useState(false)
  const isPdf = receipt.mimeType === 'application/pdf'

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await proxyClient.delete(`/events/${eventId}/budget/unused/receipts/${receipt.id}`)
      onDeleted(receipt.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="group relative">
      <a
        href={receipt.url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:border-gold-500/40 border-border bg-foreground/5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border transition-colors"
        title={receipt.filename}
      >
        {isPdf ? (
          <FileText size={18} className="text-muted" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={receipt.url} alt={receipt.filename} className="h-full w-full object-cover" />
        )}
      </a>
      {canEdit('BUDGET') && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-foreground absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 opacity-0 transition-opacity group-hover:opacity-100"
        >
          {deleting ? <Loader2 size={8} className="animate-spin" /> : <X size={8} />}
        </button>
      )}
    </div>
  )
}

// ─── Contact vendor modal ─────────────────────────────────────────────────────

interface ContactModalProps {
  eventId: string
  vendorName: string
  vendorProfileId: string
  onClose: () => void
  onSent: () => void
}

function ContactModal({
  eventId,
  vendorName,
  vendorProfileId,
  onClose,
  onSent,
}: ContactModalProps) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const MIN = 10

  const handleSend = () => {
    if (message.trim().length < MIN) {
      setError(`Message must be at least ${MIN} characters`)
      return
    }
    startTransition(async () => {
      setError('')
      try {
        await proxyClient.post('/inquiries', { eventId, vendorProfileId, message: message.trim() })
        onSent()
        onClose()
      } catch (err: unknown) {
        const inquiryId = existingInquiryId(err)
        if (inquiryId) {
          router.push(`/messages?inquiry=${inquiryId}`)
          return
        }
        setError(getErrorMessage(err, 'Something went wrong'))
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="overlay absolute inset-0 backdrop-blur-sm" onClick={onClose} />
      <div className="sheet relative z-10 flex w-full max-w-sm flex-col rounded-2xl border shadow-2xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Contact vendor</h3>
            <p className="text-muted mt-0.5 text-xs">{vendorName}</p>
          </div>
          <button onClick={onClose} className="icon-btn" type="button" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="label">
              Your message <span className="text-muted">*</span>
            </label>
            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder={`Hi ${vendorName}, I'm interested in booking you for my event…`}
              className="input"
            />
            <p className="text-muted mt-1 text-[10px]">
              {message.trim().length} / 2000 chars — minimum {MIN}
            </p>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="border-border flex items-center justify-end gap-2 border-t px-5 py-4">
          <button onClick={onClose} className="btn btn-secondary btn-sm" type="button">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isPending || message.trim().length < MIN}
            className="btn btn-primary btn-sm"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Send inquiry
          </button>
        </div>
      </div>
    </div>
  )
}

function money(n: number) {
  return `CA$${n.toLocaleString('en-CA')}`
}

const DEFAULT_BUDGET_ITEM_NAMES: Record<string, string> = {
  CATERER: 'Catering',
  PHOTOGRAPHER: 'Photography',
  VIDEOGRAPHER: 'Videography',
  DECORATOR: 'Decor & flowers',
  DJ: 'DJ set',
  LIVE_BAND: 'Live performance',
  MAKEUP_ARTIST: 'Hair & makeup',
  MC: 'Hosting',
  WEDDING_PLANNER: 'Planning',
  FASHION_STYLIST: 'Attire',
  OTHER: 'Miscellaneous',
}

function itemLabel(
  item: EventBudgetItem,
  tCat: (key: string) => string,
  tBudget?: { (key: string): string; has: (key: string) => boolean },
) {
  const defaultKey = `defaults.${item.category}`
  const custom = item.label?.trim()
  if (custom && custom !== DEFAULT_BUDGET_ITEM_NAMES[item.category]) return custom
  if (tBudget?.has(defaultKey)) return tBudget(defaultKey)
  return custom || getVendorCategoryLabel(item.category, tCat)
}

function remainingOf(item: EventBudgetItem) {
  return item.allocatedAmount - item.spentAmount
}

function statusBucket(item: EventBudgetItem): 'over' | 'in-progress' | 'not-started' {
  if (item.spentAmount > item.allocatedAmount) return 'over'
  if (item.spentAmount === 0) return 'not-started'
  return 'in-progress'
}

type BudgetSortKey =
  | 'alpha'
  | 'allocated-asc'
  | 'allocated-desc'
  | 'spent-asc'
  | 'spent-desc'
  | 'remaining-asc'
  | 'remaining-desc'
type BudgetFilterKey = 'all' | 'over' | 'unpaid' | 'vendor'
type BudgetGroupKey = 'none' | 'category' | 'status'

function applyBudgetSortFilter(
  items: EventBudgetItem[],
  sort: BudgetSortKey,
  filter: BudgetFilterKey,
  tCat: (key: string) => string,
  tBudget: { (key: string): string; has: (key: string) => boolean },
) {
  let r = [...items]
  if (filter === 'over') r = r.filter((i) => i.spentAmount > i.allocatedAmount)
  if (filter === 'unpaid') r = r.filter((i) => i.spentAmount === 0)
  if (filter === 'vendor') r = r.filter((i) => !!i.vendorName)

  if (sort === 'alpha')
    r.sort((a, b) => itemLabel(a, tCat, tBudget).localeCompare(itemLabel(b, tCat, tBudget)))
  else if (sort === 'allocated-asc') r.sort((a, b) => a.allocatedAmount - b.allocatedAmount)
  else if (sort === 'allocated-desc') r.sort((a, b) => b.allocatedAmount - a.allocatedAmount)
  else if (sort === 'spent-asc') r.sort((a, b) => a.spentAmount - b.spentAmount)
  else if (sort === 'spent-desc') r.sort((a, b) => b.spentAmount - a.spentAmount)
  else if (sort === 'remaining-asc') r.sort((a, b) => remainingOf(a) - remainingOf(b))
  else if (sort === 'remaining-desc') r.sort((a, b) => remainingOf(b) - remainingOf(a))

  return r
}

function groupBudgetItems(
  items: EventBudgetItem[],
  group: BudgetGroupKey,
  tCat: (key: string) => string,
  labels: { over: string; inProgress: string; notStarted: string },
): { key: string; label: string | null; items: EventBudgetItem[] }[] {
  if (group === 'none') return [{ key: 'all', label: null, items }]

  if (group === 'status') {
    const order = ['over', 'in-progress', 'not-started'] as const
    const names = {
      over: labels.over,
      'in-progress': labels.inProgress,
      'not-started': labels.notStarted,
    }
    return order
      .map((key) => ({
        key,
        label: names[key],
        items: items.filter((item) => statusBucket(item) === key),
      }))
      .filter((section) => section.items.length > 0)
  }

  const map = new Map<string, EventBudgetItem[]>()
  for (const item of items) {
    const list = map.get(item.category)
    if (list) list.push(item)
    else map.set(item.category, [item])
  }
  return [...map.entries()]
    .sort(([a], [b]) =>
      getVendorCategoryLabel(a, tCat).localeCompare(getVendorCategoryLabel(b, tCat)),
    )
    .map(([key, sectionItems]) => ({
      key,
      label: getVendorCategoryLabel(key, tCat),
      items: sectionItems,
    }))
}

function SortTh({
  label,
  active,
  desc,
  onClick,
  align = 'left',
  className,
}: {
  label: string
  active: boolean
  desc?: boolean
  onClick: () => void
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <th
      className={cn(
        'px-2 py-2 text-[10px] font-medium tracking-wide uppercase',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1',
          align === 'right' && 'w-full justify-end',
          active ? 'text-foreground' : 'text-muted hover:text-foreground',
        )}
      >
        {label}
        {active && (desc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
      </button>
    </th>
  )
}

function MoneyInput({
  value,
  onCommit,
  ariaLabel,
  danger,
}: {
  value: number
  onCommit: (n: number) => void
  ariaLabel: string
  danger?: boolean
}) {
  const [draft, setDraft] = useSyncedState(String(value))

  function commit() {
    const n = Math.max(0, Math.round(Number(draft)))
    if (!Number.isFinite(n)) {
      setDraft(String(value))
      return
    }
    if (n !== value) onCommit(n)
    else setDraft(String(value))
  }

  return (
    <input
      type="number"
      min={0}
      step={1}
      value={draft}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      className={cn(
        'hover:border-border focus:border-border w-[6.5rem] border-b border-transparent bg-transparent py-0.5 text-right text-xs tabular-nums transition-colors focus:outline-none',
        danger ? 'text-red-400' : 'text-foreground',
      )}
    />
  )
}

// ─── Budget row ───────────────────────────────────────────────────────────────

interface BudgetRowProps {
  item: EventBudgetItem
  eventId: string
  nested?: boolean
  onEdit: () => void
  onDelete: () => void
  onReceiptUploaded: (r: BudgetReceipt) => void
  onReceiptDeleted: (id: string) => void
  onPatchAmount: (field: 'allocatedAmount' | 'spentAmount', value: number) => void
  initiallyExpanded?: boolean
  tCat: (key: string) => string
}

function BudgetRow({
  item,
  eventId,
  nested = false,
  onEdit,
  onDelete,
  onReceiptUploaded,
  onReceiptDeleted,
  onPatchAmount,
  initiallyExpanded = false,
  tCat,
}: BudgetRowProps) {
  const t = useTranslations('budget')
  const { canEdit } = useEventAccess()
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const [showContact, setShowContact] = useState(false)
  const [inquirySent, setInquirySent] = useState(false)
  const left = remainingOf(item)
  const displayLabel = itemLabel(item, tCat, t)

  return (
    <>
      <tr
        id={`budget-item-${item.id}`}
        className={cn(
          'group hover:bg-foreground/[0.03] border-border/60 border-t',
          initiallyExpanded && 'bg-foreground/5',
        )}
      >
        <td className="px-2 py-2.5 align-middle">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="text-foreground flex items-center gap-2 text-left text-sm"
          >
            <ChevronRight
              size={14}
              className={cn('text-muted shrink-0 transition-transform', expanded && 'rotate-90')}
            />
            <span className={cn(nested ? 'pl-4 font-normal' : 'font-medium')}>{displayLabel}</span>
          </button>
        </td>
        <td className="text-muted hidden max-w-[160px] truncate px-2 py-2.5 text-xs md:table-cell">
          {item.vendorName || '—'}
        </td>
        <td className="px-2 py-2.5 text-right align-middle">
          {canEdit('BUDGET') ? (
            <MoneyInput
              value={item.allocatedAmount}
              ariaLabel={t('allocated')}
              onCommit={(n) => onPatchAmount('allocatedAmount', n)}
            />
          ) : (
            <span className="text-xs tabular-nums">{money(item.allocatedAmount)}</span>
          )}
        </td>
        <td className="px-2 py-2.5 text-right align-middle">
          {canEdit('BUDGET') ? (
            <MoneyInput
              value={item.spentAmount}
              ariaLabel={t('spent')}
              danger={item.spentAmount > item.allocatedAmount}
              onCommit={(n) => onPatchAmount('spentAmount', n)}
            />
          ) : (
            <span
              className={cn(
                'text-xs tabular-nums',
                item.spentAmount > item.allocatedAmount ? 'text-red-400' : 'text-foreground',
              )}
            >
              {money(item.spentAmount)}
            </span>
          )}
        </td>
        <td className="hidden px-2 py-2.5 text-right align-middle lg:table-cell">
          <span className={cn('text-xs tabular-nums', left < 0 ? 'text-red-400' : 'text-muted')}>
            {left < 0 ? `−${money(Math.abs(left))}` : money(left)}
          </span>
        </td>
        <td className="px-2 py-2.5 align-middle">
          {canEdit('BUDGET') && (
            <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={onEdit}
                className="text-muted hover:bg-foreground/5 hover:text-foreground rounded-md p-1 transition-colors"
                aria-label="Edit"
              >
                <Pencil size={11} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="text-muted rounded-md p-1 transition-colors hover:bg-red-500/8 hover:text-red-400"
                aria-label="Delete"
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td
            colSpan={6}
            className={cn(
              'bg-foreground/[0.02] border-border border-t pt-3 pb-4',
              nested ? 'pr-4 pl-12' : 'px-4',
            )}
          >
            <div className="space-y-3">
              {item.notes && <p className="text-muted text-xs leading-relaxed">{item.notes}</p>}

              {!item.vendorProfileId && item.userVendorContact && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <BookUser size={10} className="text-muted" />
                    <p className="text-muted text-[10px] font-medium tracking-wider uppercase">
                      Vendor contact
                    </p>
                  </div>
                  {item.userVendorContact.email && (
                    <a
                      href={`mailto:${item.userVendorContact.email}`}
                      className="text-muted hover:text-foreground flex items-center gap-2 text-xs transition-colors"
                    >
                      <Mail size={11} className="text-muted shrink-0" />
                      {item.userVendorContact.email}
                    </a>
                  )}
                  {item.userVendorContact.phone && (
                    <a
                      href={`tel:${item.userVendorContact.phone}`}
                      className="text-muted hover:text-foreground flex items-center gap-2 text-xs transition-colors"
                    >
                      <Phone size={11} className="text-muted shrink-0" />
                      {item.userVendorContact.phone}
                    </a>
                  )}
                  {item.userVendorContact.website && (
                    <a
                      href={item.userVendorContact.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted hover:text-foreground flex items-center gap-2 truncate text-xs transition-colors"
                    >
                      <Globe size={11} className="text-muted shrink-0" />
                      {item.userVendorContact.website}
                    </a>
                  )}
                </div>
              )}

              {item.vendorProfileId && item.vendorName && (
                <div className="border-border bg-foreground/5 flex items-center justify-between rounded-xl border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Store size={12} className="text-foreground shrink-0" />
                    <span className="text-foreground text-xs font-medium">{item.vendorName}</span>
                    {inquirySent && (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                        <Check size={9} /> {t('inquirySent')}
                      </span>
                    )}
                  </div>
                  {canEdit('VENDORS') && (
                    <button
                      type="button"
                      onClick={() => setShowContact(true)}
                      disabled={inquirySent}
                      className="btn btn-secondary btn-sm"
                    >
                      <MessageSquare size={11} />
                      {inquirySent ? t('inquirySent') : t('contactVendor')}
                    </button>
                  )}
                </div>
              )}

              <LinkedBudgetInspirations budgetItemId={item.id} />
              <EventItemComments subjectType="BUDGET_ITEM" subjectId={item.id} />

              <div>
                <p className="text-muted mb-2 text-[10px] font-medium tracking-wider uppercase">
                  {t('receipts')}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {item.receipts.map((r) => (
                    <ReceiptThumb
                      key={r.id}
                      receipt={r}
                      eventId={eventId}
                      onDeleted={onReceiptDeleted}
                    />
                  ))}
                  {item.receipts.length === 0 && (
                    <div className="border-border bg-foreground/5 flex h-12 w-12 items-center justify-center rounded-lg border border-dashed">
                      <ImageIcon size={14} className="text-muted" />
                    </div>
                  )}
                  {canEdit('BUDGET') && (
                    <ReceiptUploader eventId={eventId} item={item} onUploaded={onReceiptUploaded} />
                  )}
                </div>
              </div>
            </div>
            {showContact && item.vendorProfileId && item.vendorName && (
              <ContactModal
                eventId={eventId}
                vendorName={item.vendorName}
                vendorProfileId={item.vendorProfileId}
                onClose={() => setShowContact(false)}
                onSent={() => setInquirySent(true)}
              />
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BudgetSection({
  eventId,
  eventTitle,
  initialItems,
  totalBudget,
  focusItemId,
  onCollapse,
}: BudgetSectionProps) {
  const t = useTranslations('budget')
  const tCat = useTranslations('vendorCategories')
  const tPort = useTranslations('dataPort')
  const { canEdit } = useEventAccess()
  const fetched = useLazyGet<EventBudgetItem[]>(initialItems ? null : `/events/${eventId}/budget`)
  const [items, setItems] = useHydratedState(
    fetched.data === undefined ? undefined : Array.isArray(fetched.data) ? fetched.data : [],
    initialItems ?? [],
  )
  const [editingItem, setEditingItem] = useState<EventBudgetItem | null | 'new'>(null)
  const [sortBy, setSortBy] = useState<BudgetSortKey>('allocated-desc')
  const [filterBy, setFilterBy] = useState<BudgetFilterKey>('all')
  const [groupBy, setGroupBy] = useState<BudgetGroupKey>('category')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())
  const [prevGroupBy, setPrevGroupBy] = useState(groupBy)
  if (groupBy !== prevGroupBy) {
    setPrevGroupBy(groupBy)
    setExpandedGroups(new Set())
  }
  const [handledFocus, setHandledFocus] = useState<string | null>(null)
  if (focusItemId && focusItemId !== handledFocus) {
    setHandledFocus(focusItemId)
    setFilterBy('all')
  }
  const [, startTransition] = useTransition()

  const loading = !initialItems && fetched.loading && items.length === 0

  const totalSpent = items.reduce((s, i) => s + i.spentAmount, 0)
  const totalAllocated = items.reduce((s, i) => s + i.allocatedAmount, 0)
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0
  const overCount = items.filter((i) => i.spentAmount > i.allocatedAmount).length
  const unpaidCount = items.filter((i) => i.spentAmount === 0).length
  const vendorCount = items.filter((i) => !!i.vendorName).length

  const FILTER_OPTIONS: { value: BudgetFilterKey; label: string; count: number }[] = [
    { value: 'all', label: t('filters.all'), count: items.length },
    { value: 'over', label: t('filters.over'), count: overCount },
    { value: 'unpaid', label: t('filters.unpaid'), count: unpaidCount },
    { value: 'vendor', label: t('filters.vendor'), count: vendorCount },
  ]

  const GROUP_OPTIONS: { value: BudgetGroupKey; label: string }[] = [
    { value: 'category', label: t('group.category') },
    { value: 'status', label: t('group.status') },
    { value: 'none', label: t('group.none') },
  ]

  const displayed = useMemo(
    () => applyBudgetSortFilter(items, sortBy, filterBy, tCat, t),
    [items, sortBy, filterBy, tCat, t],
  )

  const grouped = useMemo(
    () =>
      groupBudgetItems(displayed, groupBy, tCat, {
        over: t('groups.over'),
        inProgress: t('groups.inProgress'),
        notStarted: t('groups.notStarted'),
      }),
    [displayed, groupBy, tCat, t],
  )

  const labeledKeys = grouped.filter((section) => section.label).map((section) => section.key)
  const allCollapsed =
    labeledKeys.length > 0 && labeledKeys.every((key) => !expandedGroups.has(key))

  if (focusItemId) {
    const section = grouped.find((row) => row.items.some((item) => item.id === focusItemId))
    if (section?.label && !expandedGroups.has(section.key)) {
      setExpandedGroups((prev) => new Set(prev).add(section.key))
    }
  }

  useEffect(() => {
    if (!focusItemId) return
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(`budget-item-${focusItemId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => cancelAnimationFrame(frame)
  }, [focusItemId])

  const handleSaved = (saved: EventBudgetItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [...prev, saved]
    })
  }

  const handleDelete = (itemId: string) => {
    startTransition(async () => {
      try {
        await proxyClient.delete(`/events/${eventId}/budget/${itemId}`)
        setItems((prev) => prev.filter((i) => i.id !== itemId))
      } catch {
        /* silent */
      }
    })
  }

  const handleReceiptUploaded = (itemId: string, receipt: BudgetReceipt) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, receipts: [...i.receipts, receipt] } : i)),
    )
  }

  const handleReceiptDeleted = (itemId: string, receiptId: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, receipts: i.receipts.filter((r) => r.id !== receiptId) } : i,
      ),
    )
  }

  async function patchAmount(
    item: EventBudgetItem,
    field: 'allocatedAmount' | 'spentAmount',
    value: number,
  ) {
    if (!canEdit('BUDGET')) return
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, [field]: value } : i)))
    try {
      const { data } = await proxyClient.patch<EventBudgetItem>(
        `/events/${eventId}/budget/${item.id}`,
        { [field]: value },
      )
      setItems((prev) => prev.map((i) => (i.id === item.id ? data : i)))
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)))
    }
  }

  return (
    <div className="card flex flex-col gap-5 p-5">
      <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                className="text-muted hover:text-foreground mt-0.5 -ml-1 rounded-md p-1"
                aria-label="Collapse"
              >
                <ChevronRight size={14} className="rotate-90" />
              </button>
            )}
            <div>
              <h2 className="text-foreground text-sm font-semibold">{t('title')}</h2>
              <p className="text-muted mt-0.5 text-xs tabular-nums">
                {t('spentOf', { spent: money(totalSpent), total: money(totalBudget) })}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DataPortMenu
              fileBase={fileBase(eventTitle ?? 'event', 'budget')}
              sheetName="Budget"
              headers={BUDGET_HEADERS}
              rows={budgetExportRows(items, (key) => getVendorCategoryLabel(key, tCat))}
              canImport={canEdit('BUDGET')}
              onImport={async (table) => {
                const parsed = parseBudgetTable(table)
                const capped = capImportRows(parsed.items, parsed.issues, tPort('tooManyRows'))
                if (capped.items.length === 0) {
                  return {
                    created: 0,
                    skipped: 0,
                    issues: capped.issues.length ? capped.issues : [tPort('emptyFile')],
                  }
                }
                const { data } = await proxyClient.post<{
                  created: number
                  skipped: number
                  items: EventBudgetItem[]
                }>(`/events/${eventId}/budget/import`, { items: capped.items })
                setItems(data.items)
                return { created: data.created, skipped: data.skipped, issues: capped.issues }
              }}
            />
            {canEdit('BUDGET') && (
              <button
                type="button"
                onClick={() => setEditingItem('new')}
                className="btn btn-secondary btn-sm"
              >
                <Plus size={13} /> {t('addItem')}
              </button>
            )}
          </div>
        </div>
        <div className="progress">
          <div
            className={cn(
              'progress-bar transition-all duration-500',
              overallPct >= 100 && '!bg-red-500',
            )}
            style={{ width: `${Math.min(overallPct, 100)}%` }}
          />
        </div>
        {totalAllocated !== totalBudget && (
          <p className="text-muted mt-1.5 text-[11px]">
            {t('allocatedAcross', { amount: money(totalAllocated) })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex scrollbar-none items-center gap-0.5 overflow-x-auto">
          {FILTER_OPTIONS.map((opt) => {
            if (opt.value !== 'all' && opt.count === 0) return null
            const active = filterBy === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilterBy(opt.value)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] whitespace-nowrap transition-colors',
                  active
                    ? opt.value === 'over'
                      ? 'bg-red-500/10 text-red-300'
                      : 'bg-foreground/5 text-foreground'
                    : 'text-muted hover:text-foreground',
                )}
              >
                {opt.label}
                {opt.value !== 'all' && <span className="text-[10px] opacity-50">{opt.count}</span>}
              </button>
            )
          })}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {labeledKeys.length > 1 && (
            <button
              type="button"
              onClick={() => setExpandedGroups(allCollapsed ? new Set(labeledKeys) : new Set())}
              className="text-muted hover:text-foreground text-[11px] transition-colors"
            >
              {allCollapsed ? t('expandAll') : t('collapseAll')}
            </button>
          )}
          <label className="text-muted flex items-center gap-1.5 text-[11px]">
            <span>{t('groupBy')}</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as BudgetGroupKey)}
              className="text-foreground bg-transparent py-1 text-[11px] outline-none"
            >
              {GROUP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto">
        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : displayed.length === 0 ? (
          <p className="text-muted py-8 text-center text-xs">
            {items.length === 0 ? t('noItems') : t('emptyFilter')}
          </p>
        ) : (
          <table className="w-full min-w-[540px] border-collapse text-sm">
            <thead>
              <tr className="border-border/70 border-b">
                <SortTh
                  label={t('item')}
                  active={sortBy === 'alpha'}
                  onClick={() => setSortBy(sortBy === 'alpha' ? 'allocated-desc' : 'alpha')}
                />
                <th className="text-muted hidden px-2 py-2 text-left text-[10px] font-medium tracking-wide uppercase md:table-cell">
                  {t('vendor')}
                </th>
                <SortTh
                  label={t('allocated')}
                  active={sortBy === 'allocated-asc' || sortBy === 'allocated-desc'}
                  desc={sortBy === 'allocated-desc'}
                  align="right"
                  onClick={() =>
                    setSortBy(sortBy === 'allocated-desc' ? 'allocated-asc' : 'allocated-desc')
                  }
                />
                <SortTh
                  label={t('spent')}
                  active={sortBy === 'spent-asc' || sortBy === 'spent-desc'}
                  desc={sortBy === 'spent-desc'}
                  align="right"
                  onClick={() => setSortBy(sortBy === 'spent-desc' ? 'spent-asc' : 'spent-desc')}
                />
                <SortTh
                  label={t('left')}
                  active={sortBy === 'remaining-asc' || sortBy === 'remaining-desc'}
                  desc={sortBy === 'remaining-desc'}
                  align="right"
                  className="hidden lg:table-cell"
                  onClick={() =>
                    setSortBy(sortBy === 'remaining-asc' ? 'remaining-desc' : 'remaining-asc')
                  }
                />
                <th className="w-14 px-2 py-2" aria-hidden />
              </tr>
            </thead>
            {grouped.map((section) => {
              const sectionAlloc = section.items.reduce((s, i) => s + i.allocatedAmount, 0)
              const sectionSpent = section.items.reduce((s, i) => s + i.spentAmount, 0)
              const isOpen = !section.label || expandedGroups.has(section.key)
              const sectionOver = sectionSpent > sectionAlloc
              return (
                <tbody key={section.key}>
                  {section.label && (
                    <tr>
                      <td colSpan={6} className="px-0 pt-3 pb-0">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() =>
                            setExpandedGroups((prev) => {
                              const next = new Set(prev)
                              if (next.has(section.key)) next.delete(section.key)
                              else next.add(section.key)
                              return next
                            })
                          }
                          className="hover:bg-foreground/[0.03] flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors"
                        >
                          <ChevronRight
                            size={14}
                            className={cn(
                              'text-muted shrink-0 transition-transform',
                              isOpen && 'rotate-90',
                            )}
                          />
                          <span className="text-foreground min-w-0 truncate text-sm font-medium">
                            {section.label}
                          </span>
                          <span className="text-muted text-[11px] tabular-nums">
                            {section.items.length}
                          </span>
                          <span
                            className={cn(
                              'ml-auto shrink-0 text-[11px] tabular-nums',
                              sectionOver ? 'text-red-400' : 'text-muted',
                            )}
                          >
                            {money(sectionSpent)}
                            <span className="opacity-50"> / {money(sectionAlloc)}</span>
                          </span>
                        </button>
                      </td>
                    </tr>
                  )}
                  {isOpen &&
                    section.items.map((item) => (
                      <BudgetRow
                        key={item.id}
                        item={item}
                        eventId={eventId}
                        nested={!!section.label}
                        tCat={tCat}
                        initiallyExpanded={item.id === focusItemId}
                        onEdit={() => setEditingItem(item)}
                        onDelete={() => handleDelete(item.id)}
                        onReceiptUploaded={(r) => handleReceiptUploaded(item.id, r)}
                        onReceiptDeleted={(id) => handleReceiptDeleted(item.id, id)}
                        onPatchAmount={(field, value) => patchAmount(item, field, value)}
                      />
                    ))}
                </tbody>
              )
            })}
          </table>
        )}
      </div>

      {editingItem !== null && (
        <EditModal
          eventId={eventId}
          item={editingItem === 'new' ? undefined : editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
