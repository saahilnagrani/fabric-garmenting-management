import { NextResponse } from 'next/server';
import { getOutreachMessages, createOutreach } from '@/lib/sourcing-db/queries';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplier_id') ?? undefined;

    const messages = await getOutreachMessages({
      supplier_id: supplierId,
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Failed to fetch outreach messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch outreach messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const outreach = await createOutreach(body);
    return NextResponse.json(outreach, { status: 201 });
  } catch (error) {
    console.error('Failed to create outreach:', error);
    return NextResponse.json(
      { error: 'Failed to create outreach' },
      { status: 500 }
    );
  }
}
