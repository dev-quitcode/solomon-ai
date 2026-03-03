import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Verify ownership via project
  const { data: charter } = await supabase
    .from('project_charter')
    .select('project_id')
    .eq('id', id)
    .single()

  if (!charter) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', charter.project_id)
    .eq('user_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('project_charter')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If approved, advance project to 'prd' stage
  if (body.status === 'approved') {
    await supabase
      .from('projects')
      .update({ status: 'prd' })
      .eq('id', charter.project_id)
      .eq('user_id', user.id)
      .eq('status', 'charter')
  }

  return NextResponse.json(data)
}
