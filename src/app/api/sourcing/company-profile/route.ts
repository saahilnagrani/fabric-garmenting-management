import { NextResponse } from 'next/server';
import { getCompanyProfile, upsertCompanyProfile } from '@/lib/sourcing-db/queries';

export async function GET() {
  try {
    const profile = await getCompanyProfile();
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Failed to fetch company profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const profile = await upsertCompanyProfile(body);
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Failed to update company profile:', error);
    return NextResponse.json(
      { error: 'Failed to update company profile' },
      { status: 500 }
    );
  }
}
