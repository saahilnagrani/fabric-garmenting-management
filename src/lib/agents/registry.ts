export interface AgentRegistryEntry {
  id: string
  name: string
  description: string
  systemPromptPath: string
  model: string
}

const agents: AgentRegistryEntry[] = [
  {
    id: 'discovery-agent',
    name: 'Discovery Agent',
    description:
      'Searches and identifies potential suppliers based on material requirements, certifications, and geographic preferences.',
    systemPromptPath: 'prompts/discovery-agent/system.txt',
    model: 'claude-sonnet-4-20250514',
  },
  {
    id: 'email-agent',
    name: 'Email Agent',
    description:
      'Generates personalized outreach emails to suppliers in English and Chinese, adapting tone and content to the supplier profile.',
    systemPromptPath: 'prompts/email-agent/system.txt',
    model: 'claude-sonnet-4-20250514',
  },
  {
    id: 'scoring-agent',
    name: 'Scoring Agent',
    description:
      'Evaluates and scores suppliers based on fit, capability, certifications, and other criteria relevant to the company profile.',
    systemPromptPath: 'prompts/scoring-agent/system.txt',
    model: 'claude-sonnet-4-20250514',
  },
  {
    id: 'reply-agent',
    name: 'Reply Agent',
    description:
      'Analyzes supplier replies and drafts appropriate follow-up responses, tracking conversation context and negotiation progress.',
    systemPromptPath: 'prompts/reply-agent/system.txt',
    model: 'claude-sonnet-4-20250514',
  },
]

const agentMap = new Map(agents.map((a) => [a.id, a]))

/**
 * Get a single agent config by ID.
 */
export function getAgent(id: string): AgentRegistryEntry | undefined {
  return agentMap.get(id)
}

/**
 * Get all registered agent configs.
 */
export function getAllAgents(): AgentRegistryEntry[] {
  return [...agents]
}
