import { NextResponse } from 'next/server';
import {
  getSupplierById,
  updateSupplier,
  deleteSupplier,
} from '@/lib/sourcing-db/queries';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supplier = await getSupplierById(id);
    return NextResponse.json(supplier);
  } catch (error) {
    console.error('Failed to fetch supplier:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier' },
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
    const supplier = await updateSupplier(id, body);
    return NextResponse.json(supplier);
  } catch (error) {
    console.error('Failed to update supplier:', error);
    return NextResponse.json(
      { error: 'Failed to update supplier' },
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
    await deleteSupplier(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete supplier:', error);
    return NextResponse.json(
      { error: 'Failed to delete supplier' },
      { status: 500 }
    );
  }
}
