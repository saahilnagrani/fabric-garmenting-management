import { NextResponse } from 'next/server';
import { getDraftOutreach } from '@/lib/sourcing-db/queries';

export async function GET() {
  try {
    const drafts = await getDraftOutreach();
    return NextResponse.json(drafts);
  } catch (error) {
    console.error('Failed to fetch drafts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500 }
    );
  }
}
