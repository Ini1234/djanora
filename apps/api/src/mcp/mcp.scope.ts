import { Injectable } from '@nestjs/common'
import { EventAccessService } from '../events/event-access.service'
import { EventsService } from '../events/events.service'
import { mcpError } from './mcp.errors'
import { McpSessionService } from './mcp.session.service'

export type EventRef = {
  id: string
  title: string
  estimatedDate: string | null
  guestCount: number | null
}

@Injectable()
export class McpScopeService {
  constructor(
    private events: EventsService,
    private access: EventAccessService,
    private sessions: McpSessionService,
  ) {}

  async listRefs(clerkId: string): Promise<EventRef[]> {
    const rows = (await this.events.findByUser(clerkId)) as Array<{
      id: string
      title: string
      estimatedDate?: Date | string | null
      guestCount?: number | null
    }>
    return rows.map((e) => ({
      id: e.id,
      title: e.title,
      estimatedDate: e.estimatedDate ? new Date(e.estimatedDate).toISOString().slice(0, 10) : null,
      guestCount: typeof e.guestCount === 'number' ? e.guestCount : null,
    }))
  }

  async resolve(
    sessionId: string,
    clerkId: string,
    args: { event_id?: string; event_title?: string },
  ): Promise<string> {
    const title = args.event_title?.trim()
    if (args.event_id?.trim()) {
      await this.access.require(clerkId, args.event_id.trim())
      await this.sessions.setCurrentEvent(sessionId, clerkId, args.event_id.trim())
      return args.event_id.trim()
    }
    const visible = await this.listRefs(clerkId)
    if (title) {
      const matches = visible.filter((e) => e.title.toLowerCase() === title.toLowerCase())
      if (matches.length === 1) {
        await this.sessions.setCurrentEvent(sessionId, clerkId, matches[0].id)
        return matches[0].id
      }
      if (matches.length > 1) {
        mcpError('needs_event', 'More than one event has that title. Pass event_id.', {
          events: matches,
        })
      }
      mcpError('needs_event', 'No event with that title.', { events: visible })
    }
    const current = await this.sessions.currentEventId(sessionId)
    if (current) {
      const still = visible.find((e) => e.id === current)
      if (still) return current
      await this.sessions.setCurrentEvent(sessionId, clerkId, null)
    }
    mcpError('needs_event', 'Which event? Pass event_id or event_title, or set_current_event.', {
      events: visible,
    })
  }
}
