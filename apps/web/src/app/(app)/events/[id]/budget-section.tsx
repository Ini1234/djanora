'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
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
import { VENDOR_CATEGORY_KEYS, getVendorCategoryLabel } from '@/lib/vendor-categories'
import type { EventBudgetItem, BudgetReceipt, UserVendorContact } from '@/lib/api.types'
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
  initialItems: EventBudgetItem[]
  totalBudget: number
  focusItemId?: string
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

// ─── Budget row ───────────────────────────────────────────────────────────────

interface BudgetRowProps {
  item: EventBudgetItem
  eventId: string
  onEdit: () => void
  onDelete: () => void
  onReceiptUploaded: (r: BudgetReceipt) => void
  onReceiptDeleted: (id: string) => void
  initiallyExpanded?: boolean
}

function BudgetRow({
  item,
  eventId,
  onEdit,
  onDelete,
  onReceiptUploaded,
  onReceiptDeleted,
  initiallyExpanded = false,
}: BudgetRowProps) {
  const tCat = useTranslations('vendorCategories')
  const { canEdit } = useEventAccess()
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const [showContact, setShowContact] = useState(false)
  const [inquirySent, setInquirySent] = useState(false)
  const pct = item.allocatedAmount > 0 ? (item.spentAmount / item.allocatedAmount) * 100 : 0
  const displayLabel = item.label || getVendorCategoryLabel(item.category, tCat)

  return (
    <div
      id={`budget-item-${item.id}`}
      className="border-border bg-foreground/5 overflow-hidden rounded-xl border"
      style={
        initiallyExpanded
          ? { outline: '1px solid color-mix(in srgb, var(--color-brand-primary) 45%, transparent)' }
          : undefined
      }
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Name + vendor */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-foreground truncate text-sm font-medium">{displayLabel}</span>
            {item.vendorName && (
              <span className="text-muted hidden truncate text-xs sm:block">
                · {item.vendorName}
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="bg-foreground/5 h-1 flex-1 overflow-hidden rounded-full">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  pct >= 100
                    ? 'bg-red-500'
                    : pct > 75
                      ? 'bg-amber-500'
                      : 'from-gold-600 to-gold-400 bg-gradient-to-r',
                )}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="text-muted shrink-0 text-[10px]">{Math.round(pct)}%</span>
          </div>
        </div>

        {/* Amounts */}
        <div className="shrink-0 text-right">
          <p className="text-foreground text-sm font-semibold">
            CA${item.spentAmount.toLocaleString('en-CA')}
          </p>
          <p className="text-muted text-[10px]">
            of CA${item.allocatedAmount.toLocaleString('en-CA')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-muted hover:bg-foreground/5 hover:text-foreground rounded-lg p-1.5 transition-colors"
            title="Details & receipts"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {canEdit('BUDGET') && (
            <>
              <button
                onClick={onEdit}
                className="text-muted hover:bg-foreground/5 hover:text-foreground rounded-lg p-1.5 transition-colors"
                title="Edit"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={onDelete}
                className="text-muted rounded-lg p-1.5 transition-colors hover:bg-red-500/10 hover:text-red-400"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-border space-y-3 border-t px-4 pt-3 pb-4">
          {/* Notes */}
          {item.notes && <p className="text-muted text-xs leading-relaxed">{item.notes}</p>}

          {/* Vendor contact — from personal contact book */}
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

          {/* Contact vendor — only when linked to a registered profile */}
          {item.vendorProfileId && item.vendorName && (
            <div className="bg-gold-500/8 border-gold-500/20 flex items-center justify-between rounded-xl border px-3 py-2">
              <div className="flex items-center gap-2">
                <Store size={12} className="text-foreground shrink-0" />
                <span className="text-foreground text-xs font-medium">{item.vendorName}</span>
                {inquirySent && (
                  <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                    <Check size={9} /> Inquiry sent
                  </span>
                )}
              </div>
              {canEdit('VENDORS') && (
                <button
                  onClick={() => setShowContact(true)}
                  disabled={inquirySent}
                  className="bg-gold-600/20 border-gold-500/30 text-foreground hover:bg-gold-600/35 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <MessageSquare size={11} />
                  {inquirySent ? 'Inquiry sent' : 'Contact vendor'}
                </button>
              )}
            </div>
          )}

          {/* Linked inspirations */}
          <LinkedBudgetInspirations budgetItemId={item.id} />

          <EventItemComments subjectType="BUDGET_ITEM" subjectId={item.id} />

          {/* Receipts */}
          <div>
            <p className="text-muted mb-2 text-[10px] font-medium tracking-wider uppercase">
              Receipts & attachments
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
                <div className="border-border bg-foreground/5 flex h-12 w-12 items-center justify-center gap-1.5 rounded-lg border border-dashed">
                  <ImageIcon size={14} className="text-muted" />
                </div>
              )}
              {canEdit('BUDGET') && (
                <ReceiptUploader eventId={eventId} item={item} onUploaded={onReceiptUploaded} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact modal — rendered outside the expanded panel so z-index works */}
      {showContact && item.vendorProfileId && item.vendorName && (
        <ContactModal
          eventId={eventId}
          vendorName={item.vendorName}
          vendorProfileId={item.vendorProfileId}
          onClose={() => setShowContact(false)}
          onSent={() => setInquirySent(true)}
        />
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BudgetSection({
  eventId,
  initialItems,
  totalBudget,
  focusItemId,
}: BudgetSectionProps) {
  const { canEdit } = useEventAccess()
  const [items, setItems] = useState<EventBudgetItem[]>(initialItems)
  const [editingItem, setEditingItem] = useState<EventBudgetItem | null | 'new'>(null)
  const [, startTransition] = useTransition()

  const totalSpent = items.reduce((s, i) => s + i.spentAmount, 0)
  const totalAllocated = items.reduce((s, i) => s + i.allocatedAmount, 0)
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  useEffect(() => {
    if (!focusItemId) return
    document
      .getElementById(`budget-item-${focusItemId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-foreground font-semibold">Budget</h2>
        {canEdit('BUDGET') && (
          <button onClick={() => setEditingItem('new')} className="btn btn-secondary btn-sm">
            <Plus size={13} /> Add item
          </button>
        )}
      </div>

      {/* Overall progress */}
      <div className="mb-1">
        <div className="text-muted mb-1.5 flex justify-between text-xs">
          <span>CA${totalSpent.toLocaleString('en-CA')} spent</span>
          <span>CA${totalBudget.toLocaleString('en-CA')} total</span>
        </div>
        <div className="bg-foreground/5 mb-1 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              overallPct >= 100 ? 'bg-red-500' : 'from-gold-600 to-gold-400 bg-gradient-to-r',
            )}
            style={{ width: `${Math.min(overallPct, 100)}%` }}
          />
        </div>
        {totalAllocated !== totalBudget && (
          <p className="text-muted text-[10px]">
            CA${totalAllocated.toLocaleString('en-CA')} allocated across categories
          </p>
        )}
      </div>

      {/* Items */}
      <div className="mt-4 max-h-[420px] scrollbar-thin space-y-2 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="text-muted py-6 text-center text-sm">
            No budget items yet — add one above.
          </p>
        ) : (
          items.map((item) => (
            <BudgetRow
              key={item.id}
              item={item}
              eventId={eventId}
              initiallyExpanded={item.id === focusItemId}
              onEdit={() => setEditingItem(item)}
              onDelete={() => handleDelete(item.id)}
              onReceiptUploaded={(r) => handleReceiptUploaded(item.id, r)}
              onReceiptDeleted={(id) => handleReceiptDeleted(item.id, id)}
            />
          ))
        )}
      </div>

      {/* Modal */}
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
