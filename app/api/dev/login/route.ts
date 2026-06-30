import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

// DEV-ONLY: create/sign-in a test account without Google, for local QA.
// Hard-disabled in production so it can never be a backdoor on Vercel.
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'disabled in production' }, { status: 403 })
  }
  const url = new URL(request.url)
  const email = url.searchParams.get('email') || 'tester@test.local'
  const password = 'devpassword123!'
  const name = url.searchParams.get('name') || email.split('@')[0]

  const admin = createServiceClient()
  // Create the user if it doesn't exist yet (ignore "already registered").
  await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.redirect(new URL('/', request.url))
}
