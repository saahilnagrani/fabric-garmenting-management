import { NextResponse } from 'next/server';
import { createDiscoveryJob, getDiscoveryJob, getRecentDiscoveryJobs, getMaterialsByIds } from '@/lib/sourcing-db/queries';
import { runDiscoveryJob } from '@/lib/agents/discovery-runner';

// POST: Create a new discovery job
export async function POST(request: Request) {
  try {
    const { materialIds } = await request.json();

    if (!materialIds || !Array.isArray(materialIds) || materialIds.length === 0) {
      return NextResponse.json(
        { error: 'materialIds is required and must be a non-empty array' },
        { status: 400 },
      );
    }

    // Create the job in the database
    const job = await createDiscoveryJob(materialIds);

    // Fire and forget - run in background (not awaited)
    runDiscoveryJob(job.id, materialIds).catch((err) => {
      console.error('[discovery] Background job failed:', err);
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET: Get recent discovery jobs or a specific job by ID
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');

    if (jobId) {
      const job = await getDiscoveryJob(jobId);
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json(job);
    }

    const jobs = await getRecentDiscoveryJobs();

    // Enrich jobs with material names
    const allMaterialIds = [...new Set(jobs.flatMap((j) => (j.material_ids as string[]) ?? []))];
    const materialsList = allMaterialIds.length > 0 ? await getMaterialsByIds(allMaterialIds) : [];
    const materialNameMap: Record<string, string> = {};
    for (const m of materialsList) {
      materialNameMap[m.id] = m.name;
    }

    const enrichedJobs = jobs.map((j) => ({
      ...j,
      material_names: ((j.material_ids as string[]) ?? []).map(
        (id) => materialNameMap[id] ?? 'Unknown Material'
      ),
    }));

    return NextResponse.json(enrichedJobs);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
