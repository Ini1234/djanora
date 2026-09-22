/** Prisma `where` for a Clerk user that has not been soft-deleted. */
export function liveUserWhere(clerkId: string) {
  return { clerkId, deletedAt: null }
}
