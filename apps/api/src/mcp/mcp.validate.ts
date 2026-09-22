import 'reflect-metadata'
import { plainToInstance, type ClassConstructor } from 'class-transformer'
import { validate } from 'class-validator'
import { mcpError } from './mcp.errors'

export async function parseToolDto<T extends object>(
  cls: ClassConstructor<T>,
  raw: Record<string, unknown>,
): Promise<T> {
  const compact = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined))
  const instance = plainToInstance(cls, compact)
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  })
  if (errors.length > 0) {
    const message = errors.flatMap((error) => Object.values(error.constraints ?? {})).join('; ')
    mcpError('invalid', message || 'Invalid arguments')
  }
  return instance
}
