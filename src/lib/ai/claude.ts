import Anthropic from '@anthropic-ai/sdk'

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'

let client: Anthropic | null = null
let cachedKey: string | undefined = undefined

function getClient(): Anthropic {
  const currentKey = process.env.SOURCING_AGENT_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY
  if (!client || cachedKey !== currentKey) {
    client = new Anthropic({
      apiKey: currentKey,
    })
    cachedKey = currentKey
  }
  return client
}

/**
 * Generate a text completion from Claude.
 */
export async function generateCompletion(
  systemPrompt: string,
  userMessage: string,
  model: string = DEFAULT_MODEL,
): Promise<string> {
  const anthropic = getClient()

  // Use AbortController for timeout (3 minutes)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)

  try {
    const response = await anthropic.messages.create(
      {
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal: controller.signal },
    )

    const textBlock = response.content.find((block) => block.type === 'text')
    return textBlock ? textBlock.text : ''
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Generate a streaming completion with web search enabled.
 * Claude will search the web for real supplier data before responding.
 */
export function generateStreamingWithWebSearch(
  systemPrompt: string,
  userMessage: string,
  model: string = DEFAULT_MODEL,
): ReadableStream {
  const anthropic = getClient()
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model,
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
        })

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const data = JSON.stringify({ text: event.delta.text })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error'
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: message })}\n\n`,
          ),
        )
        controller.close()
      }
    },
  })
}

/**
 * Generate a streaming completion from Claude (no tools).
 */
export function generateStreamingCompletion(
  systemPrompt: string,
  userMessage: string,
  model: string = DEFAULT_MODEL,
): ReadableStream {
  const anthropic = getClient()
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const data = JSON.stringify({ text: event.delta.text })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error'
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: message })}\n\n`,
          ),
        )
        controller.close()
      }
    },
  })
}

/**
 * Generate a completion and parse the response as JSON.
 */
export async function generateJSON<T>(
  systemPrompt: string,
  userMessage: string,
  model: string = DEFAULT_MODEL,
): Promise<T> {
  const text = await generateCompletion(systemPrompt, userMessage, model)

  // Try to extract JSON from the response (handle cases where Claude wraps in markdown)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonString = jsonMatch ? jsonMatch[1].trim() : text.trim()

  return JSON.parse(jsonString) as T
}
