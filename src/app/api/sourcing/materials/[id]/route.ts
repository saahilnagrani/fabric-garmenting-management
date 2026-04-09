import { NextResponse } from 'next/server';
import {
  getMaterialById,
  updateMaterial,
  deleteMaterial,
} from '@/lib/sourcing-db/queries';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const material = await getMaterialById(id);
    return NextResponse.json(material);
  } catch (error) {
    console.error('Failed to fetch material:', error);
    return NextResponse.json(
      { error: 'Failed to fetch material' },
      { status: 404 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const material = await updateMaterial(id, body);
    return NextResponse.json(material);
  } catch (error) {
    console.error('Failed to update material:', error);
    return NextResponse.json(
      { error: 'Failed to update material' },
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
    await deleteMaterial(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete material:', error);
    return NextResponse.json(
      { error: 'Failed to delete material' },
      { status: 500 }
    );
  }
}
