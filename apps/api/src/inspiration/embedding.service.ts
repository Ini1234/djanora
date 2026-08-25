import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * Thin wrapper around Azure OpenAI embeddings endpoint.
 * Returns null when credentials are not configured — callers fall back to
 * Prisma-native text search in that case.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name)
  private readonly endpoint: string | undefined
  private readonly apiKey: string | undefined
  private readonly deployment: string | undefined

  constructor(private readonly config: ConfigService) {
    this.endpoint = config.get<string>('AZURE_OPENAI_ENDPOINT')
    this.apiKey = config.get<string>('AZURE_OPENAI_API_KEY')
    this.deployment =
      config.get<string>('AZURE_OPENAI_EMBEDDING_DEPLOYMENT') ?? 'text-embedding-3-small'
  }

  get isConfigured(): boolean {
    // Treat placeholder values as unconfigured
    return !!(
      this.endpoint &&
      !this.endpoint.includes('your-resource') &&
      this.apiKey &&
      !this.apiKey.includes('your_api_key')
    )
  }

  embedQuery(text: string) {
    return this.embed(`Query: ${text}`)
  }

  embedDocument(text: string) {
    return this.embed(`Document: ${text}`)
  }

  /** Embed text → Uint8Array (Float32 bytes), or null if unconfigured. */
  async embed(text: string): Promise<Uint8Array | null> {
    if (!this.isConfigured) return null

    try {
      const url = `${this.endpoint}/openai/deployments/${this.deployment}/embeddings?api-version=2024-02-01`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey!,
        },
        body: JSON.stringify({ input: text.slice(0, 8000) }),
      })

      if (!res.ok) {
        this.logger.warn(`Azure OpenAI returned ${res.status}: ${await res.text()}`)
        return null
      }

      const json = (await res.json()) as { data: { embedding: number[] }[] }
      // Use a plain ArrayBuffer so Prisma Bytes accepts it without complaints
      const floats = new Float32Array(json.data[0].embedding)
      const plain = new ArrayBuffer(floats.byteLength)
      new Uint8Array(plain).set(new Uint8Array(floats.buffer))
      return new Uint8Array(plain)
    } catch (err) {
      this.logger.warn(`Embedding failed: ${err}`)
      return null
    }
  }

  /**
   * Deserialize a DB Bytes field back to a float array.
   * Prisma returns a Buffer; we reinterpret its bytes as Float32.
   */
  static deserialize(buf: Uint8Array | Buffer): number[] {
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
    return Array.from(new Float32Array(ab))
  }

  /** Cosine similarity between two float arrays. */
  static cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0,
      magA = 0,
      magB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      magA += a[i] * a[i]
      magB += b[i] * b[i]
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB)
    return denom === 0 ? 0 : dot / denom
  }
}
