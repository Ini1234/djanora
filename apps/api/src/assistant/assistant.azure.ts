import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: AzureToolCall[]
  tool_call_id?: string
}

export type AzureToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type AzureChatResult = {
  message: ChatMessage
  usage: { prompt_tokens: number; completion_tokens: number }
  model: string
}

type ChatBody = Record<string, unknown>

/** Cheap default — gpt-5.4-mini is not required. */
export const DEFAULT_CHAT_DEPLOYMENT = 'gpt-4.1-mini'
export const DEFAULT_CHAT_API_VERSION = '2024-10-21'

export function trimEndpoint(endpoint: string) {
  let end = endpoint.length
  while (end > 0 && endpoint[end - 1] === '/') end -= 1
  return endpoint.slice(0, end)
}

export function usesCompletionTokens(deployment: string) {
  const name = deployment.toLowerCase()
  return name.includes('gpt-5') || /(^|[^a-z])o[1-9]/.test(name)
}

export function chatRequestBodies(
  deployment: string,
  messages: ChatMessage[],
  tools: unknown[],
  maxTokens: number,
): ChatBody[] {
  const shared: ChatBody = {
    messages,
    tools: tools.length ? tools : undefined,
    tool_choice: tools.length ? 'auto' : undefined,
  }
  if (usesCompletionTokens(deployment)) {
    return [{ ...shared, max_completion_tokens: maxTokens }]
  }
  return [
    { ...shared, temperature: 0.3, max_tokens: maxTokens },
    { ...shared, max_completion_tokens: maxTokens },
  ]
}

@Injectable()
export class AssistantAzureService {
  private readonly logger = new Logger(AssistantAzureService.name)
  private readonly endpoint: string | undefined
  private readonly apiKey: string | undefined
  private readonly deployment: string
  private readonly apiVersion: string

  constructor(private readonly config: ConfigService) {
    const raw = config.get<string>('AZURE_OPENAI_ENDPOINT')
    this.endpoint = raw ? trimEndpoint(raw) : undefined
    this.apiKey = config.get<string>('AZURE_OPENAI_API_KEY')
    this.deployment =
      config.get<string>('AZURE_OPENAI_CHAT_DEPLOYMENT')?.trim() || DEFAULT_CHAT_DEPLOYMENT
    this.apiVersion =
      config.get<string>('AZURE_OPENAI_API_VERSION')?.trim() || DEFAULT_CHAT_API_VERSION
  }

  get isConfigured(): boolean {
    return !!(
      this.endpoint &&
      !this.endpoint.includes('your-resource') &&
      this.apiKey &&
      !this.apiKey.includes('your_api_key')
    )
  }

  async chat(
    messages: ChatMessage[],
    tools: unknown[],
    maxTokens = 1200,
  ): Promise<AzureChatResult> {
    if (!this.isConfigured || !this.endpoint) {
      throw new ServiceUnavailableException('Djan is not configured')
    }

    const bodies = chatRequestBodies(this.deployment, messages, tools, maxTokens)
    const urls = [
      `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`,
      `${this.endpoint}/openai/v1/chat/completions`,
    ]

    let last = ''
    for (const url of urls) {
      for (const body of bodies) {
        const payload = url.includes('/openai/v1/') ? { ...body, model: this.deployment } : body
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.apiKey!,
          },
          body: JSON.stringify(payload),
        })
        if (res.ok) return this.readResult(res)
        last = await res.text()
        if (res.status === 404) break
        if (res.status !== 400) {
          this.logger.warn(`Azure chat ${res.status}: ${last.slice(0, 400)}`)
          throw new ServiceUnavailableException('Djan is temporarily unavailable')
        }
      }
    }

    this.logger.warn(
      `Azure chat failed for deployment "${this.deployment}" (api-version ${this.apiVersion}): ${last.slice(0, 400)}`,
    )
    if (/404|Resource not found/i.test(last)) {
      throw new ServiceUnavailableException(
        `No Azure chat deployment named "${this.deployment}". Create gpt-4.1-mini (or gpt-5-nano) and set AZURE_OPENAI_CHAT_DEPLOYMENT to that name.`,
      )
    }
    throw new ServiceUnavailableException('Djan is temporarily unavailable')
  }

  private async readResult(res: Response): Promise<AzureChatResult> {
    const data = (await res.json()) as {
      model?: string
      usage?: { prompt_tokens?: number; completion_tokens?: number }
      choices?: Array<{ message?: ChatMessage }>
    }
    const message = data.choices?.[0]?.message
    if (!message) throw new ServiceUnavailableException('Djan returned an empty reply')

    return {
      message,
      model: data.model ?? this.deployment,
      usage: {
        prompt_tokens: data.usage?.prompt_tokens ?? 0,
        completion_tokens: data.usage?.completion_tokens ?? 0,
      },
    }
  }
}
