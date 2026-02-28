import { redirect } from 'next/navigation'

export default function Home() {
  // Root redirects to dashboard - middleware handles auth gating
  redirect('/dashboard')
}
