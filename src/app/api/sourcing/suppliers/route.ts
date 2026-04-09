import { NextResponse } from 'next/server';
import { getSuppliers, createSupplier } from '@/lib/sourcing-db/queries';
import type { PipelineStatus } from '@/types/sourcing';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as PipelineStatus | null;
    const search = searchParams.get('search') ?? undefined;

    const suppliers = await getSuppliers({
      pipeline_status: status ?? undefined,
      search,
    });

    return NextResponse.json(suppliers);
  } catch (error) {
    console.error('Failed to fetch suppliers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suppliers' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supplier = await createSupplier(body);
    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error('Failed to create supplier:', error);
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    );
  }
}
