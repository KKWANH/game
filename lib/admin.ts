// Site-admin gate. Admins are listed in the ADMIN_EMAILS env var (comma-
// separated); the project owner is always included as a fallback so the admin
// page works even before the env var is set.
const OWNER_EMAIL = 'kwanho0096@gmail.com'

export function adminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return Array.from(new Set([OWNER_EMAIL, ...fromEnv]))
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmails().includes(email.toLowerCase())
}
