import { serverFetch } from '@/lib/api.server'
import type { AdminUserRow } from '@/lib/admin.types'
import { AdminUsersClient } from './admin-users-client'

export default async function AdminUsersPage() {
  const users = (await serverFetch<AdminUserRow[]>('/admin/users')) ?? []
  return <AdminUsersClient users={users} />
}
