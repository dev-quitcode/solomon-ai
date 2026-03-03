import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json(data ?? { user_id: user.id, anthropic_api_key: null, voyage_api_key: null, model: 'claude-sonnet-4-6' })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { anthropic_api_key, voyage_api_key, model } = body

  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      anthropic_api_key: anthropic_api_key?.trim() || null,
      voyage_api_key: voyage_api_key?.trim() || null,
      model: model ?? 'claude-sonnet-4-6',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
