export interface UserMe {
  id: string
  clerkId: string
  email?: string
  phone?: string | null
  role: 'USER' | 'VENDOR' | 'ADMIN'
  onboardingCompletedAt: string | null
  hasVendorProfile: boolean
  activeMode: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  tribes: string[]
  city: string | null
  countryOfOrigin: string | null
  dateOfBirth: string | null
}

export type EventType =
  | 'WEDDING'
  | 'INTRODUCTION'
  | 'BRIDE_PRICE'
  | 'TRADITIONAL_WEDDING'
  | 'COURT'
  | 'WHITE_WEDDING'
  | 'RECEPTION'
  | 'ENGAGEMENT'
  | 'NAMING_CEREMONY'
  | 'CUSTOM'

export type WeddingTheme =
  | 'TRADITIONAL'
  | 'WHITE_WEDDING'
  | 'FUSION'
  | 'OUTDOOR'
  | 'INDOOR_LUXURY'
  | 'GARDEN'
  | 'REGAL'
  | 'BLACK_TIE'
  | 'INTIMATE'
  | 'MODERN'

export type VendorCategory =
  | 'CATERER'
  | 'DJ'
  | 'PHOTOGRAPHER'
  | 'VIDEOGRAPHER'
  | 'DECORATOR'
  | 'MAKEUP_ARTIST'
  | 'MC'
  | 'WEDDING_PLANNER'
  | 'FASHION_STYLIST'
  | 'LIVE_BAND'
  | 'OTHER'

export interface BudgetReceipt {
  id: string
  budgetItemId: string
  filename: string
  url: string
  mimeType: string | null
  fileSize: number | null
  createdAt: string
}

export interface UserVendorContact {
  id: string
  name: string
  category: VendorCategory | null
  email: string | null
  phone: string | null
  website: string | null
  notes: string | null
  vendorProfileId: string | null
  createdAt: string
  updatedAt: string
  vendorProfile?: {
    id: string
    slug: string
    isVerified: boolean
    averageRating: number | null
  } | null
}

export interface EventBudgetItem {
  id: string
  category: VendorCategory
  label: string
  vendorName: string | null
  vendorProfileId: string | null
  userVendorContactId: string | null
  userVendorContact: UserVendorContact | null
  notes: string | null
  allocatedAmount: number
  spentAmount: number
  currency: string
  receipts: BudgetReceipt[]
}

export interface EventChecklistVendor {
  id?: string
  vendorProfileId: string | null
  userVendorContactId: string | null
  name: string | null
  vendorProfile: {
    id: string
    businessName: string
    isVerified: boolean
    slug: string
  } | null
  userVendorContact: UserVendorContact | null
}

export interface EventChecklistItem {
  id: string
  title: string
  isCompleted: boolean
  dueDate: string | null
  sortOrder: number
  notifyByEmail: boolean
  notifyBySms: boolean
  needsVendor: boolean
  vendorCategory: string | null
  vendors?: EventChecklistVendor[]
  vendorProfileId: string | null
  userVendorContactId: string | null
  userVendorContact: UserVendorContact | null
  assigneeUserId?: string | null
  assignee?: { id: string; firstName: string | null; lastName: string | null } | null
  hiddenFromMemberIds?: string[]
  vendorProfile: {
    id: string
    businessName: string
    isVerified: boolean
    slug: string
  } | null
}

export interface EventScheduleItem {
  id: string
  title: string
  notes: string | null
  date: string | null
  startTime: string | null
  endTime: string | null
  location: string | null
  sortOrder: number
  budgetItems: {
    id: string
    label: string | null
    vendorName: string | null
    category: VendorCategory
    allocatedAmount: number
  }[]
  checklistItems: {
    id: string
    title: string
    isCompleted: boolean
  }[]
}

export type EventSurface = 'SCHEDULE' | 'CHECKLIST' | 'BUDGET' | 'MOODBOARD' | 'VENDORS' | 'GUESTS'
export type EventMemberRole = 'HOST' | 'EDITOR' | 'COMMENTER' | 'VIEWER'

export const ALL_EVENT_SURFACES: EventSurface[] = [
  'SCHEDULE',
  'CHECKLIST',
  'BUDGET',
  'MOODBOARD',
  'VENDORS',
  'GUESTS',
]

export interface EventViewer {
  isHost: boolean
  role: EventMemberRole
  surfaces: EventSurface[]
  memberId?: string | null
  userId?: string | null
}

export interface EventStats {
  spentTotal: number
  checklistDone: number
  checklistTotal: number
  scheduleCount: number
  confirmedGuestCount: number
}

export interface Event {
  id: string
  title: string
  eventType: EventType
  tribes: string[]
  themes: WeddingTheme[]
  estimatedDate: string | null
  location: string | null
  totalBudget: number
  currency: string
  guestCount: number | null
  notes: string | null
  isCompleted: boolean
  parentId?: string | null
  sortOrder?: number
  createdAt: string
  budgetItems?: EventBudgetItem[]
  checklist?: EventChecklistItem[]
  schedule?: EventScheduleItem[]
  stats?: EventStats
  viewer?: EventViewer
  parent?: { id: string; title: string } | null
  children?: EventJourneyStop[]
  treeBudget?: {
    pot: number
    envelopesTotal: number
    spentTotal: number
  } | null
}

export interface UserChecklist {
  id: string
  title: string
  isCompleted: boolean
  dueDate: string | null
  eventId: string | null
  eventChecklistId: string | null
  event: { id: string; title: string } | null
  assigneeUserId?: string
  source?: 'MINE' | 'ASSIGNED' | 'EVENT'
  createdAt: string
  updatedAt: string
}

export interface UserChecklistPage {
  items: UserChecklist[]
  nextCursor: string | null
}

export interface EventJourneyStop {
  id: string
  title: string
  eventType: EventType
  tribes?: string[]
  estimatedDate: string | null
  location?: string | null
  sortOrder: number
  isCompleted: boolean
  allocatedBudget?: number
  spentAmount?: number
}

export interface ChildGrant {
  eventId: string
  surfaces: EventSurface[]
}

export interface InAppNotification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface NotificationsResponse {
  notifications: InAppNotification[]
  unreadCount: number
}

export type RsvpStatus = 'PENDING' | 'ATTENDING' | 'DECLINED' | 'MAYBE'

export interface GuestInvite {
  id: string
  token: string
  sentAt: string | null
  sentVia: string | null
  expiresAt: string | null
  customNote: string | null
  rsvpStatus: RsvpStatus
  rsvpAt: string | null
  plusOneName: string | null
  dietaryNote: string | null
  guestMessage: string | null
}

export interface Guest {
  id: string
  eventId: string
  firstName: string
  lastName: string | null
  email: string | null
  phone: string | null
  note: string | null
  plusOneAllowed: boolean
  tableNumber: string | null
  createdAt: string
  invite: GuestInvite | null
}

export interface MyVendorProfile {
  id: string
  slug: string
  businessName: string
  category: VendorCategory
  categories: VendorCategory[]
  bio: string | null
  tribesServed: string[]
  estimatedPriceFrom: number | null
  estimatedPriceTo: number | null
  currency: string
  websiteUrl: string | null
  instagramUrl: string | null
  facebookUrl: string | null
  externalPortfolioUrl: string | null
  externalPortfolioLabel: string | null
  isVerified: boolean
  isActive: boolean
  averageRating: number | null
  totalReviews: number
  createdAt: string
  city: string | null
  inquiryCount: number
  portfolioCount: number
  reviewCount: number
  bookingCount: number
  profileViews?: number
}

export type InspirationVisibility = 'DRAFT' | 'PROFILE' | 'INSPIRATION'
export type InspirationMediaType = 'IMAGE' | 'VIDEO' | 'EXTERNAL'
export type InspirationCategory =
  'PERFORMANCE' | 'VENUE' | 'DECOR' | 'MUSIC' | 'FASHION' | 'FOOD' | 'OTHER'

export interface VendorPostMedia {
  id: string
  url: string
  mediaType: InspirationMediaType
  caption: string | null
  isCover: boolean
  sortOrder: number
}

export interface VendorPostTag {
  slug: string
  label: string
  isCurated: boolean
}

export interface VendorPost {
  id: string
  title: string
  description: string
  category: InspirationCategory
  categories?: InspirationCategory[]
  location: string | null
  priceRangeFrom: number | null
  priceRangeTo: number | null
  currency: string
  costNote: string | null
  visibility: InspirationVisibility
  imageUrl: string | null
  isAdminCurated: boolean
  createdAt: string
  tags: string[]
  tagItems: VendorPostTag[]
  media: VendorPostMedia[]
  vendorProfile: {
    id: string
    slug: string
    businessName: string
    isVerified: boolean
    avatarUrl: string | null
    city: string | null
  } | null
}
