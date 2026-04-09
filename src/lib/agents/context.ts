import type {
  Material,
  CompanyProfile,
  Supplier,
  Outreach,
} from '@/types/sourcing'
import { loadContextTemplate } from '@/lib/agents/prompts'

/**
 * Replace template variables in a template string.
 * Variables use the format {{VARIABLE_NAME}}.
 */
function replaceVariables(
  template: string,
  variables: Record<string, string>,
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value)
  }
  return result
}

/**
 * Format a list of materials into a readable specification string.
 */
function formatMaterials(materials: Material[]): string {
  return materials
    .map((m) => {
      const specs = m.specifications
      const specLines = Object.entries(specs)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `  - ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\n')

      return [
        `- ${m.name} (${m.category}, priority: ${m.priority})`,
        specLines,
        m.target_price_range
          ? `  - target price range: ${m.target_price_range}`
          : '',
        m.notes ? `  - notes: ${m.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')
}

/**
 * Format a company profile into a readable string.
 */
function formatCompanyProfile(profile: CompanyProfile): string {
  const lines = [
    `Company: ${profile.company_name}`,
    profile.tagline ? `Tagline: ${profile.tagline}` : '',
    profile.description ? `Description: ${profile.description}` : '',
    profile.location ? `Location: ${profile.location}` : '',
    profile.website ? `Website: ${profile.website}` : '',
    profile.product_categories.length
      ? `Product Categories: ${profile.product_categories.join(', ')}`
      : '',
    profile.annual_volume_estimate
      ? `Annual Volume: ${profile.annual_volume_estimate}`
      : '',
    profile.target_markets.length
      ? `Target Markets: ${profile.target_markets.join(', ')}`
      : '',
    profile.certifications_needed.length
      ? `Required Certifications: ${profile.certifications_needed.join(', ')}`
      : '',
    profile.key_selling_points.length
      ? `Key Selling Points: ${profile.key_selling_points.join(', ')}`
      : '',
  ]

  return lines.filter(Boolean).join('\n')
}

/**
 * Format a supplier into a readable string.
 */
function formatSupplier(supplier: Supplier): string {
  const lines = [
    `Company: ${supplier.company_name}`,
    supplier.company_name_cn
      ? `Chinese Name: ${supplier.company_name_cn}`
      : '',
    `Platform: ${supplier.source_platform}`,
    supplier.source_url ? `URL: ${supplier.source_url}` : '',
    `Location: ${supplier.location_city}, ${supplier.location_province}`,
    `Primary Materials: ${supplier.primary_materials.join(', ')}`,
    supplier.certifications.length
      ? `Certifications: ${supplier.certifications.join(', ')}`
      : '',
    supplier.moq_range ? `MOQ Range: ${supplier.moq_range}` : '',
    supplier.estimated_annual_revenue
      ? `Est. Revenue: ${supplier.estimated_annual_revenue}`
      : '',
    supplier.employee_count
      ? `Employees: ${supplier.employee_count}`
      : '',
    supplier.year_established
      ? `Established: ${supplier.year_established}`
      : '',
    supplier.exports_to_india != null
      ? `Exports to India: ${supplier.exports_to_india ? 'Yes' : 'No'}`
      : '',
    supplier.contact_person
      ? `Contact: ${supplier.contact_person}`
      : '',
    supplier.contact_email ? `Email: ${supplier.contact_email}` : '',
    supplier.pipeline_status
      ? `Pipeline Status: ${supplier.pipeline_status}`
      : '',
    supplier.priority_score != null
      ? `Priority Score: ${supplier.priority_score}/10`
      : '',
    supplier.notes ? `Notes: ${supplier.notes}` : '',
    supplier.ai_summary ? `AI Summary: ${supplier.ai_summary}` : '',
  ]

  return lines.filter(Boolean).join('\n')
}

/**
 * Format previous outreach history into a readable string.
 */
function formatOutreachHistory(outreach: Outreach[]): string {
  if (outreach.length === 0) return 'No previous outreach.'

  return outreach
    .map(
      (o) =>
        `[${o.email_type}] (${o.status}, ${o.language}) - Subject: ${o.subject}\n` +
        `Sent: ${o.sent_at ?? 'not sent'} | Replied: ${o.replied_at ?? 'no reply'}` +
        (o.reply_summary ? `\nReply summary: ${o.reply_summary}` : ''),
    )
    .join('\n\n')
}

/**
 * Assemble the user message context for the discovery agent.
 */
export function assembleDiscoveryContext(
  materials: Material[],
  companyProfile: CompanyProfile,
): string {
  try {
    const template = loadContextTemplate('discovery-agent')
    return replaceVariables(template, {
      MATERIALS: formatMaterials(materials),
      COMPANY_PROFILE: formatCompanyProfile(companyProfile),
    })
  } catch {
    // Fallback if template file doesn't exist yet
    return [
      '## Company Profile',
      formatCompanyProfile(companyProfile),
      '',
      '## Materials to Source',
      formatMaterials(materials),
    ].join('\n')
  }
}

/**
 * Assemble the user message context for the email generation agent.
 */
export function assembleEmailContext(
  supplier: Supplier,
  materials: Material[],
  companyProfile: CompanyProfile,
  emailType: string,
  tone: string,
  bilingual: boolean,
  previousOutreach: Outreach[],
): string {
  try {
    const template = loadContextTemplate('email-agent')
    return replaceVariables(template, {
      SUPPLIER: formatSupplier(supplier),
      MATERIALS: formatMaterials(materials),
      COMPANY_PROFILE: formatCompanyProfile(companyProfile),
      EMAIL_TYPE: emailType,
      TONE: tone,
      BILINGUAL: bilingual ? 'Yes - include both English and Chinese' : 'No - English only',
      PREVIOUS_OUTREACH: formatOutreachHistory(previousOutreach),
    })
  } catch {
    return [
      '## Company Profile',
      formatCompanyProfile(companyProfile),
      '',
      '## Supplier',
      formatSupplier(supplier),
      '',
      '## Materials',
      formatMaterials(materials),
      '',
      '## Email Parameters',
      `Type: ${emailType}`,
      `Tone: ${tone}`,
      `Bilingual: ${bilingual ? 'Yes' : 'No'}`,
      '',
      '## Previous Outreach',
      formatOutreachHistory(previousOutreach),
    ].join('\n')
  }
}

/**
 * Assemble the user message context for the scoring agent.
 */
export function assembleScoringContext(
  supplier: Supplier,
  materials: Material[],
  companyProfile: CompanyProfile,
): string {
  try {
    const template = loadContextTemplate('scoring-agent')
    return replaceVariables(template, {
      SUPPLIER: formatSupplier(supplier),
      MATERIALS: formatMaterials(materials),
      COMPANY_PROFILE: formatCompanyProfile(companyProfile),
    })
  } catch {
    return [
      '## Company Profile',
      formatCompanyProfile(companyProfile),
      '',
      '## Supplier to Score',
      formatSupplier(supplier),
      '',
      '## Required Materials',
      formatMaterials(materials),
    ].join('\n')
  }
}
