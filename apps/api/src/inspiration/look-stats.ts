import type { PrismaService } from '../prisma/prisma.service'

export async function attachLookStats<T extends { id: string }>(
  prisma: PrismaService,
  items: T[],
): Promise<(T & { likeCount: number; saveCount: number })[]> {
  if (items.length === 0) return []

  const ids = items.map((item) => item.id)
  const [likeGroups, saveRows] = await Promise.all([
    prisma.inspirationLike.groupBy({
      by: ['inspirationItemId'],
      where: { inspirationItemId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.moodBoardItem.findMany({
      where: { inspirationItemId: { in: ids } },
      select: { inspirationItemId: true, userId: true },
      distinct: ['inspirationItemId', 'userId'],
    }),
  ])

  const likeCount = new Map(likeGroups.map((g) => [g.inspirationItemId, g._count._all]))
  const saveCount = new Map<string, number>()
  for (const row of saveRows) {
    saveCount.set(row.inspirationItemId, (saveCount.get(row.inspirationItemId) ?? 0) + 1)
  }

  return items.map((item) => ({
    ...item,
    likeCount: likeCount.get(item.id) ?? 0,
    saveCount: saveCount.get(item.id) ?? 0,
  }))
}
