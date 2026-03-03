import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('epics')
    .select('*')
    .eq('project_id', projectId)
    .order('order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { project_id, title, description, acceptance_criteria, priority } = body

  // Generate code
  const { count } = await supabase
    .from('epics').select('*', { count: 'exact', head: true }).eq('project_id', project_id)
  const code = `E-${String((count ?? 0) + 1).padStart(3, '0')}`

  const { data, error } = await supabase
    .from('epics')
    .insert({ project_id, code, title, description, acceptance_criteria, priority: priority ?? 'should', order: count ?? 0, status: 'draft', version: 1 })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
