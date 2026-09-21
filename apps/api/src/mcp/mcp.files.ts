import { mcpError } from './mcp.errors'

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const RECEIPT_MIMES = new Set([...IMAGE_MIMES, 'image/gif', 'application/pdf'])
const IMAGE_MAX = 8 * 1024 * 1024
const RECEIPT_MAX = 10 * 1024 * 1024

export type DecodedFile = {
  buffer: Buffer
  mimetype: string
  originalname: string
  size: number
}

export function decodeUpload(args: {
  filename?: string
  mime?: string
  base64?: string
  kind: 'image' | 'receipt'
}): DecodedFile {
  const mime = args.mime?.trim().toLowerCase() ?? ''
  const allowed = args.kind === 'receipt' ? RECEIPT_MIMES : IMAGE_MIMES
  if (!allowed.has(mime)) {
    mcpError(
      'invalid',
      args.kind === 'receipt'
        ? 'Only images and PDFs are allowed'
        : 'Use a JPEG, PNG, or WebP photo',
    )
  }
  if (!args.base64?.trim()) mcpError('invalid', 'No file uploaded')
  const buffer = Buffer.from(args.base64.replace(/^data:[^;]+;base64,/, ''), 'base64')
  const max = args.kind === 'receipt' ? RECEIPT_MAX : IMAGE_MAX
  if (!buffer.length) mcpError('invalid', 'No file uploaded')
  if (buffer.length > max) mcpError('invalid', 'File is too large')
  const originalname =
    args.filename?.trim() || (mime === 'application/pdf' ? 'file.pdf' : 'photo.jpg')
  return { buffer, mimetype: mime, originalname, size: buffer.length }
}
