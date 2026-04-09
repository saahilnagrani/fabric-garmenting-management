import { NextResponse } from 'next/server';
import { getMaterials, createMaterial } from '@/lib/sourcing-db/queries';
import type { MaterialCategory } from '@/types/sourcing';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as MaterialCategory | null;

    const materials = await getMaterials({
      category: category ?? undefined,
    });

    return NextResponse.json(materials);
  } catch (error) {
    console.error('Failed to fetch materials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch materials' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const material = await createMaterial(body);
    return NextResponse.json(material, { status: 201 });
  } catch (error) {
    console.error('Failed to create material:', error);
    return NextResponse.json(
      { error: 'Failed to create material' },
      { status: 500 }
    );
  }
}
