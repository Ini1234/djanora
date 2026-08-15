'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, X, Check, Upload, FileText,
  Image as ImageIcon, Loader2, ChevronDown, ChevronUp,
  Store, Search, Star, BadgeCheck, MessageSquare, Send,
  Mail, Phone, Globe, BookUser, Sparkles,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
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

function getErrorMessage(err: unknown, fallback: string) {
  const maybe = err as {
    response?: { data?: { message?: unknown } }
    message?: unknown
  }
  const apiMessage = maybe.response?.data?.message
  if (typeof apiMessage === 'string') return apiMessage
  if (typeof maybe.message === 'string') return maybe.message
  return fallback
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
      const { data } = await proxyClient.get<UserVendorContact[]>(`/vendor-contacts?category=${cat}`)
      setMyContacts(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      fetchVendors(category)
      fetchContacts(category)
    })
    return () => { cancelled = true }
  }, [category, fetchVendors, fetchContacts])

  const filteredVendors = vendors.filter((v) =>
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

        const url = isNew
          ? `/events/${eventId}/budget`
          : `/events/${eventId}/budget/${item.id}`

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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-brand-800 border border-white/10 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <h3 className="font-semibold text-white text-sm">
            {isNew ? 'Add budget item' : 'Edit budget item'}
          </h3>
          <button onClick={onClose} className="text-brand-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-brand-300 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              disabled={!isNew}
              className="w-full rounded-xl bg-white/6 border border-white/10 px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 disabled:opacity-50"
            >
              {VENDOR_CATEGORY_KEYS.map((key) => (
                <option key={key} value={key} className="bg-brand-800">
                  {getVendorCategoryLabel(key, tCat)}
                </option>
              ))}
            </select>
          </div>

          {/* Custom label */}
          <div>
            <label className="block text-xs font-medium text-brand-300 mb-1.5">
              Custom label <span className="text-brand-500">(optional)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`e.g. "Second photographer"`}
              className="w-full rounded-xl bg-white/6 border border-white/10 px-3 py-2.5 text-white placeholder:text-brand-500 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40"
            />
          </div>

          {/* ── Vendor picker ── */}
          <div>
            <label className="block text-xs font-medium text-brand-300 mb-2">
              Vendor <span className="text-brand-500">(optional)</span>
            </label>

            {/* Selected vendor chip */}
            {vendorName && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-gold-500/10 border border-gold-500/25 text-gold-300 text-sm">
                  {selectedContactId ? (
                    <BookUser size={13} className="text-gold-400 shrink-0" />
                  ) : (
                    <Store size={13} className="text-gold-400 shrink-0" />
                  )}
                  <span className="truncate">{vendorName}</span>
                  {selectedContactId && (
                    <span className="text-[10px] text-brand-500 shrink-0">saved contact</span>
                  )}
                  {selectedVendorProfileId && (
                    <BadgeCheck size={11} className="text-gold-400 shrink-0" aria-label="Registered vendor" />
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
                  className="p-1.5 rounded-lg text-brand-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Remove"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {!vendorName && (
              <div className="rounded-xl border border-white/10 bg-white/4 overflow-hidden">
                {loadingVendors ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-brand-500 text-xs">
                    <Loader2 size={13} className="animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <>
                    {/* My saved contacts section */}
                    {filteredContacts.length > 0 && !customMode && (
                      <div className="border-b border-white/8">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-brand-500 uppercase tracking-wider">
                          <BookUser size={9} />
                          My contacts
                        </div>
                        {myContacts.length > 3 && (
                          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/6">
                            <Search size={10} className="text-brand-600 shrink-0" />
                            <input
                              type="text"
                              value={contactSearch}
                              onChange={(e) => setContactSearch(e.target.value)}
                              placeholder="Search contacts…"
                              className="flex-1 bg-transparent text-xs text-white placeholder:text-brand-600 focus:outline-none"
                            />
                          </div>
                        )}
                        <ul className="divide-y divide-white/5 max-h-32 overflow-y-auto">
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
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/6 transition-colors text-left group"
                              >
                                <div className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center shrink-0">
                                  <BookUser size={10} className="text-brand-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-white truncate block group-hover:text-gold-200 transition-colors">
                                    {c.name}
                                  </span>
                                  {(c.email || c.phone) && (
                                    <span className="text-[10px] text-brand-500 truncate block">
                                      {c.email ?? c.phone}
                                    </span>
                                  )}
                                </div>
                                <Check size={11} className="text-gold-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Registered vendors list */}
                    {vendors.length > 0 && !customMode && (
                      <>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-brand-500 uppercase tracking-wider border-b border-white/6">
                          <Store size={9} />
                          Registered vendors
                        </div>
                        {/* Search */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/8">
                          <Search size={11} className="text-brand-600 shrink-0" />
                          <input
                            ref={searchRef}
                            type="text"
                            value={vendorSearch}
                            onChange={(e) => setVendorSearch(e.target.value)}
                            placeholder={`Search ${vendors.length} ${getVendorCategoryLabel(category, tCat)} vendors…`}
                            className="flex-1 bg-transparent text-xs text-white placeholder:text-brand-600 focus:outline-none"
                          />
                          {vendorSearch && (
                            <button onClick={() => setVendorSearch('')} className="text-brand-600 hover:text-white transition-colors">
                              <X size={10} />
                            </button>
                          )}
                        </div>

                        {/* Vendor rows */}
                        <ul className="divide-y divide-white/5 max-h-40 overflow-y-auto">
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
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/6 transition-colors text-left group"
                              >
                                {v.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={v.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center shrink-0">
                                    <Store size={13} className="text-brand-500" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm text-white truncate group-hover:text-gold-200 transition-colors">
                                      {v.businessName}
                                    </span>
                                    {v.isVerified && (
                                      <BadgeCheck size={12} className="text-gold-400 shrink-0" aria-label="Verified" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {v.city && <span className="text-[10px] text-brand-500">{v.city}</span>}
                                    {v.averageRating !== null && (
                                      <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                                        <Star size={8} fill="currentColor" />
                                        {v.averageRating.toFixed(1)}
                                        <span className="text-brand-600">({v.totalReviews})</span>
                                      </span>
                                    )}
                                    {v.estimatedPriceFrom !== null && (
                                      <span className="text-[10px] text-brand-500">
                                        from {v.currency}${v.estimatedPriceFrom.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Check size={12} className="text-gold-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            </li>
                          ))}

                          {filteredVendors.length === 0 && (
                            <li className="px-3 py-4 text-xs text-brand-600 text-center italic">
                              No vendors found for &ldquo;{vendorSearch}&rdquo;
                            </li>
                          )}
                        </ul>

                        {/* Footer — add custom */}
                        <div className="border-t border-white/8">
                          <button
                            type="button"
                            onClick={() => { setCustomMode(true); setVendorSearch('') }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-brand-400 hover:text-gold-300 hover:bg-white/5 transition-colors"
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
                            onClick={() => { setCustomMode(false); setVendorSearch('') }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-brand-500 hover:text-brand-200 border-b border-white/8 transition-colors"
                          >
                            ← Back to vendor list
                          </button>
                        )}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <Store size={12} className="text-brand-500 shrink-0" />
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
                            className="flex-1 bg-transparent text-sm text-white placeholder:text-brand-600 focus:outline-none"
                          />
                          {vendorSearch.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                setVendorName(vendorSearch.trim())
                                setVendorSearch('')
                                setSaveToContacts(true)
                              }}
                              className="shrink-0 text-[10px] px-2 py-0.5 rounded-md bg-gold-600/15 border border-gold-500/25 text-gold-300 hover:bg-gold-600/25 transition-colors"
                            >
                              Add
                            </button>
                          )}
                        </div>
                        {vendors.length === 0 && (
                          <p className="px-3 pb-2.5 text-[10px] text-brand-600">
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
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/3 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-brand-300 uppercase tracking-wider">
                  Contact details
                </p>
                {/* Save to contacts toggle */}
                {!selectedContactId && (
                  <button
                    type="button"
                    onClick={() => setSaveToContacts((v) => !v)}
                    className={cn(
                      'flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg border transition-colors',
                      saveToContacts
                        ? 'bg-gold-600/20 border-gold-500/30 text-gold-300'
                        : 'bg-white/5 border-white/10 text-brand-500 hover:text-brand-300',
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
                  <Mail size={13} className="text-brand-500 shrink-0" />
                  <input
                    type="email"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    placeholder="vendor@email.com"
                    className="flex-1 rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-white placeholder:text-brand-600 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                  />
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone size={13} className="text-brand-500 shrink-0" />
                  <input
                    type="tel"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="flex-1 rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-white placeholder:text-brand-600 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                  />
                </div>
                <div className="flex items-center gap-2.5">
                  <Globe size={13} className="text-brand-500 shrink-0" />
                  <input
                    type="url"
                    value={newContactWebsite}
                    onChange={(e) => setNewContactWebsite(e.target.value)}
                    placeholder="https://vendor-website.com"
                    className="flex-1 rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-white placeholder:text-brand-600 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-brand-300 mb-1.5">
                Allocated (CA$) <span className="text-gold-500">*</span>
              </label>
              <input
                type="number"
                value={allocated}
                onChange={(e) => setAllocated(e.target.value)}
                min={0}
                placeholder="0"
                className="w-full rounded-xl bg-white/6 border border-white/10 px-3 py-2.5 text-white placeholder:text-brand-500 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-300 mb-1.5">
                Spent (CA$)
              </label>
              <input
                type="number"
                value={spent}
                onChange={(e) => setSpent(e.target.value)}
                min={0}
                placeholder="0"
                className="w-full rounded-xl bg-white/6 border border-white/10 px-3 py-2.5 text-white placeholder:text-brand-500 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-brand-300 mb-1.5">
              Notes <span className="text-brand-500">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Payment terms, contract info, etc."
              className="w-full rounded-xl bg-white/6 border border-white/10 px-3 py-2.5 text-white placeholder:text-brand-500 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/8 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-brand-300 hover:text-white hover:bg-white/8 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || !allocated}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-600 hover:bg-gold-500 disabled:opacity-50 text-brand-900 font-semibold text-sm transition-colors"
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
      <p className="text-[10px] font-medium text-brand-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Sparkles size={10} /> Linked Inspiration ({items.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map(({ id, inspirationItem: insp }) => (
          <div
            key={id}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {insp.imageUrl && (
              <img src={insp.imageUrl} alt={insp.title} className="w-5 h-5 rounded object-cover" />
            )}
            <span className="text-brand-300 truncate max-w-[120px]">{insp.title}</span>
            <span className="text-brand-600 text-[10px]">{insp.category.charAt(0) + insp.category.slice(1).toLowerCase()}</span>
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
        { headers: { 'Content-Type': 'multipart/form-data' } },
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
        className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-gold-400 transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {uploading ? 'Uploading…' : 'Add receipt'}
      </button>
      {error && <p className="text-red-400 text-[10px] mt-1">{error}</p>}
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
      await proxyClient.delete(
        `/events/${eventId}/budget/unused/receipts/${receipt.id}`,
      )
      onDeleted(receipt.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="relative group">
      <a
        href={receipt.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center w-12 h-12 rounded-lg border border-white/10 bg-white/5 hover:border-gold-500/40 overflow-hidden transition-colors"
        title={receipt.filename}
      >
        {isPdf ? (
          <FileText size={18} className="text-brand-400" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={receipt.url} alt={receipt.filename} className="w-full h-full object-cover" />
        )}
      </a>
      {canEdit('BUDGET') && (
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
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

function ContactModal({ eventId, vendorName, vendorProfileId, onClose, onSent }: ContactModalProps) {
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-brand-800 border border-white/10 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h3 className="font-semibold text-white text-sm">Contact vendor</h3>
            <p className="text-xs text-brand-400 mt-0.5">{vendorName}</p>
          </div>
          <button onClick={onClose} className="text-brand-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-brand-300 mb-1.5">
              Your message <span className="text-gold-500">*</span>
            </label>
            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder={`Hi ${vendorName}, I'm interested in booking you for my event…`}
              className="w-full rounded-xl bg-white/6 border border-white/10 px-3 py-2.5 text-white placeholder:text-brand-500 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/40 resize-none"
            />
            <p className="text-[10px] text-brand-600 mt-1">
              {message.trim().length} / 2000 chars — minimum {MIN}
            </p>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/8">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-brand-300 hover:text-white hover:bg-white/8 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isPending || message.trim().length < MIN}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-600 hover:bg-gold-500 disabled:opacity-50 text-brand-900 font-semibold text-sm transition-colors"
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

function BudgetRow({ item, eventId, onEdit, onDelete, onReceiptUploaded, onReceiptDeleted, initiallyExpanded = false }: BudgetRowProps) {
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
      className="rounded-xl border border-white/8 bg-white/3 overflow-hidden"
      style={initiallyExpanded ? { outline: '1px solid color-mix(in srgb, var(--color-brand-primary) 45%, transparent)' } : undefined}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Name + vendor */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{displayLabel}</span>
            {item.vendorName && (
              <span className="text-xs text-brand-500 truncate hidden sm:block">· {item.vendorName}</span>
            )}
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  pct >= 100 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-gradient-to-r from-gold-600 to-gold-400',
                )}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-brand-500 shrink-0">
              {Math.round(pct)}%
            </span>
          </div>
        </div>

        {/* Amounts */}
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-white">
            CA${item.spentAmount.toLocaleString('en-CA')}
          </p>
          <p className="text-[10px] text-brand-500">
            of CA${item.allocatedAmount.toLocaleString('en-CA')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 rounded-lg text-brand-400 hover:text-white hover:bg-white/8 transition-colors"
            title="Details & receipts"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {canEdit('BUDGET') && (
          <>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-brand-400 hover:text-white hover:bg-white/8 transition-colors"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-brand-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
        <div className="px-4 pb-4 border-t border-white/6 pt-3 space-y-3">
          {/* Notes */}
          {item.notes && (
            <p className="text-xs text-brand-300 leading-relaxed">{item.notes}</p>
          )}

          {/* Vendor contact — from personal contact book */}
          {!item.vendorProfileId && item.userVendorContact && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <BookUser size={10} className="text-brand-500" />
                <p className="text-[10px] font-medium text-brand-500 uppercase tracking-wider">Vendor contact</p>
              </div>
              {item.userVendorContact.email && (
                <a href={`mailto:${item.userVendorContact.email}`}
                  className="flex items-center gap-2 text-xs text-brand-300 hover:text-gold-300 transition-colors">
                  <Mail size={11} className="text-brand-500 shrink-0" />
                  {item.userVendorContact.email}
                </a>
              )}
              {item.userVendorContact.phone && (
                <a href={`tel:${item.userVendorContact.phone}`}
                  className="flex items-center gap-2 text-xs text-brand-300 hover:text-gold-300 transition-colors">
                  <Phone size={11} className="text-brand-500 shrink-0" />
                  {item.userVendorContact.phone}
                </a>
              )}
              {item.userVendorContact.website && (
                <a href={item.userVendorContact.website} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-brand-300 hover:text-gold-300 transition-colors truncate">
                  <Globe size={11} className="text-brand-500 shrink-0" />
                  {item.userVendorContact.website}
                </a>
              )}
            </div>
          )}

          {/* Contact vendor — only when linked to a registered profile */}
          {item.vendorProfileId && item.vendorName && (
            <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-gold-500/8 border border-gold-500/20">
              <div className="flex items-center gap-2">
                <Store size={12} className="text-gold-400 shrink-0" />
                <span className="text-xs text-gold-300 font-medium">{item.vendorName}</span>
                {inquirySent && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                    <Check size={9} /> Inquiry sent
                  </span>
                )}
              </div>
              {canEdit('VENDORS') && (
              <button
                onClick={() => setShowContact(true)}
                disabled={inquirySent}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-gold-600/20 border border-gold-500/30 text-gold-300 hover:bg-gold-600/35 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            <p className="text-[10px] font-medium text-brand-500 uppercase tracking-wider mb-2">
              Receipts & attachments
            </p>
            <div className="flex items-center flex-wrap gap-2">
              {item.receipts.map((r) => (
                <ReceiptThumb
                  key={r.id}
                  receipt={r}
                  eventId={eventId}
                  onDeleted={onReceiptDeleted}
                />
              ))}
              {item.receipts.length === 0 && (
                <div className="flex items-center gap-1.5 w-12 h-12 rounded-lg border border-dashed border-white/15 bg-white/3 justify-center">
                  <ImageIcon size={14} className="text-brand-600" />
                </div>
              )}
              {canEdit('BUDGET') && (
              <ReceiptUploader
                eventId={eventId}
                item={item}
                onUploaded={onReceiptUploaded}
              />
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

export function BudgetSection({ eventId, initialItems, totalBudget, focusItemId }: BudgetSectionProps) {
  const { canEdit } = useEventAccess()
  const [items, setItems] = useState<EventBudgetItem[]>(initialItems)
  const [editingItem, setEditingItem] = useState<EventBudgetItem | null | 'new'>(null)
  const [, startTransition] = useTransition()

  const totalSpent = items.reduce((s, i) => s + i.spentAmount, 0)
  const totalAllocated = items.reduce((s, i) => s + i.allocatedAmount, 0)
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  useEffect(() => {
    if (!focusItemId) return
    document.getElementById(`budget-item-${focusItemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
      } catch { /* silent */ }
    })
  }

  const handleReceiptUploaded = (itemId: string, receipt: BudgetReceipt) => {
    setItems((prev) =>
      prev.map((i) => i.id === itemId ? { ...i, receipts: [...i.receipts, receipt] } : i),
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
    <div className="rounded-2xl bg-white/4 border border-white/10 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white">Budget</h2>
        {canEdit('BUDGET') && (
        <button
          onClick={() => setEditingItem('new')}
          className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-gold-400 hover:bg-gold-500/10 px-2.5 py-1.5 rounded-lg transition-colors border border-transparent hover:border-gold-500/20"
        >
          <Plus size={13} /> Add item
        </button>
        )}
      </div>

      {/* Overall progress */}
      <div className="mb-1">
        <div className="flex justify-between text-xs text-brand-400 mb-1.5">
          <span>CA${totalSpent.toLocaleString('en-CA')} spent</span>
          <span>CA${totalBudget.toLocaleString('en-CA')} total</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden mb-1">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              overallPct >= 100 ? 'bg-red-500' : 'bg-gradient-to-r from-gold-600 to-gold-400',
            )}
            style={{ width: `${Math.min(overallPct, 100)}%` }}
          />
        </div>
        {totalAllocated !== totalBudget && (
          <p className="text-[10px] text-brand-600">
            CA${totalAllocated.toLocaleString('en-CA')} allocated across categories
          </p>
        )}
      </div>

      {/* Items */}
      <div className="space-y-2 mt-4 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
        {items.length === 0 ? (
          <p className="text-center text-brand-500 text-sm py-6">No budget items yet — add one above.</p>
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
