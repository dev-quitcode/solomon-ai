import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UserManagementClient from './UserManagementClient'

export default async function UserManagementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/profile')

  return <UserManagementClient />
}
