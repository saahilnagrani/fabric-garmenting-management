import { getMaterialsByIds, getFirstCompanyProfile, updateDiscoveryJob } from '@/lib/sourcing-db/queries';
import { loadSystemPrompt } from '@/lib/agents/prompts';
import { assembleDiscoveryContext } from '@/lib/agents/context';
import { getAgent } from '@/lib/agents/registry';
import type { Material, CompanyProfile } from '@/types/sourcing';
import Anthropic from '@anthropic-ai/sdk';

export async function runDiscoveryJob(jobId: string, materialIds: string[]) {
  // Mark as running
  await updateDiscoveryJob(jobId, { status: 'running', started_at: new Date() });

  try {
    const materialRows = await getMaterialsByIds(materialIds);
    if (!materialRows || materialRows.length === 0) {
      throw new Error('No materials found');
    }

    const profile = await getFirstCompanyProfile();
    if (!profile) {
      throw new Error('No company profile configured');
    }

    const userMessage = assembleDiscoveryContext(
      materialRows as unknown as Material[],
      profile as unknown as CompanyProfile,
    );
    const systemPrompt = loadSystemPrompt('discovery-agent');
    const agent = getAgent('discovery-agent');

    // Use the Anthropic client directly (non-streaming, with web search)
    const apiKey = process.env.SOURCING_AGENT_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: agent?.model || 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 20,
        } as unknown as Anthropic.Messages.Tool,
      ],
    });

    // Extract text from the response
    let fullText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        fullText += block.text;
      }
    }

    // Parse JSON from Claude's response
    let results;
    const mdMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonString = mdMatch ? mdMatch[1].trim() : fullText.trim();

    try {
      results = JSON.parse(jsonString);
    } catch {
      // Try to find a JSON array in the text
      const arrayMatch = fullText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        results = JSON.parse(arrayMatch[0]);
      } else {
        throw new Error('Could not parse supplier data from AI response');
      }
    }

    if (!Array.isArray(results)) {
      results = [results];
    }

    // Auto-detect source_platform from source_url domain
    results = results.map((supplier: Record<string, unknown>) => {
      const url = (supplier.source_url as string) ?? '';
      let detected = supplier.source_platform as string | undefined;

      if (url) {
        const lower = url.toLowerCase();
        if (lower.includes('alibaba.com') || lower.includes('1688.com')) {
          detected = 'alibaba';
        } else if (lower.includes('made-in-china.com')) {
          detected = 'made_in_china';
        } else if (lower.includes('globalsources.com')) {
          detected = 'global_sources';
        }
        // Keep existing value if URL doesn't match known platforms
      }

      return { ...supplier, source_platform: detected ?? supplier.source_platform ?? 'direct' };
    });

    await updateDiscoveryJob(jobId, {
      status: 'completed',
      results,
      completed_at: new Date(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await updateDiscoveryJob(jobId, {
      status: 'failed',
      error: message,
      completed_at: new Date(),
    });
  }
}
