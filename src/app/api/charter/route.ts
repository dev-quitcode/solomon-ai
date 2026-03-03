import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('project_charter')
    .select('*')
    .eq('project_id', projectId)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json(data ?? null)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { project_id, ...fields } = body
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  // Get current version
  const { data: existing } = await supabase
    .from('project_charter')
    .select('id, version')
    .eq('project_id', project_id)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const version = existing ? existing.version + 1 : 1

  const { data, error } = await supabase
    .from('project_charter')
    .insert({ project_id, version, status: 'draft', ...fields })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Advance project status to 'charter'
  await supabase
    .from('projects')
    .update({ status: 'charter' })
    .eq('id', project_id)
    .eq('user_id', user.id)
    .in('status', ['setup', 'sources'])

  return NextResponse.json(data, { status: 201 })
}
