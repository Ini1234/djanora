import 'reflect-metadata'
import { UpdateEventDto } from '../events/dto/update-event.dto'
import { AttachChildEventDto, ReorderChildrenDto } from '../events/dto/children.dto'
import { McpJobError } from './mcp.errors'
import { parseToolDto } from './mcp.validate'

describe('parseToolDto', () => {
  it('accepts a valid event patch', async () => {
    const dto = await parseToolDto(UpdateEventDto, { title: 'Ada & Tunde', guestCount: 120 })
    expect(dto.title).toBe('Ada & Tunde')
    expect(dto.guestCount).toBe(120)
  })

  it('rejects extra fields the HTTP DTO does not allow', async () => {
    await expect(
      parseToolDto(UpdateEventDto, { title: 'Ada', notes: 'secret', isCompleted: true }),
    ).rejects.toBeInstanceOf(McpJobError)
  })

  it('maps attach and reorder onto the HTTP DTOs', async () => {
    await expect(parseToolDto(AttachChildEventDto, { eventId: 'child_1' })).resolves.toEqual({
      eventId: 'child_1',
    })
    await expect(parseToolDto(ReorderChildrenDto, { eventIds: ['c1', 'c2'] })).resolves.toEqual({
      eventIds: ['c1', 'c2'],
    })
  })

  it('rejects an empty reorder list', async () => {
    await expect(parseToolDto(ReorderChildrenDto, { eventIds: [] })).rejects.toMatchObject({
      body: { code: 'invalid' },
    })
  })
})
