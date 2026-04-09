import {
  getSupplierById,
  getFirstCompanyProfile,
  getOutreachBySupplierAsc,
} from '@/lib/sourcing-db/queries'
import { loadSystemPrompt } from '@/lib/agents/prompts'
import { getAgent } from '@/lib/agents/registry'
import type { CompanyProfile, Supplier, Outreach } from '@/types/sourcing'
import Anthropic from '@anthropic-ai/sdk'

function buildEmailContext(
  supplier: Supplier,
  profile: CompanyProfile,
  emailType: string,
  tone: string,
  bilingual: boolean,
  previousOutreach: Outreach[],
): string {
  const lines: string[] = []

  // Company profile - concise
  lines.push('COMPANY PROFILE')
  lines.push(`Company: ${profile.company_name}`)
  if (profile.tagline) lines.push(`Tagline: ${profile.tagline}`)
  if (profile.description) lines.push(`Description: ${profile.description}`)
  if (profile.location) lines.push(`Location: ${profile.location}`)
  if (profile.website) lines.push(`Website: ${profile.website}`)
  if (profile.product_categories.length) lines.push(`Products: ${profile.product_categories.join(', ')}`)
  if (profile.annual_volume_estimate) lines.push(`Annual Volume: ${profile.annual_volume_estimate}`)
  if (profile.target_markets.length) lines.push(`Target Markets: ${profile.target_markets.join(', ')}`)
  if (profile.certifications_needed.length) lines.push(`Required Certifications: ${profile.certifications_needed.join(', ')}`)
  if (profile.key_selling_points.length) lines.push(`Key Selling Points: ${profile.key_selling_points.join('; ')}`)

  lines.push('')
  lines.push('SUPPLIER INFORMATION')
  lines.push(`Company: ${supplier.company_name}`)
  if (supplier.company_name_cn) lines.push(`Chinese Name: ${supplier.company_name_cn}`)
  lines.push(`Location: ${supplier.location_city}, ${supplier.location_province}`)
  lines.push(`Platform: ${supplier.source_platform}`)
  if (supplier.source_url) lines.push(`URL: ${supplier.source_url}`)
  if (supplier.primary_materials.length) lines.push(`Materials: ${supplier.primary_materials.join(', ')}`)
  if (supplier.certifications.length) lines.push(`Certifications: ${supplier.certifications.join(', ')}`)
  if (supplier.moq_range) lines.push(`MOQ: ${supplier.moq_range}`)
  if (supplier.contact_person) lines.push(`Contact: ${supplier.contact_person}`)
  if (supplier.contact_email) lines.push(`Email: ${supplier.contact_email}`)
  if (supplier.ai_summary) lines.push(`AI Summary: ${supplier.ai_summary}`)

  lines.push('')
  lines.push('EMAIL PARAMETERS')
  lines.push(`Type: ${emailType}`)
  lines.push(`Tone: ${tone}`)
  lines.push(`Bilingual: ${bilingual ? 'Yes - include English and Chinese' : 'No - English only'}`)

  if (previousOutreach.length > 0) {
    lines.push('')
    lines.push('PREVIOUS OUTREACH HISTORY')
    for (const o of previousOutreach.slice(-3)) {
      lines.push(`- ${o.email_type}: "${o.subject}" (${o.status})`)
    }
  }

  lines.push('')
  lines.push(`INSTRUCTION`)
  lines.push(`Generate a ${emailType} email to this supplier using the ${tone} tone.`)
  lines.push(`The email MUST be from "${profile.company_name}" - use this exact company name.`)
  if (bilingual) lines.push('Include a Chinese translation.')
  lines.push('Return the result in the JSON format specified in your system prompt.')

  return lines.join('\n')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { supplierId, emailType, tone, bilingual } = body as {
      supplierId: string
      emailType: string
      tone: string
      bilingual: boolean
    }

    if (!supplierId || !emailType || !tone) {
      return Response.json(
        { error: 'supplierId, emailType, and tone are required' },
        { status: 400 },
      )
    }

    const supplier = await getSupplierById(supplierId)
    if (!supplier) {
      return Response.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const profile = await getFirstCompanyProfile()
    if (!profile) {
      return Response.json(
        { error: 'No company profile found. Please set up your company profile first.' },
        { status: 404 },
      )
    }

    const previousOutreach = await getOutreachBySupplierAsc(supplierId)

    const userMessage = buildEmailContext(
      supplier as unknown as Supplier,
      profile as unknown as CompanyProfile,
      emailType,
      tone,
      bilingual ?? false,
      (previousOutreach ?? []) as unknown as Outreach[],
    )

    console.log('[email-agent] Company name from profile:', (profile as unknown as CompanyProfile).company_name)

    const agent = getAgent('email-agent')
    const systemPrompt = loadSystemPrompt('email-agent')

    // Stream the response for faster time-to-first-byte
    const apiKey = process.env.SOURCING_AGENT_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY
    const client = new Anthropic({ apiKey })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = client.messages.stream({
            model: agent?.model || 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
          })

          let fullText = ''

          for await (const event of response) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              fullText += event.delta.text
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              )
            }
          }

          // Send the final parsed JSON
          let result
          const mdMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/)
          const jsonString = mdMatch ? mdMatch[1].trim() : fullText.trim()
          try {
            result = JSON.parse(jsonString)
          } catch {
            const arrayMatch = fullText.match(/\{[\s\S]*\}/)
            if (arrayMatch) {
              result = JSON.parse(arrayMatch[0])
            } else {
              throw new Error('Could not parse email JSON from AI response')
            }
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, email: result })}\n\n`)
          )
          controller.close()
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
