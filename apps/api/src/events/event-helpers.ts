import { BadRequestException } from '@nestjs/common'

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function requiredLabel(value: unknown): string {
  const label = typeof value === 'string' ? value.trim() : ''
  if (!label) throw new BadRequestException('Budget item name is required')
  return label
}

export function foldKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}
