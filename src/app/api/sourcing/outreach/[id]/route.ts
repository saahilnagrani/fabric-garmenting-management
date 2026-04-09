import { NextResponse } from 'next/server';
import { updateOutreach, deleteOutreach } from '@/lib/sourcing-db/queries';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = await updateOutreach(id, body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update outreach:', error);
    return NextResponse.json(
      { error: 'Failed to update outreach' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteOutreach(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete outreach:', error);
    return NextResponse.json(
      { error: 'Failed to delete outreach' },
      { status: 500 }
    );
  }
}
