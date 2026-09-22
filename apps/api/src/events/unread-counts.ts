export type UnreadRow = { key: string; count: number }

export function emptyUnreadCounts(keys: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const key of keys) counts[key] = 0
  return counts
}

export function applyUnreadRows(
  counts: Record<string, number>,
  rows: UnreadRow[],
): Record<string, number> {
  const next = { ...counts }
  for (const row of rows) {
    if (row.key in next) next[row.key] = Number(row.count) || 0
  }
  return next
}
