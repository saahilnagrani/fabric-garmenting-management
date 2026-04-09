import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    has_anthropic_key: !!process.env.ANTHROPIC_API_KEY,
    key_prefix: process.env.ANTHROPIC_API_KEY?.slice(0, 10) || 'MISSING',
    has_db_url: !!process.env.DATABASE_URL,
  })
}
