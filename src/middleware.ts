// AUDIT MODE: Middleware disabled for visual review
import { NextResponse } from 'next/server'

export function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
