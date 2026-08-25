import type { InspirationCategory } from '@/lib/api.types'

export function lookCategories(item: {
  category: string
  categories?: string[] | null
}): InspirationCategory[] {
  const raw = item.categories?.length ? item.categories : [item.category]
  return [...new Set(raw.filter(Boolean))] as InspirationCategory[]
}

export function lookInCategory(
  item: { category: string; categories?: string[] | null },
  category: string,
) {
  return lookCategories(item).includes(category as InspirationCategory)
}

export function lookCategoryLabel(categories: string[]) {
  return categories.map((c) => c.replaceAll('_', ' ')).join(' · ')
}
