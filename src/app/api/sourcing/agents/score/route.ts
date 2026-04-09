import {
  getSupplierById,
  getAllMaterials,
  getFirstCompanyProfile,
  updateSupplier,
} from '@/lib/sourcing-db/queries'
import { generateJSON } from '@/lib/ai/claude'
import { loadSystemPrompt } from '@/lib/agents/prompts'
import { assembleScoringContext } from '@/lib/agents/context'
import { getAgent } from '@/lib/agents/registry'
import type { Material, CompanyProfile, Supplier } from '@/types/sourcing'

interface ScoringResult {
  priority_score: number
  reasoning: string
  strengths: string[]
  weaknesses: string[]
  recommendation: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { supplierId } = body as { supplierId: string }

    if (!supplierId) {
      return Response.json(
        { error: 'supplierId is required' },
        { status: 400 },
      )
    }

    // Load supplier
    const supplier = await getSupplierById(supplierId)

    if (!supplier) {
      return Response.json(
        { error: 'Supplier not found' },
        { status: 404 },
      )
    }

    // Load all materials
    const materialRows = await getAllMaterials()

    // Load company profile
    const profile = await getFirstCompanyProfile()

    if (!profile) {
      return Response.json(
        { error: 'No company profile found. Please set up your company profile first.' },
        { status: 404 },
      )
    }

    // Assemble context and load system prompt
    const userMessage = assembleScoringContext(
      supplier as unknown as Supplier,
      (materialRows ?? []) as unknown as Material[],
      profile as unknown as CompanyProfile,
    )

    const agent = getAgent('scoring-agent')
    const systemPrompt = loadSystemPrompt('scoring-agent')

    const scoringResult = await generateJSON<ScoringResult>(
      systemPrompt,
      userMessage,
      agent?.model,
    )

    // Update supplier priority_score in the database
    try {
      await updateSupplier(supplierId, {
        priority_score: scoringResult.priority_score,
        ai_summary: scoringResult.reasoning,
      })
    } catch (updateError) {
      const msg = updateError instanceof Error ? updateError.message : 'unknown'
      return Response.json(
        { error: `Failed to update supplier score: ${msg}` },
        { status: 500 },
      )
    }

    return Response.json(scoringResult)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
