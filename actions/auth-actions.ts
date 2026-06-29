'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

function siteUrl(reqOrigin?: string) {
  return process.env.NEXT_PUBLIC_SITE_URL || reqOrigin || 'http://localhost:3000'
}

export async function signInWithGoogle(next: string = '/') {
  const supabase = await createClient()
  const origin = (await headers()).get('origin') ?? undefined
  const redirectTo = `${siteUrl(origin)}/auth/callback?next=${encodeURIComponent(next)}`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })

  if (error || !data.url) {
    redirect('/?auth_error=1')
  }
  redirect(data.url)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
