export const queryKeys = {
  inquiriesMe: ['inquiries', 'me'] as const,
  inquiriesVendor: ['inquiries', 'vendor'] as const,
  vendors: (category: string) => ['vendors', category] as const,
  likedLooks: ['inspiration', 'liked'] as const,
  likedVendors: ['vendors', 'favorites'] as const,
  inspirationLikedIds: ['inspiration', 'likedIds'] as const,
  inspirationTags: ['inspiration', 'tags'] as const,
  inspirationSaved: ['inspiration', 'saved'] as const,
  inspirationFeed: (q: string, category: string, tag: string) =>
    ['inspiration', 'feed', q, category, tag] as const,
  inspirationItem: (id: string) => ['inspiration', 'item', id] as const,
  inspirationMatchingVendors: (id: string) => ['inspiration', 'matching-vendors', id] as const,
}
