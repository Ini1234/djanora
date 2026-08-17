import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { interval, merge, Observable, Subject } from 'rxjs'
import { finalize, map, takeUntil } from 'rxjs/operators'

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
  type:
    | 'heartbeat'
    | 'new_message'
    | 'message_updated'
    | 'message_unsent'
    | 'messages_read'
    | 'inquiry_status'
    | 'notification'
    | 'event_comment'
    | 'event_activity'
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

/** Keep Azure / proxy idle timeouts from dropping a quiet stream. */
export const SSE_HEARTBEAT_MS = 15_000
/** Hard cap so a buggy client cannot unbounded-fan-out one user. */
export const SSE_MAX_CONNECTIONS_PER_USER = 5

interface SseConnection {
  subject: Subject<SsePayload>
  stop: Subject<void>
}

@Injectable()
export class SseService implements OnModuleDestroy {
  private streams = new Map<string, Set<SseConnection>>()

  /**
   * Register a live connection. Multiple tabs (and Strict Mode remounts)
   * must share the user, not complete each other.
   */
  subscribe(userId: string): Observable<SsePayload> {
    let set = this.streams.get(userId)
    if (!set) {
      set = new Set()
      this.streams.set(userId, set)
    }

    while (set.size >= SSE_MAX_CONNECTIONS_PER_USER) {
      const oldest = set.values().next().value
      if (!oldest) break
      this.drop(oldest)
    }

    const connection: SseConnection = {
      subject: new Subject<SsePayload>(),
      stop: new Subject<void>(),
    }
    set.add(connection)

    return merge(
      connection.subject.asObservable(),
      interval(SSE_HEARTBEAT_MS).pipe(map((): SsePayload => ({ type: 'heartbeat' }))),
    ).pipe(
      takeUntil(connection.stop),
      finalize(() => {
        set.delete(connection)
        if (set.size === 0) this.streams.delete(userId)
        if (!connection.subject.closed) connection.subject.complete()
        if (!connection.stop.closed) connection.stop.complete()
      }),
    )
  }

  emit(userId: string, payload: SsePayload) {
    const set = this.streams.get(userId)
    if (!set) return
    for (const connection of set) connection.subject.next(payload)
  }

  onModuleDestroy() {
    for (const set of this.streams.values()) {
      for (const connection of [...set]) this.drop(connection)
    }
    this.streams.clear()
  }

  private drop(connection: SseConnection) {
    if (!connection.stop.closed) {
      connection.stop.next()
      connection.stop.complete()
    }
    if (!connection.subject.closed) connection.subject.complete()
  }
}
