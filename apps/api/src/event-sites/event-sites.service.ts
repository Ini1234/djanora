import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  EventSiteAccessMode,
  EventSiteSectionType,
  EventSiteStatus,
  Prisma,
  RsvpStatus,
} from '@prisma/client'
import { randomBytes } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { EventAccessService } from '../events/event-access.service'
import { BlobStorageService } from '../uploads/blob-storage.service'
import { rewriteAppUploadUrl } from '../uploads/public-upload-url'
import { toPublicRsvp } from '../guests/guests.service'
import {
  MAX_PHOTOS,
  MAX_SECTION_PHOTOS,
  RESERVED_SLUGS,
  SECTION_TYPES,
  SESSION_TTL_MS,
  canHaveSectionHero,
  parseCustomColors,
  parseRsvpOptions,
  redactSiteRsvp,
  rsvpDoorError,
  sanitizeFaq,
  sanitizeGifts,
  sanitizeRsvpExtras,
  pickFaqStyle,
  pickGiftsStyle,
  pickMapMode,
  pickPeopleStyle,
  pickPhotosSize,
  pickCoverPhotoSide,
  pickNavAlign,
  pickNavBorder,
  pickNavBorderStyle,
  pickNavBorderWidth,
  pickNavStyle,
  pickPhotosStyle,
  pickScheduleStyle,
  sanitizePlainText,
  sanitizeRichText,
  sanitizeSectionTitle,
  sectionListError,
  slugifySite,
} from './event-site.constants'
import { readSiteSession, signSiteSession } from './event-site.session'
import {
  hostPartyDtos,
  importLegacyParty,
  publicPartyDtos,
  type PartyRow,
} from '../events/event-party.helpers'
import {
  canSeeEventOnSite,
  inviteIsActive,
  publicOwnerFallback,
  publicRobots,
  redactCoverIdentity,
  redactPublicSchedule,
  sectionIsOn,
  toDateOnly,
} from './event-site.visibility'
import type {
  CreateSiteDto,
  PatchSiteDto,
  SiteRsvpDto,
  SiteSectionDto,
  SiteSessionDto,
} from './dto/event-site.dto'

const GENERIC_INVITE = "We couldn't find that invite."
const SITE_INCLUDE = {
  includes: true,
  sections: { orderBy: { sortOrder: 'asc' as const } },
  photos: { orderBy: { sortOrder: 'asc' as const } },
  event: {
    select: {
      id: true,
      title: true,
      eventType: true,
      estimatedDate: true,
      location: true,
      parentId: true,
      deletedAt: true,
      userId: true,
    },
  },
} satisfies Prisma.EventSiteInclude

@Injectable()
export class EventSitesService {
  constructor(
    private prisma: PrismaService,
    private access: EventAccessService,
    private storage: BlobStorageService,
    private config: ConfigService,
  ) {}

  private sessionSecret() {
    const secret = this.config.get<string>('EVENT_SITE_SESSION_SECRET')?.trim()
    if (!secret || secret.length < 32) return null
    return secret
  }

  async create(clerkId: string, eventId: string, dto: CreateSiteDto) {
    const { event } = await this.access.requireSite(clerkId, eventId)
    const slug = this.requireSlug(dto.slug)
    const existing = await this.prisma.eventSite.findUnique({ where: { eventId } })
    if (existing) throw new ConflictException('This event already has a site')
    await this.assertSlugFree(slug)
    const included = event.parentId ? [] : await this.normalizeIncludes(eventId, dto.included ?? [])

    const site = await this.prisma.eventSite.create({
      data: {
        eventId,
        slug,
        ownerAccessMode: dto.ownerAccessMode ?? EventSiteAccessMode.INVITED_ONLY,
        includes: included.length ? { create: included.map((row) => ({ ...row })) } : undefined,
        sections: {
          create: SECTION_TYPES.map((type, i) => ({
            type,
            enabled: type === EventSiteSectionType.COVER,
            sortOrder: i,
            payload: {},
          })),
        },
      },
      include: SITE_INCLUDE,
    })
    return this.toEditorWithSchedule(site)
  }

  async getEditor(clerkId: string, eventId: string) {
    await this.access.requireSite(clerkId, eventId)
    const site = await this.prisma.eventSite.findUnique({
      where: { eventId },
      include: SITE_INCLUDE,
    })
    if (!site || site.event.deletedAt) throw new NotFoundException('Event not found')
    const present = new Set(site.sections.map((s) => s.type))
    const missing = SECTION_TYPES.filter((type) => !present.has(type))
    if (missing.length) {
      await this.prisma.eventSiteSection.createMany({
        data: missing.map((type, i) => ({
          siteId: site.id,
          type,
          enabled: false,
          sortOrder: site.sections.length + i,
          payload: {},
        })),
      })
      return this.getEditor(clerkId, eventId)
    }
    return this.toEditorWithSchedule(site)
  }

  async patch(clerkId: string, eventId: string, dto: PatchSiteDto) {
    await this.access.requireSite(clerkId, eventId)
    const site = await this.mustSiteByEvent(eventId)
    const slug = dto.slug !== undefined ? this.requireSlug(dto.slug) : undefined
    if (slug && slug !== site.slug) await this.assertSlugFree(slug)
    const included =
      dto.included !== undefined
        ? site.event.parentId
          ? []
          : await this.normalizeIncludes(eventId, dto.included)
        : undefined

    const customColors =
      dto.customColors !== undefined ? parseCustomColors(dto.customColors) : undefined
    if (dto.customColors !== undefined && !customColors) {
      throw new BadRequestException('Use hex colors like #1a1a1a')
    }
    const nextPalette = dto.colorPalette ?? site.colorPalette
    const nextColors = customColors ?? parseCustomColors(site.customColors)
    if (nextPalette === 'custom' && !nextColors) {
      throw new BadRequestException('Add background, text, and accent hex colors')
    }

    await this.prisma.$transaction(async (tx) => {
      if (included) {
        await tx.eventSiteInclude.deleteMany({ where: { siteId: site.id } })
        if (included.length) {
          await tx.eventSiteInclude.createMany({
            data: included.map((row) => ({ siteId: site.id, ...row })),
          })
        }
      }
      if (dto.sections) {
        await this.syncSections(tx, site.id, dto.sections)
      }
      await tx.eventSite.update({
        where: { id: site.id },
        data: {
          ...(slug && { slug }),
          ...(dto.ownerAccessMode && { ownerAccessMode: dto.ownerAccessMode }),
          ...(dto.themePreset && { themePreset: dto.themePreset }),
          ...(dto.fontPair && { fontPair: dto.fontPair }),
          ...(dto.colorPalette && { colorPalette: dto.colorPalette }),
          ...(dto.buttonStyle && { buttonStyle: dto.buttonStyle }),
          ...(dto.coverLayout && { coverLayout: dto.coverLayout }),
          ...(dto.coverPhotoSide && { coverPhotoSide: pickCoverPhotoSide(dto.coverPhotoSide) }),
          ...(dto.showEventType !== undefined && { showEventType: dto.showEventType }),
          ...(dto.showEventTitle !== undefined && { showEventTitle: dto.showEventTitle }),
          ...(dto.navPlacement && { navPlacement: dto.navPlacement }),
          ...(dto.navStyle && { navStyle: pickNavStyle(dto.navStyle) }),
          ...(dto.navAlign && { navAlign: pickNavAlign(dto.navAlign) }),
          ...(dto.navName !== undefined && { navName: sanitizePlainText(dto.navName, 80) }),
          ...(dto.navBorder && { navBorder: pickNavBorder(dto.navBorder) }),
          ...(dto.navBorderWidth && { navBorderWidth: pickNavBorderWidth(dto.navBorderWidth) }),
          ...(dto.navBorderStyle && { navBorderStyle: pickNavBorderStyle(dto.navBorderStyle) }),
          ...(customColors && { customColors }),
        },
      })
    })
    return this.getEditor(clerkId, eventId)
  }

  async publish(clerkId: string, eventId: string) {
    await this.access.requireSite(clerkId, eventId)
    const site = await this.mustSiteByEvent(eventId)
    const updated = await this.prisma.eventSite.update({
      where: { id: site.id },
      data: {
        status: EventSiteStatus.PUBLISHED,
        publishedAt: site.publishedAt ?? new Date(),
      },
      include: SITE_INCLUDE,
    })
    return this.toEditorWithSchedule(updated)
  }

  async unpublish(clerkId: string, eventId: string) {
    await this.access.requireSite(clerkId, eventId)
    const site = await this.mustSiteByEvent(eventId)
    const updated = await this.prisma.eventSite.update({
      where: { id: site.id },
      data: { status: EventSiteStatus.DRAFT },
      include: SITE_INCLUDE,
    })
    return this.toEditorWithSchedule(updated)
  }

  async remove(clerkId: string, eventId: string) {
    await this.access.requireSite(clerkId, eventId)
    const site = await this.mustSiteByEvent(eventId)
    const keys = [site.coverPhotoKey, ...site.photos.map((p) => p.filename)].filter(
      (k): k is string => Boolean(k),
    )
    await this.prisma.eventSite.delete({ where: { id: site.id } })
    await Promise.all(
      keys.map((name) => this.storage.delete('images', name).catch(() => undefined)),
    )
    return { ok: true }
  }

  async uploadCover(clerkId: string, eventId: string, filename: string) {
    await this.access.requireSite(clerkId, eventId)
    const site = await this.mustSiteByEvent(eventId)
    if (site.coverPhotoKey) {
      await this.storage.delete('images', site.coverPhotoKey).catch(() => undefined)
    }
    const updated = await this.prisma.eventSite.update({
      where: { id: site.id },
      data: { coverPhotoKey: filename },
      include: SITE_INCLUDE,
    })
    return this.toEditorWithSchedule(updated)
  }

  async uploadPhoto(clerkId: string, eventId: string, filename: string) {
    await this.access.requireSite(clerkId, eventId)
    const site = await this.mustSiteByEvent(eventId)
    const gallery = site.photos.filter((p) => !p.sectionId)
    if (gallery.length >= MAX_PHOTOS) {
      throw new BadRequestException(`Gallery is limited to ${MAX_PHOTOS} photos`)
    }
    await this.prisma.eventSitePhoto.create({
      data: { siteId: site.id, filename, sortOrder: gallery.length },
    })
    return this.getEditor(clerkId, eventId)
  }

  async deletePhoto(clerkId: string, eventId: string, photoId: string) {
    await this.access.requireSite(clerkId, eventId)
    const site = await this.mustSiteByEvent(eventId)
    const photo = site.photos.find((p) => p.id === photoId && !p.sectionId)
    if (!photo) throw new NotFoundException('Event not found')
    await this.prisma.eventSitePhoto.delete({ where: { id: photoId } })
    await this.storage.delete('images', photo.filename).catch(() => undefined)
    return this.getEditor(clerkId, eventId)
  }

  async uploadSectionPhoto(
    clerkId: string,
    eventId: string,
    sectionId: string,
    filename: string,
    alt = '',
  ) {
    await this.access.requireSite(clerkId, eventId)
    const site = await this.mustSiteByEvent(eventId)
    const section = site.sections.find((s) => s.id === sectionId)
    if (!section || !canHaveSectionHero(section.type)) {
      throw new BadRequestException('This section cannot have an image')
    }
    const existing = site.photos.find((p) => p.sectionId === sectionId && !p.personId)
    const heroes = site.photos.filter((p) => p.sectionId && !p.personId)
    if (!existing && heroes.length >= MAX_SECTION_PHOTOS) {
      throw new BadRequestException(`Section images are limited to ${MAX_SECTION_PHOTOS}`)
    }
    if (existing) {
      await this.storage.delete('images', existing.filename).catch(() => undefined)
      await this.prisma.eventSitePhoto.update({
        where: { id: existing.id },
        data: { filename, alt: sanitizePlainText(alt, 200) },
      })
    } else {
      await this.prisma.eventSitePhoto.create({
        data: {
          siteId: site.id,
          sectionId,
          filename,
          alt: sanitizePlainText(alt, 200),
          sortOrder: 0,
        },
      })
    }
    return this.getEditor(clerkId, eventId)
  }

  async deleteSectionPhoto(clerkId: string, eventId: string, sectionId: string) {
    await this.access.requireSite(clerkId, eventId)
    const site = await this.mustSiteByEvent(eventId)
    const photo = site.photos.find((p) => p.sectionId === sectionId && !p.personId)
    if (!photo) throw new NotFoundException('Event not found')
    await this.prisma.eventSitePhoto.delete({ where: { id: photo.id } })
    await this.storage.delete('images', photo.filename).catch(() => undefined)
    return this.getEditor(clerkId, eventId)
  }

  async uploadPersonPhoto(
    clerkId: string,
    eventId: string,
    _sectionId: string,
    personId: string,
    filename: string,
    _alt = '',
  ) {
    await this.access.requireSite(clerkId, eventId)
    const member = await this.prisma.eventPartyMember.findFirst({
      where: { id: personId, eventId },
    })
    if (!member) {
      throw new BadRequestException('Add this person before uploading a photo')
    }
    if (member.photoKey) {
      await this.storage.delete('images', member.photoKey).catch(() => undefined)
    }
    await this.prisma.eventPartyMember.update({
      where: { id: personId },
      data: { photoKey: filename },
    })
    return this.getEditor(clerkId, eventId)
  }

  async deletePersonPhoto(clerkId: string, eventId: string, _sectionId: string, personId: string) {
    await this.access.requireSite(clerkId, eventId)
    const member = await this.prisma.eventPartyMember.findFirst({
      where: { id: personId, eventId },
    })
    if (!member) throw new NotFoundException('Event not found')
    if (member.photoKey) {
      await this.storage.delete('images', member.photoKey).catch(() => undefined)
    }
    await this.prisma.eventPartyMember.update({
      where: { id: personId },
      data: { photoKey: null },
    })
    return this.getEditor(clerkId, eventId)
  }

  async getPublic(slug: string, sessionHeader?: string) {
    const site = await this.publishedSite(slug)
    const session = this.parseSession(sessionHeader, site.id)
    return this.projectPublic(site, session?.guestIds ?? [])
  }

  async createSession(slug: string, dto: SiteSessionDto) {
    const secret = this.sessionSecret()
    if (!secret) throw new ServiceUnavailableException('Site sessions are not configured')
    const site = await this.publishedSite(slug)
    const eventIds = this.siteEventIds(site)
    const guestIds = await this.resolveGuests(eventIds, {
      email: dto.email,
      code: dto.code ?? dto.inviteeId,
    })
    if (guestIds.length === 0) throw new UnauthorizedException(GENERIC_INVITE)
    const expiresAt = Date.now() + SESSION_TTL_MS
    const token = signSiteSession({ siteId: site.id, guestIds, exp: expiresAt }, secret)
    return { token, expiresAt: new Date(expiresAt).toISOString() }
  }

  async rsvp(slug: string, dto: SiteRsvpDto, sessionHeader?: string) {
    const site = await this.publishedSite(slug)
    const session = this.parseSession(sessionHeader, site.id)
    let guestIds = session?.guestIds ?? []
    if ((dto.email || dto.code || dto.inviteeId) && guestIds.length === 0) {
      guestIds = await this.resolveGuests(this.siteEventIds(site), {
        email: dto.email,
        code: dto.code ?? dto.inviteeId,
      })
    }

    const configs = this.eventConfigs(site)
    const target = configs.find((c) => c.eventId === dto.eventId)
    if (!target || !target.hasOwnGuestList) throw new NotFoundException('Event not found')

    const map = await this.guestEventMap(guestIds)
    const allowed = canSeeEventOnSite(target, site.eventId, new Set(map.values()))
    if (!allowed && target.accessMode !== EventSiteAccessMode.OPEN) {
      throw new NotFoundException('Event not found')
    }

    const rsvpSection = site.sections.find((s) => s.type === EventSiteSectionType.RSVP)
    const rsvpError = rsvpDoorError(rsvpSection, dto.status)
    if (rsvpError) throw new BadRequestException(rsvpError)
    const rsvpOpts = parseRsvpOptions(this.payloadOf(rsvpSection))
    const coverFlags = {
      showEventType: site.showEventType === true,
      showEventTitle: site.showEventTitle === true,
    }

    if (target.accessMode === EventSiteAccessMode.OPEN) {
      const email = dto.email?.trim().toLowerCase()
      if (!email) throw new BadRequestException('Email is required')
      const invite = await this.upsertOpenGuest(dto.eventId, email)
      return this.writeRsvp(invite.id, dto, rsvpOpts, coverFlags)
    }

    const guestId = [...map.entries()].find(([, eventId]) => eventId === dto.eventId)?.[0]
    if (!guestId) throw new UnauthorizedException(GENERIC_INVITE)
    const invite = await this.prisma.guestInvite.findUnique({ where: { guestId } })
    if (!invite || !inviteIsActive(invite.expiresAt))
      throw new UnauthorizedException(GENERIC_INVITE)
    return this.writeRsvp(invite.id, dto, rsvpOpts, coverFlags)
  }

  private async writeRsvp(
    inviteId: string,
    dto: SiteRsvpDto,
    opts: ReturnType<typeof parseRsvpOptions>,
    cover: { showEventType: boolean; showEventTitle: boolean },
  ) {
    const extras = sanitizeRsvpExtras(dto)
    const updated = await this.prisma.guestInvite.update({
      where: { id: inviteId },
      data: {
        rsvpStatus: dto.status,
        rsvpAt: new Date(),
        plusOneName: opts.collectPlusOne ? extras.plusOneName : null,
        dietaryNote: opts.collectDietary ? extras.dietaryNote : null,
        guestMessage: opts.collectMessage ? extras.guestMessage : null,
      },
      include: {
        guest: { select: { firstName: true, lastName: true, plusOneAllowed: true } },
        event: {
          select: { id: true, title: true, eventType: true, estimatedDate: true, location: true },
        },
      },
    })
    const dtoOut = redactSiteRsvp(toPublicRsvp(updated), opts)
    return {
      ...dtoOut,
      event: redactCoverIdentity(dtoOut.event, cover),
    }
  }

  private async upsertOpenGuest(eventId: string, email: string) {
    const existing = await this.prisma.guest.findFirst({
      where: { eventId, email: { equals: email, mode: 'insensitive' } },
      include: { invite: true },
    })
    if (existing?.invite) return existing.invite
    if (existing) {
      return this.prisma.guestInvite.create({
        data: {
          guestId: existing.id,
          eventId,
          token: randomBytes(32).toString('hex'),
        },
      })
    }
    const local = email.split('@')[0] || 'Guest'
    const guest = await this.prisma.guest.create({
      data: {
        eventId,
        firstName: local,
        email,
        invite: {
          create: {
            eventId,
            token: randomBytes(32).toString('hex'),
            rsvpStatus: RsvpStatus.PENDING,
          },
        },
      },
      include: { invite: true },
    })
    return guest.invite!
  }

  private async projectPublic(
    site: Prisma.EventSiteGetPayload<{ include: typeof SITE_INCLUDE }>,
    guestIds: string[],
  ) {
    const map = await this.guestEventMap(guestIds)
    const configs = this.eventConfigs(site)
    const visible = configs.filter((c) => canSeeEventOnSite(c, site.eventId, new Set(map.values())))
    const visibleIds = new Set(visible.map((c) => c.eventId))

    const events = await this.prisma.event.findMany({
      where: { id: { in: [...visibleIds] }, deletedAt: null },
      include: {
        schedule: { where: { showOnSite: true }, orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }] },
      },
    })
    const byId = new Map(events.map((e) => [e.id, e]))
    const invites =
      guestIds.length > 0
        ? await this.prisma.guestInvite.findMany({
            where: { guestId: { in: guestIds }, eventId: { in: [...visibleIds] } },
          })
        : []
    const inviteByEvent = new Map(invites.map((i) => [i.eventId, i]))

    const coverFlags = {
      showEventType: site.showEventType === true,
      showEventTitle: site.showEventTitle === true,
    }
    const scheduleSection = site.sections.find((s) => s.type === EventSiteSectionType.SCHEDULE)
    const scheduleOn = Boolean(scheduleSection?.enabled)
    const schedulePayload = this.payloadOf(scheduleSection)
    const scheduleFlags = {
      showTimes: schedulePayload.showTimes !== false,
      showItemDirections: schedulePayload.showItemDirections !== false,
    }
    const rsvpOn = sectionIsOn(site.sections, EventSiteSectionType.RSVP)
    const photosOn = sectionIsOn(site.sections, EventSiteSectionType.PHOTOS)
    const peopleOn = sectionIsOn(site.sections, EventSiteSectionType.PEOPLE)
    await importLegacyParty(this.prisma, site.eventId)
    const partyMembers: PartyRow[] = peopleOn
      ? await this.prisma.eventPartyMember.findMany({
          where: { eventId: site.eventId },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        })
      : []

    const toSlice = (config: (typeof configs)[0]) => {
      const event = byId.get(config.eventId)
      if (!event) return null
      const invite = inviteByEvent.get(event.id)
      return {
        eventId: event.id,
        title: event.title,
        eventType: event.eventType,
        estimatedDate: toDateOnly(event.estimatedDate),
        location: event.location,
        accessMode: config.accessMode,
        hasOwnGuestList: config.hasOwnGuestList,
        schedule: scheduleOn
          ? redactPublicSchedule(
              event.schedule.map((item) => ({
                id: item.id,
                title: item.title,
                date: toDateOnly(item.date),
                startTime: item.startTime,
                endTime: item.endTime,
                location: item.location,
              })),
              scheduleFlags,
            )
          : [],
        canRsvp: rsvpOn && config.hasOwnGuestList,
        rsvp: rsvpOn && invite ? { status: invite.rsvpStatus, rsvpAt: invite.rsvpAt } : null,
      }
    }

    const ownerConfig = visible.find((c) => c.eventId === site.eventId)
    const owner = redactCoverIdentity(
      (ownerConfig ? toSlice(ownerConfig) : null) ??
        publicOwnerFallback(
          site.event,
          site.ownerAccessMode,
          visible.some((c) => c.accessMode === EventSiteAccessMode.OPEN),
          coverFlags,
        ),
      coverFlags,
    )

    const children = visible
      .filter((c) => c.eventId !== site.eventId)
      .map(toSlice)
      .filter((s): s is NonNullable<typeof s> => Boolean(s))

    return {
      slug: site.slug,
      status: 'PUBLISHED' as const,
      look: {
        themePreset: site.themePreset,
        fontPair: site.fontPair,
        colorPalette: site.colorPalette,
        buttonStyle: site.buttonStyle,
        coverLayout: site.coverLayout,
        coverPhotoSide: pickCoverPhotoSide(site.coverPhotoSide),
        navPlacement: site.navPlacement,
        navStyle: pickNavStyle(site.navStyle),
        navAlign: pickNavAlign(site.navAlign),
        navName: site.navName,
        navBorder: pickNavBorder(site.navBorder),
        navBorderWidth: pickNavBorderWidth(site.navBorderWidth),
        navBorderStyle: pickNavBorderStyle(site.navBorderStyle),
        customColors: parseCustomColors(site.customColors),
        coverPhotoUrl: rewriteAppUploadUrl(
          site.coverPhotoKey ? `uploads/${site.coverPhotoKey}` : null,
        ),
      },
      sections: this.decorateSections(
        site.sections.filter((s) => s.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
        site.photos,
        peopleOn ? publicPartyDtos(partyMembers) : [],
      ).map((section) => this.omitPublicSwitches(section)),
      photos: photosOn ? this.galleryPhotos(site.photos) : [],
      owner,
      children,
      robots: publicRobots(visible),
    }
  }

  private eventConfigs(site: {
    eventId: string
    ownerAccessMode: EventSiteAccessMode
    includes: { eventId: string; accessMode: EventSiteAccessMode; hasOwnGuestList: boolean }[]
  }) {
    return [
      { eventId: site.eventId, accessMode: site.ownerAccessMode, hasOwnGuestList: true },
      ...site.includes.map((row) => ({
        eventId: row.eventId,
        accessMode: row.accessMode,
        hasOwnGuestList: row.hasOwnGuestList,
      })),
    ]
  }

  private siteEventIds(site: { eventId: string; includes: { eventId: string }[] }) {
    return [site.eventId, ...site.includes.map((i) => i.eventId)]
  }

  private async resolveGuests(eventIds: string[], dto: { email?: string; code?: string }) {
    if (dto.code?.trim()) {
      const invite = await this.prisma.guestInvite.findFirst({
        where: { token: dto.code.trim(), eventId: { in: eventIds } },
        select: { guestId: true, expiresAt: true },
      })
      return invite && inviteIsActive(invite.expiresAt) ? [invite.guestId] : []
    }
    const email = dto.email?.trim()
    if (!email) return []
    const guests = await this.prisma.guest.findMany({
      where: { eventId: { in: eventIds }, email: { equals: email, mode: 'insensitive' } },
      select: { id: true, invite: { select: { expiresAt: true } } },
    })
    return guests.filter((g) => inviteIsActive(g.invite?.expiresAt)).map((g) => g.id)
  }

  private async guestEventMap(guestIds: string[]) {
    if (guestIds.length === 0) return new Map<string, string>()
    const guests = await this.prisma.guest.findMany({
      where: { id: { in: guestIds } },
      select: { id: true, eventId: true },
    })
    return new Map(guests.map((g) => [g.id, g.eventId]))
  }

  private parseSession(header: string | undefined, siteId: string) {
    const secret = this.sessionSecret()
    if (!secret) return null
    const payload = readSiteSession(header, secret)
    if (!payload || payload.siteId !== siteId) return null
    return payload
  }

  private async publishedSite(slug: string) {
    const site = await this.prisma.eventSite.findUnique({
      where: { slug },
      include: SITE_INCLUDE,
    })
    if (!site || site.event.deletedAt || site.status !== EventSiteStatus.PUBLISHED) {
      throw new NotFoundException('Event not found')
    }
    return site
  }

  private async mustSiteByEvent(eventId: string) {
    const site = await this.prisma.eventSite.findUnique({
      where: { eventId },
      include: SITE_INCLUDE,
    })
    if (!site || site.event.deletedAt) throw new NotFoundException('Event not found')
    return site
  }

  private requireSlug(raw: string) {
    const value = slugifySite(raw)
    if (!value) throw new BadRequestException('Use some letters or numbers in the name')
    if (value.length < 3) throw new BadRequestException('Use at least 3 letters or numbers')
    if (RESERVED_SLUGS.has(value))
      throw new BadRequestException('That URL is reserved — pick another')
    return value
  }

  private async assertSlugFree(slug: string) {
    const taken = await this.prisma.eventSite.findUnique({ where: { slug } })
    if (taken) throw new BadRequestException('That URL is already taken')
  }

  private async normalizeIncludes(
    parentId: string,
    rows: { eventId: string; accessMode: EventSiteAccessMode; hasOwnGuestList: boolean }[],
  ) {
    if (rows.length === 0) return []
    const ids = [...new Set(rows.map((r) => r.eventId))]
    const children = await this.prisma.event.findMany({
      where: { id: { in: ids }, parentId, deletedAt: null },
      select: { id: true },
    })
    if (children.length !== ids.length) {
      throw new BadRequestException('Included events must be direct children of this event')
    }
    return rows.map((r) => ({
      eventId: r.eventId,
      accessMode: r.accessMode,
      hasOwnGuestList: r.hasOwnGuestList,
    }))
  }

  private async syncSections(
    tx: Prisma.TransactionClient,
    siteId: string,
    incoming: SiteSectionDto[],
  ) {
    const error = sectionListError(incoming)
    if (error) throw new BadRequestException(error)

    const existing = await tx.eventSiteSection.findMany({ where: { siteId } })
    const existingById = new Map(existing.map((row) => [row.id, row]))
    const existingBuiltin = new Map(
      existing
        .filter((row) => row.type !== EventSiteSectionType.CUSTOM)
        .map((row) => [row.type, row]),
    )
    const keepCustomIds = incoming
      .filter((section) => section.type === EventSiteSectionType.CUSTOM && section.id)
      .map((section) => section.id!)
    const doomedCustom = existing.filter(
      (row) => row.type === EventSiteSectionType.CUSTOM && !keepCustomIds.includes(row.id),
    )
    if (doomedCustom.length) {
      const doomedPhotos = await tx.eventSitePhoto.findMany({
        where: { sectionId: { in: doomedCustom.map((row) => row.id) } },
      })
      await Promise.all(
        doomedPhotos.map((photo) =>
          this.storage.delete('images', photo.filename).catch(() => undefined),
        ),
      )
    }

    if (keepCustomIds.length === 0) {
      await tx.eventSiteSection.deleteMany({ where: { siteId, type: EventSiteSectionType.CUSTOM } })
    } else {
      await tx.eventSiteSection.deleteMany({
        where: { siteId, type: EventSiteSectionType.CUSTOM, id: { notIn: keepCustomIds } },
      })
    }

    for (const section of incoming) {
      const payload = this.sectionPayload(section)
      const enabled = section.type === EventSiteSectionType.COVER ? true : section.enabled
      const sortOrder =
        section.type === EventSiteSectionType.COVER ? 0 : Math.max(1, section.sortOrder ?? 1)

      if (section.type === EventSiteSectionType.CUSTOM) {
        const row = section.id ? existingById.get(section.id) : undefined
        if (row?.type === EventSiteSectionType.CUSTOM) {
          await tx.eventSiteSection.update({
            where: { id: row.id },
            data: { enabled, sortOrder, payload },
          })
        } else {
          const taken = section.id
            ? await tx.eventSiteSection.findUnique({
                where: { id: section.id },
                select: { id: true },
              })
            : null
          await tx.eventSiteSection.create({
            data: {
              ...(section.id && !taken ? { id: section.id } : {}),
              siteId,
              type: EventSiteSectionType.CUSTOM,
              enabled,
              sortOrder,
              payload,
            },
          })
        }
        continue
      }

      const row = existingBuiltin.get(section.type)
      if (row) {
        await tx.eventSiteSection.update({
          where: { id: row.id },
          data: {
            enabled,
            ...(section.type !== EventSiteSectionType.COVER && { sortOrder }),
            payload,
          },
        })
      } else {
        await tx.eventSiteSection.create({
          data: { siteId, type: section.type, enabled, sortOrder, payload },
        })
      }
    }
  }

  private sectionPayload(section: SiteSectionDto): Prisma.InputJsonValue {
    const layout = section.layout === 'horizontal' ? 'horizontal' : 'vertical'
    const note = sanitizePlainText(section.note ?? '', 2000)
    if (section.type === EventSiteSectionType.CUSTOM) {
      return {
        layout,
        title: sanitizeSectionTitle(section.title ?? ''),
        body: sanitizePlainText(section.body ?? '', 8000),
      }
    }
    if (section.type === EventSiteSectionType.ABOUT) {
      return { layout, about: sanitizeRichText(section.about ?? '', 8000) }
    }
    if (section.type === EventSiteSectionType.DRESS_CODE) {
      return { layout, dressCode: sanitizePlainText(section.dressCode ?? '', 8000) }
    }
    if (section.type === EventSiteSectionType.STAY) {
      return { layout, stay: sanitizePlainText(section.stay ?? '', 8000) }
    }
    if (section.type === EventSiteSectionType.PEOPLE) {
      return { layout, peopleStyle: pickPeopleStyle(section.peopleStyle) }
    }
    if (section.type === EventSiteSectionType.FAQ) {
      return { layout, faqStyle: pickFaqStyle(section.faqStyle), faq: sanitizeFaq(section.faq) }
    }
    if (section.type === EventSiteSectionType.GIFTS) {
      return {
        layout,
        giftsStyle: pickGiftsStyle(section.giftsStyle),
        gifts: sanitizeGifts(section.gifts),
      }
    }
    if (section.type === EventSiteSectionType.TRAVEL) {
      return { layout, travel: sanitizePlainText(section.travel ?? '', 8000) }
    }
    if (section.type === EventSiteSectionType.SCHEDULE) {
      return {
        layout,
        scheduleStyle: pickScheduleStyle(section.scheduleStyle),
        groupByDay: section.groupByDay !== false,
        showTimes: section.showTimes !== false,
        showItemDirections: section.showItemDirections !== false,
        note,
      }
    }
    if (section.type === EventSiteSectionType.WHERE) {
      return { layout, map: pickMapMode(section.map), note }
    }
    if (section.type === EventSiteSectionType.PHOTOS) {
      return {
        layout,
        photosStyle: pickPhotosStyle(section.photosStyle),
        photosSize: pickPhotosSize(section.photosSize),
      }
    }
    if (section.type === EventSiteSectionType.RSVP) {
      const rsvp = parseRsvpOptions({
        intro: section.intro,
        rsvpOpen: section.rsvpOpen,
        allowMaybe: section.allowMaybe,
        collectPlusOne: section.collectPlusOne,
        collectDietary: section.collectDietary,
        collectMessage: section.collectMessage,
        deadline: section.deadline,
      })
      return { layout, ...rsvp }
    }
    return { layout }
  }

  private payloadOf(section?: { payload: Prisma.JsonValue } | null) {
    if (
      !section?.payload ||
      typeof section.payload !== 'object' ||
      Array.isArray(section.payload)
    ) {
      return {}
    }
    return section.payload as Record<string, unknown>
  }

  private publicImage(photo?: { id: string; filename: string; alt?: string } | null) {
    if (!photo) return undefined
    return {
      id: photo.id,
      url: rewriteAppUploadUrl(`uploads/${photo.filename}`),
      alt: photo.alt ?? '',
    }
  }

  private decorateSections(
    sections: {
      id: string
      type: EventSiteSectionType
      enabled: boolean
      sortOrder: number
      payload: Prisma.JsonValue
    }[],
    photos: {
      id: string
      filename: string
      alt: string
      sectionId: string | null
      personId: string | null
      sortOrder: number
    }[],
    livePeople: ReturnType<typeof publicPartyDtos> = [],
  ) {
    const heroes = new Map(
      photos.filter((p) => p.sectionId && !p.personId).map((p) => [p.sectionId as string, p]),
    )
    return sections.map((s) => {
      const mapped = this.mapSection(s)
      const image = this.publicImage(heroes.get(s.id))
      return {
        ...mapped,
        ...(image ? { image } : {}),
        ...(s.type === EventSiteSectionType.PEOPLE ? { people: livePeople } : {}),
      }
    })
  }

  private galleryPhotos(
    photos: { id: string; filename: string; sectionId: string | null; sortOrder: number }[],
  ) {
    return photos
      .filter((p) => !p.sectionId)
      .map((p) => ({
        id: p.id,
        url: rewriteAppUploadUrl(`uploads/${p.filename}`),
        sortOrder: p.sortOrder,
      }))
  }

  private omitPublicSwitches<T extends { type: EventSiteSectionType }>(section: T) {
    if (section.type !== EventSiteSectionType.SCHEDULE) return section
    const rest = { ...section } as T & { showTimes?: boolean; showItemDirections?: boolean }
    delete rest.showTimes
    delete rest.showItemDirections
    return rest
  }

  private mapSection(s: {
    id: string
    type: EventSiteSectionType
    enabled: boolean
    sortOrder: number
    payload: Prisma.JsonValue
  }) {
    const payload = this.payloadOf(s)
    return {
      ...payload,
      id: s.id,
      type: s.type,
      enabled: s.enabled,
      sortOrder: s.sortOrder,
      ...(s.type === EventSiteSectionType.FAQ
        ? { faq: sanitizeFaq(payload.faq as { question?: string; answer?: string }[]) }
        : {}),
      ...(s.type === EventSiteSectionType.GIFTS
        ? { gifts: sanitizeGifts(payload.gifts as { label?: string; url?: string }[]) }
        : {}),
    }
  }

  private async toEditorWithSchedule(
    site: Prisma.EventSiteGetPayload<{ include: typeof SITE_INCLUDE }>,
  ) {
    const [schedule, event, partyMembers] = await Promise.all([
      this.prisma.eventScheduleItem.findMany({
        where: { eventId: site.eventId, showOnSite: true },
        orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }],
        select: {
          id: true,
          title: true,
          date: true,
          startTime: true,
          endTime: true,
          location: true,
        },
      }),
      this.prisma.event.findFirst({
        where: { id: site.eventId, deletedAt: null },
        select: { partyEnabled: true },
      }),
      importLegacyParty(this.prisma, site.eventId).then(() =>
        this.prisma.eventPartyMember.findMany({
          where: { eventId: site.eventId },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        }),
      ),
    ])
    return {
      ...this.toEditor(site, publicPartyDtos(partyMembers)),
      schedule,
      party: { enabled: event?.partyEnabled === true, members: hostPartyDtos(partyMembers) },
    }
  }

  private toEditor(
    site: Prisma.EventSiteGetPayload<{ include: typeof SITE_INCLUDE }>,
    livePeople: ReturnType<typeof publicPartyDtos> = [],
  ) {
    return {
      id: site.id,
      eventId: site.eventId,
      slug: site.slug,
      status: site.status,
      publishedAt: site.publishedAt,
      ownerAccessMode: site.ownerAccessMode,
      included: site.includes.map((row) => ({
        eventId: row.eventId,
        accessMode: row.accessMode,
        hasOwnGuestList: row.hasOwnGuestList,
      })),
      themePreset: site.themePreset,
      fontPair: site.fontPair,
      colorPalette: site.colorPalette,
      buttonStyle: site.buttonStyle,
      coverLayout: site.coverLayout,
      coverPhotoSide: pickCoverPhotoSide(site.coverPhotoSide),
      showEventType: site.showEventType,
      showEventTitle: site.showEventTitle,
      navPlacement: site.navPlacement,
      navStyle: pickNavStyle(site.navStyle),
      navAlign: pickNavAlign(site.navAlign),
      navName: site.navName,
      navBorder: pickNavBorder(site.navBorder),
      navBorderWidth: pickNavBorderWidth(site.navBorderWidth),
      navBorderStyle: pickNavBorderStyle(site.navBorderStyle),
      customColors: parseCustomColors(site.customColors),
      coverPhotoUrl: rewriteAppUploadUrl(
        site.coverPhotoKey ? `uploads/${site.coverPhotoKey}` : null,
      ),
      photos: this.galleryPhotos(site.photos),
      sections: this.decorateSections(site.sections, site.photos, livePeople),
    }
  }
}
