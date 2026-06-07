import type { Role } from '@/lib/supabase/types'

// Etiketter for rollene som vises i UI
export const ROLE_LABELS: Record<Role, string> = {
  collector: 'Samler',
  driver: 'Sjåfør',
  strapper: 'Stripser',
  host: 'Vert',
  admin: 'Admin',
}
