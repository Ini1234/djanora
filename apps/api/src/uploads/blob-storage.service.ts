import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential } from '@azure/storage-blob'
import { randomBytes } from 'crypto'
import { createReadStream, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { extname, join } from 'path'
import { Readable } from 'stream'

export type BlobKind = 'images' | 'receipts'

const KIND_ENV: Record<BlobKind, string> = {
  images: 'AZURE_STORAGE_CONTAINER_IMAGES',
  receipts: 'AZURE_STORAGE_CONTAINER_RECEIPTS',
}

const PLACEHOLDER = /^(your[_-]|changeme)/i

@Injectable()
export class BlobStorageService {
  private readonly logger = new Logger(BlobStorageService.name)
  private readonly containers = new Map<BlobKind, ContainerClient>()
  private readonly dedicated = new Set<BlobKind>()
  private readonly ready = new Map<string, Promise<void>>()
  private readonly uploadsDir = join(process.cwd(), 'uploads')

  constructor(config: ConfigService) {
    const account = config.get<string>('AZURE_STORAGE_ACCOUNT_NAME')?.trim()
    const key = config.get<string>('AZURE_STORAGE_ACCOUNT_KEY')?.trim()
    const fallback = unsetIfPlaceholder(config.get<string>('AZURE_STORAGE_CONTAINER_NAME'))

    if (!account || !key || PLACEHOLDER.test(account) || PLACEHOLDER.test(key)) {
      this.logger.warn('Azure Blob Storage not configured; uploads use local disk')
      return
    }

    const credential = new StorageSharedKeyCredential(account, key)
    const service = new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential)

    for (const kind of Object.keys(KIND_ENV) as BlobKind[]) {
      const dedicated = unsetIfPlaceholder(config.get<string>(KIND_ENV[kind]))
      const name = dedicated ?? fallback
      if (!name) continue
      this.containers.set(kind, service.getContainerClient(name))
      if (dedicated) this.dedicated.add(kind)
      this.logger.log(`Uploads [${kind}] → ${account}/${name}`)
    }

    if (this.containers.size === 0) {
      this.logger.warn('Azure Blob Storage has no containers; uploads use local disk')
    }
  }

  get configured() {
    return this.containers.size > 0
  }

  blobName(kind: BlobKind, filename: string) {
    return this.dedicated.has(kind) ? filename : `${kind}/${filename}`
  }

  async upload(kind: BlobKind, filename: string, buffer: Buffer, contentType: string) {
    if (!isSafeName(filename)) {
      throw new Error('Invalid upload filename')
    }

    const container = this.containers.get(kind)
    if (container) {
      await this.ensureContainer(container)
      const blob = container.getBlockBlobClient(this.blobName(kind, filename))
      await blob.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: contentType },
      })
      return
    }

    const dir = this.diskDir(kind)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, filename), buffer)
  }

  async download(kind: BlobKind, filename: string): Promise<Readable | null> {
    if (!isSafeName(filename)) return null

    const container = this.containers.get(kind)
    if (container) {
      const blob = container.getBlockBlobClient(this.blobName(kind, filename))
      if (!(await blob.exists())) return this.downloadFromDisk(kind, filename)
      const res = await blob.download()
      return (res.readableStreamBody as Readable | undefined) ?? null
    }

    return this.downloadFromDisk(kind, filename)
  }

  async delete(kind: BlobKind, filename: string) {
    if (!isSafeName(filename)) return

    const container = this.containers.get(kind)
    if (container) {
      const name = this.blobName(kind, filename)
      try {
        await container.getBlockBlobClient(name).deleteIfExists()
      } catch (err) {
        this.logger.warn(`Failed to delete blob ${name}: ${String(err)}`)
      }
    }

    const diskPath = join(this.diskDir(kind), filename)
    if (existsSync(diskPath)) {
      try {
        unlinkSync(diskPath)
      } catch (err) {
        this.logger.warn(`Failed to delete disk file ${diskPath}: ${String(err)}`)
      }
    }
  }

  private downloadFromDisk(kind: BlobKind, filename: string): Readable | null {
    const diskPath = join(this.diskDir(kind), filename)
    if (!existsSync(diskPath)) return null
    return createReadStream(diskPath)
  }

  private diskDir(kind: BlobKind) {
    return kind === 'receipts' ? join(this.uploadsDir, 'private') : this.uploadsDir
  }

  private async ensureContainer(container: ContainerClient) {
    const name = container.containerName
    let pending = this.ready.get(name)
    if (!pending) {
      pending = container.createIfNotExists().then(() => undefined)
      this.ready.set(name, pending)
    }
    await pending
  }
}

function unsetIfPlaceholder(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed || PLACEHOLDER.test(trimmed)) return undefined
  return trimmed
}

export function isSafeName(filename: string) {
  return (
    Boolean(filename) &&
    !filename.includes('..') &&
    !filename.includes('/') &&
    !filename.includes('\\')
  )
}

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'])

export function makeUploadName(originalName: string, prefix = '') {
  const ext = extname(originalName).toLowerCase()
  const safeExt = ALLOWED_EXT.has(ext) ? ext : ''
  return `${prefix}${randomBytes(16).toString('hex')}${safeExt}`
}
