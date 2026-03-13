'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'

  useEffect(() => {
    const supabase = createClient()
    // createBrowserClient automatically processes the hash fragment (#access_token=...)
    // and establishes the session. getSession() waits for that to complete.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace(next)
      } else {
        router.replace('/login')
      }
    })
  }, [router, next])

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground text-sm">
      Completing sign in…
    </div>
  )
}
