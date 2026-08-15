import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { Observable, Subject } from 'rxjs'
import { finalize } from 'rxjs/operators'

// ─── Payload types ────────────────────────────────────────────────────────────

export interface SseNotificationPayload {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: Date
  metadata: unknown
}

export interface SseCommentPayload {
  action: 'created' | 'updated' | 'deleted'
  id: string
  eventId: string
  subjectType: string
  subjectId: string
  parentId?: string | null
  body?: string
  createdAt?: Date
  updatedAt?: Date
  author?: {
    id: string
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
  }
  mentions?: { userId: string }[]
}

export interface SseActivityPayload {
  id: string
  eventId: string
  action: string
  surface: string
  summary: string
  subjectType: string | null
  subjectId: string | null
  createdAt: Date
  actor: {
    id: string
    firstName: string | null
    lastName: string | null
  }
}

export interface SsePayload {
  type: 'new_message' | 'message_updated' | 'message_unsent' | 'messages_read' | 'inquiry_status' | 'notification' | 'event_comment' | 'event_activity'
  inquiryId?: string
  eventId?: string
  comment?: SseCommentPayload
  activity?: SseActivityPayload
  /** Only present for new_message and message_updated events */
  message?: {
    id: string
    message: string
    kind?: string
    payload?: unknown
    createdAt: Date
    readAt?: Date | null
    editedAt?: Date | null
    unsentAt?: Date | null
    isCurrentUser: boolean
    sender: {
      id: string
      firstName: string | null
      lastName: string | null
      avatarUrl: string | null
    }
  }
  /** Only present for message_unsent events */
  unsent?: {
    messageId: string
    unsentAt: Date
  }
  /** Only present for messages_read events */
  read?: {
    messageIds: string[]
    readAt: Date
  }
  /** Only present for inquiry_status events */
  status?: string
  /** Only present for notification events */
  notification?: SseNotificationPayload
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class SseService implements OnModuleDestroy {
  /** One Subject per connected user (keyed by DB user.id) */
  private streams = new Map<string, Subject<SsePayload>>()

  /**
   * Called by the controller to register a new connection for a user.
   * Any existing connection is completed first so there is never more than
   * one active subscriber per user.
   */
  subscribe(userId: string): Observable<SsePayload> {
    const existing = this.streams.get(userId)
    if (existing && !existing.closed) {
      existing.complete()
    }

    const subject = new Subject<SsePayload>()
    this.streams.set(userId, subject)

    return subject.asObservable().pipe(
      finalize(() => {
        if (this.streams.get(userId) === subject) {
          this.streams.delete(userId)
        }
      }),
    )
  }

  /** Called by services to push an event to a specific user. */
  emit(userId: string, payload: SsePayload) {
    this.streams.get(userId)?.next(payload)
  }

  onModuleDestroy() {
    this.streams.forEach((s) => s.complete())
    this.streams.clear()
  }
}
