import fs from 'fs'
import path from 'path'

/**
 * Resolve the base prompts directory.
 * The prompts directory is at the project root's parent: ../prompts
 */
function getPromptsDir(): string {
  return path.join(process.cwd(), 'prompts')
}

/**
 * Load the system prompt for a given agent.
 * Reads from prompts/<agentId>/system.txt
 */
export function loadSystemPrompt(agentId: string): string {
  const filePath = path.join(getPromptsDir(), agentId, 'system.txt')
  return fs.readFileSync(filePath, 'utf-8')
}

/**
 * Load the context template for a given agent.
 * Reads from prompts/<agentId>/context-template.txt
 */
export function loadContextTemplate(agentId: string): string {
  const filePath = path.join(getPromptsDir(), agentId, 'context-template.txt')
  return fs.readFileSync(filePath, 'utf-8')
}

/**
 * Load an email template by name.
 * Reads from prompts/email-agent/templates/<templateName>.txt
 */
export function loadEmailTemplate(templateName: string): string {
  const filePath = path.join(
    getPromptsDir(),
    'email-agent',
    'templates',
    `${templateName}.txt`,
  )
  return fs.readFileSync(filePath, 'utf-8')
}
