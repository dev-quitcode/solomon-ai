import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import type { UserRole } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const role: UserRole = profile?.role ?? 'user'

  // Auto-accept any pending project invitations for this user's email
  if (user.email) {
    try {
      const adminClient = await createAdminClient()
      const { data: pending } = await adminClient
        .from('project_invitations')
        .select('id, project_id, role')
        .eq('email', user.email)
        .eq('status', 'pending')

      if (pending && pending.length > 0) {
        for (const invite of pending) {
          await adminClient.from('project_members').upsert(
            { project_id: invite.project_id, user_id: user.id, role: invite.role },
            { onConflict: 'project_id,user_id' }
          )
          await adminClient
            .from('project_invitations')
            .update({ status: 'accepted' })
            .eq('id', invite.id)
        }
      }
    } catch {
      // Non-critical — don't break the layout if this fails
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={role} />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  )
}
