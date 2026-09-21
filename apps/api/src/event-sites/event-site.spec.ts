import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { EventMemberRole, EventSiteAccessMode, EventSurface } from '@prisma/client'
import { ALL_SURFACES, EventAccessService } from '../events/event-access.service'
import {
  canHaveSectionHero,
  eventSiteInviteUrl,
  normalizeHex,
  parseCustomColors,
  parseRsvpOptions,
  pickCoverPhotoSide,
  pickNavAlign,
  pickNavBorder,
  pickNavBorderStyle,
  pickNavBorderWidth,
  pickNavStyle,
  pickPhotosSize,
  pickPhotosStyle,
  pickScheduleStyle,
  redactSiteRsvp,
  rsvpConfigError,
  rsvpDoorError,
  sanitizeFaq,
  sanitizeGifts,
  sanitizePeople,
  sanitizeRichText,
  sanitizeRsvpExtras,
  sanitizeSectionTitle,
  sectionListError,
  toPublicSlug,
} from './event-site.constants'
import { CreateSiteDto, PatchSiteDto, SiteRsvpDto } from './dto/event-site.dto'
import { readSiteSession, signSiteSession } from './event-site.session'
import {
  canSeeEventOnSite,
  inviteIsActive,
  publicOwnerFallback,
  publicRobots,
  redactCoverIdentity,
  redactPublicSchedule,
  sectionIsOn,
} from './event-site.visibility'
import { EventSitesService } from './event-sites.service'

describe('SITE is a grant only (FR-7, AC-19)', () => {
  it('is not a planning surface', () => {
    expect(ALL_SURFACES).not.toContain(EventSurface.SITE)
    expect(ALL_SURFACES).toContain(EventSurface.PARTY)
  })
})

describe('event site slug (FR-14)', () => {
  it('accepts freeform names and slugifies them', () => {
    expect(toPublicSlug('amaka-kemi')).toBe('amaka-kemi')
    expect(toPublicSlug('  Party-2026  ')).toBe('party-2026')
    expect(toPublicSlug('Amaka and Kemi')).toBe('amaka-and-kemi')
    expect(toPublicSlug("Kemi's Wedding")).toBe('kemis-wedding')
    expect(toPublicSlug('Amaka & Kemi — June 2026')).toBe('amaka-kemi-june-2026')
  })

  it('rejects reserved, too-short, and empty slugs', () => {
    expect(toPublicSlug('rsvp')).toBeNull()
    expect(toPublicSlug('e')).toBeNull()
    expect(toPublicSlug('ab')).toBeNull()
    expect(toPublicSlug('---')).toBeNull()
    expect(toPublicSlug('???')).toBeNull()
    expect(toPublicSlug('   ')).toBeNull()
  })

  it('puts the invite identifier on /e/{slug}', () => {
    expect(eventSiteInviteUrl('https://djanora.com', 'izien-and-lois', 'abc123')).toBe(
      'https://djanora.com/e/izien-and-lois?inviteeId=abc123',
    )
  })
})

const PIPE = { whitelist: true, forbidNonWhitelisted: true }

describe('event site DTOs', () => {
  it('accepts a freeform create name', async () => {
    const dto = plainToInstance(CreateSiteDto, {
      slug: 'Amaka and Kemi',
      ownerAccessMode: 'INVITED_ONLY',
    })
    expect(await validate(dto, PIPE)).toEqual([])
  })

  it('accepts a save payload with section sortOrder', async () => {
    const dto = plainToInstance(PatchSiteDto, {
      slug: 'amaka-and-kemi',
      ownerAccessMode: 'INVITED_ONLY',
      themePreset: 'linen',
      fontPair: 'serif-sans',
      colorPalette: 'ivory-gold',
      buttonStyle: 'pill',
      coverLayout: 'full-bleed',
      included: [],
      sections: [{ type: 'COVER', enabled: true, sortOrder: 0 }],
    })
    expect(await validate(dto, PIPE)).toEqual([])
  })

  it('accepts section layout and rejects unknown values', async () => {
    const ok = plainToInstance(PatchSiteDto, {
      sections: [{ type: 'PEOPLE', enabled: true, sortOrder: 2, layout: 'horizontal' }],
    })
    expect(await validate(ok, PIPE)).toEqual([])
    const bad = plainToInstance(PatchSiteDto, {
      sections: [{ type: 'PEOPLE', enabled: true, layout: 'grid' }],
    })
    expect(await validate(bad, PIPE)).not.toEqual([])
  })

  it('accepts nav placement and custom hex colors', async () => {
    const ok = plainToInstance(PatchSiteDto, {
      navPlacement: 'side',
      colorPalette: 'custom',
      customColors: { bg: '#F7F1E6', fg: '#2b2418', accent: '#8a6a2f' },
    })
    expect(await validate(ok, PIPE)).toEqual([])
  })

  it('rejects css strings and invalid hex', async () => {
    const css = plainToInstance(PatchSiteDto, {
      customColors: { bg: 'red', fg: '#111', accent: '#222' },
    })
    expect(await validate(css, PIPE)).not.toEqual([])
    const badNav = plainToInstance(PatchSiteDto, { navPlacement: 'bottom' })
    expect(await validate(badNav, PIPE)).not.toEqual([])
    const okLook = plainToInstance(PatchSiteDto, {
      navStyle: 'pill',
      navAlign: 'before',
      navName: 'Amaka & Kemi',
      navBorder: 'on',
      navBorderWidth: 'thick',
      navBorderStyle: 'dashed',
      showEventType: false,
      showEventTitle: false,
    })
    expect(await validate(okLook, PIPE)).toEqual([])
    const badType = plainToInstance(PatchSiteDto, { showEventType: 'no' })
    expect(await validate(badType, PIPE)).not.toEqual([])
    const badTitle = plainToInstance(PatchSiteDto, { showEventTitle: 'no' })
    expect(await validate(badTitle, PIPE)).not.toEqual([])
    const badStyle = plainToInstance(PatchSiteDto, { navStyle: 'fancy' })
    expect(await validate(badStyle, PIPE)).not.toEqual([])
    const badBorder = plainToInstance(PatchSiteDto, { navBorder: 'maybe', navBorderWidth: 'huge' })
    expect(await validate(badBorder, PIPE)).not.toEqual([])
    const okCoverSide = plainToInstance(PatchSiteDto, {
      coverLayout: 'split',
      coverPhotoSide: 'right',
    })
    expect(await validate(okCoverSide, PIPE)).toEqual([])
    const badCoverSide = plainToInstance(PatchSiteDto, { coverPhotoSide: 'center' })
    expect(await validate(badCoverSide, PIPE)).not.toEqual([])
  })

  it('accepts party catalogs and rejects a section image field', async () => {
    const ok = plainToInstance(PatchSiteDto, {
      sections: [
        {
          type: 'PEOPLE',
          enabled: true,
          sortOrder: 2,
          peopleStyle: 'cards',
          people: [
            { id: 'p1', name: 'Ada', role: 'Maid', group: 'Her people', bio: 'Best friend' },
          ],
        },
        {
          type: 'RSVP',
          enabled: true,
          sortOrder: 3,
          rsvpOpen: false,
          allowMaybe: false,
          deadline: '2026-12-01',
        },
        {
          type: 'PHOTOS',
          enabled: true,
          sortOrder: 4,
          photosStyle: 'slider',
          photosSize: 'large',
        },
      ],
    })
    expect(await validate(ok, PIPE)).toEqual([])
    const badPhotos = plainToInstance(PatchSiteDto, {
      sections: [{ type: 'PHOTOS', enabled: true, sortOrder: 4, photosStyle: 'masonry' }],
    })
    expect(await validate(badPhotos, PIPE)).not.toEqual([])
    const withImage = plainToInstance(PatchSiteDto, {
      sections: [{ type: 'ABOUT', enabled: true, sortOrder: 1, image: { id: 'x', url: '/u' } }],
    })
    expect(await validate(withImage, PIPE)).not.toEqual([])
  })

  it('rejects oversized RSVP extras that the guest form cannot send', async () => {
    const ok = plainToInstance(SiteRsvpDto, {
      eventId: 'e1',
      status: 'ATTENDING',
      plusOneName: 'Ada',
      dietaryNote: 'Vegan',
    })
    expect(await validate(ok, PIPE)).toEqual([])
    const huge = plainToInstance(SiteRsvpDto, {
      eventId: 'e1',
      status: 'ATTENDING',
      plusOneName: 'A'.repeat(81),
    })
    expect(await validate(huge, PIPE)).not.toEqual([])
  })

  it('accepts custom title and body sections', async () => {
    const ok = plainToInstance(PatchSiteDto, {
      sections: [
        { type: 'COVER', enabled: true, sortOrder: 0 },
        {
          type: 'CUSTOM',
          enabled: true,
          sortOrder: 1,
          layout: 'vertical',
          title: 'Our weekend',
          body: 'Welcome drinks Friday.',
        },
        {
          id: 'clxcustom001',
          type: 'CUSTOM',
          enabled: true,
          sortOrder: 2,
          title: 'Parking',
          body: 'Use the north lot.',
        },
      ],
    })
    expect(await validate(ok, PIPE)).toEqual([])
  })
})

describe('custom section payload', () => {
  it('strips tags and empty titles', () => {
    expect(sanitizeSectionTitle('  Our weekend  ')).toBe('Our weekend')
    expect(sanitizeSectionTitle('<b>Parking</b>')).toBe('Parking')
    expect(sanitizeSectionTitle('   ')).toBe('Section')
  })

  it('keeps story markup and drops scripts', () => {
    expect(sanitizeRichText('<p>We met in <strong>Lagos</strong>.</p>', 8000)).toBe(
      '<p>We met in <strong>Lagos</strong>.</p>',
    )
    expect(
      sanitizeRichText(
        '<p>Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
        8000,
      ),
    ).toBe('<p>Hi</p><a>x</a>')
    expect(sanitizeRichText('Plain story with line breaks', 8000)).toBe(
      'Plain story with line breaks',
    )
    expect(sanitizeRichText('<p>Hi</p><img src="https://evil.test/x.jpg" alt="x">', 8000)).toBe(
      '<p>Hi</p>',
    )
    expect(sanitizeRichText('<scr<script>ipt>alert(1)</script>', 8000)).not.toMatch(/script/i)
    expect(sanitizeRichText('<p>ok\u0000<script>x</script></p>', 8000)).toBe('<p>ok</p>')
  })

  it('sanitizes party rows and RSVP rules', () => {
    const people = sanitizePeople([
      { name: '<b>Ada</b>', role: 'Maid', group: 'Her people', bio: 'Best friend' },
    ])
    expect(people[0].name).toBe('Ada')
    expect(people[0].id).toBe('p1')
    expect(pickScheduleStyle('timeline')).toBe('timeline')
    expect(pickScheduleStyle('weird')).toBe('list')
    expect(pickPhotosStyle('slider')).toBe('slider')
    expect(pickPhotosStyle('masonry')).toBe('grid')
    expect(pickPhotosSize('large')).toBe('large')
    expect(pickPhotosSize('huge')).toBe('medium')
    expect(pickNavStyle('pill')).toBe('pill')
    expect(pickNavStyle('fancy')).toBe('line')
    expect(pickNavAlign('before')).toBe('before')
    expect(pickNavAlign('below')).toBe('below')
    expect(pickNavAlign('center')).toBe('above')
    expect(pickNavAlign('middle')).toBe('above')
    expect(pickCoverPhotoSide('right')).toBe('right')
    expect(pickCoverPhotoSide('left')).toBe('left')
    expect(pickCoverPhotoSide('center')).toBe('left')
    expect(pickNavBorder('off')).toBe('off')
    expect(pickNavBorder('maybe')).toBe('on')
    expect(pickNavBorderWidth('thick')).toBe('thick')
    expect(pickNavBorderWidth('huge')).toBe('thin')
    expect(pickNavBorderStyle('dotted')).toBe('dotted')
    expect(pickNavBorderStyle('wavy')).toBe('solid')
    expect(rsvpConfigError(parseRsvpOptions({ rsvpOpen: false }), 'ATTENDING')).toBe(
      'RSVP is closed',
    )
    expect(rsvpConfigError(parseRsvpOptions({ allowMaybe: false }), 'MAYBE')).toBe(
      'Maybe is not available',
    )
    expect(rsvpConfigError(parseRsvpOptions({ deadline: '2020-01-01' }), 'ATTENDING')).toBe(
      'RSVP is closed',
    )
    expect(rsvpDoorError(undefined, 'ATTENDING')).toBe('RSVP is closed')
    expect(rsvpDoorError({ enabled: false, payload: { rsvpOpen: true } }, 'ATTENDING')).toBe(
      'RSVP is closed',
    )
    expect(rsvpDoorError({ enabled: true, payload: { rsvpOpen: true } }, 'ATTENDING')).toBeNull()
    expect(sanitizeGifts([{ label: 'Registry', url: 'javascript:alert(1)' }])[0].url).toBe('')
    expect(sanitizeGifts([{ label: '<b>Zola</b>', url: 'https://zola.com/x' }])[0]).toEqual({
      label: 'Zola',
      url: 'https://zola.com/x',
    })
    expect(sanitizeFaq([{ question: '<em>Q</em>', answer: '<b>A</b>' }])[0]).toEqual({
      question: 'Q',
      answer: 'A',
    })
    expect(
      sanitizeRsvpExtras({ plusOneName: '<b>Ada</b>', dietaryNote: 'Vegan' }).plusOneName,
    ).toBe('Ada')
    expect(canHaveSectionHero('ABOUT')).toBe(true)
    expect(canHaveSectionHero('PEOPLE')).toBe(false)
  })

  it('caps custom count and duplicate built-ins', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ type: 'CUSTOM', id: `c${i}` }))
    expect(sectionListError(many)).toBe('You can add up to 10 custom sections')
    expect(sectionListError([{ type: 'ABOUT' }, { type: 'ABOUT' }])).toBe(
      'Each built-in section can only appear once',
    )
    expect(
      sectionListError([
        { type: 'CUSTOM', id: 'a' },
        { type: 'CUSTOM', id: 'a' },
      ]),
    ).toBe('Custom sections must be unique')
    expect(
      sectionListError([{ type: 'COVER' }, { type: 'CUSTOM', id: 'a' }, { type: 'CUSTOM' }]),
    ).toBeNull()
  })
})

describe('custom hex colors', () => {
  it('normalizes 3-digit hex', () => {
    expect(normalizeHex('#abc')).toBe('#aabbcc')
    expect(normalizeHex('  #FFF  ')).toBe('#ffffff')
    expect(normalizeHex('red')).toBeNull()
    expect(normalizeHex('#gggggg')).toBeNull()
  })

  it('parses a complete custom palette', () => {
    expect(
      parseCustomColors({ bg: '#fff', fg: '#111111', accent: '#8A6A2F', extra: 'nope' }),
    ).toEqual({
      bg: '#ffffff',
      fg: '#111111',
      accent: '#8a6a2f',
    })
    expect(parseCustomColors({ bg: '#fff' })).toBeNull()
  })
})

describe('event site session (FR-33, FR-34)', () => {
  const secret = 'x'.repeat(32)

  it('round-trips a signed payload', () => {
    const token = signSiteSession(
      { siteId: 's1', guestIds: ['g1'], exp: Date.now() + 60_000 },
      secret,
    )
    const read = readSiteSession(token, secret)
    expect(read?.siteId).toBe('s1')
    expect(read?.guestIds).toEqual(['g1'])
  })

  it('rejects expired and tampered tokens', () => {
    const expired = signSiteSession({ siteId: 's1', guestIds: [], exp: Date.now() - 1 }, secret)
    expect(readSiteSession(expired, secret)).toBeNull()
    const token = signSiteSession({ siteId: 's1', guestIds: [], exp: Date.now() + 60_000 }, secret)
    expect(readSiteSession(token.slice(0, -2) + 'ab', secret)).toBeNull()
    expect(readSiteSession(undefined, secret)).toBeNull()
  })
})

describe('requireSite (FR-6, FR-8)', () => {
  const event = { id: 'e1', userId: 'u1', deletedAt: null }

  function svc(access: object) {
    const prisma = {}
    const service = new EventAccessService(prisma as never)
    jest.spyOn(service, 'load').mockResolvedValue(access as never)
    return service
  }

  it('allows the host', async () => {
    const access = {
      isHost: true,
      role: 'HOST',
      surfaces: [],
      user: { id: 'u1' },
      event,
    }
    await expect(svc(access).requireSite('clerk', 'e1')).resolves.toMatchObject({ isHost: true })
  })

  it('allows an editor with SITE', async () => {
    const access = {
      isHost: false,
      role: EventMemberRole.EDITOR,
      surfaces: [EventSurface.SITE],
      user: { id: 'u2' },
      event,
    }
    await expect(svc(access).requireSite('clerk', 'e1')).resolves.toMatchObject({
      role: EventMemberRole.EDITOR,
    })
  })

  it('404s a planning surface the member cannot see', async () => {
    const access = {
      isHost: false,
      role: EventMemberRole.EDITOR,
      surfaces: [EventSurface.SCHEDULE],
      user: { id: 'u2' },
      event,
    }
    await expect(
      svc(access).require('clerk', 'e1', { surface: EventSurface.GUESTS }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('404s an editor without SITE', async () => {
    const access = {
      isHost: false,
      role: EventMemberRole.EDITOR,
      surfaces: [EventSurface.GUESTS],
      user: { id: 'u2' },
      event,
    }
    await expect(svc(access).requireSite('clerk', 'e1')).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('site visibility (AC-11, AC-12)', () => {
  const parent = {
    eventId: 'parent',
    accessMode: EventSiteAccessMode.INVITED_ONLY,
    hasOwnGuestList: true,
  }
  const reception = {
    eventId: 'reception',
    accessMode: EventSiteAccessMode.OPEN,
    hasOwnGuestList: true,
  }
  const naming = {
    eventId: 'naming',
    accessMode: EventSiteAccessMode.INVITED_ONLY,
    hasOwnGuestList: true,
  }
  const contentOnly = {
    eventId: 'brunch',
    accessMode: EventSiteAccessMode.INVITED_ONLY,
    hasOwnGuestList: false,
  }

  it('empty identity sees only OPEN events', () => {
    const empty = new Set<string>()
    expect(canSeeEventOnSite(reception, 'parent', empty)).toBe(true)
    expect(canSeeEventOnSite(naming, 'parent', empty)).toBe(false)
    expect(canSeeEventOnSite(parent, 'parent', empty)).toBe(false)
    expect(publicRobots([reception])).toBe('index')
    expect(publicRobots([parent, naming])).toBe('noindex')
  })

  it('child-only guest unlocks that child, not other invited-only events', () => {
    const guests = new Set(['naming'])
    expect(canSeeEventOnSite(naming, 'parent', guests)).toBe(true)
    expect(canSeeEventOnSite(parent, 'parent', guests)).toBe(false)
    expect(canSeeEventOnSite(reception, 'parent', guests)).toBe(true)
  })

  it('content-only child follows the parent guest list', () => {
    expect(canSeeEventOnSite(contentOnly, 'parent', new Set(['parent']))).toBe(true)
    expect(canSeeEventOnSite(contentOnly, 'parent', new Set(['naming']))).toBe(false)
  })

  it('keeps owner cover facts when the site is invited-only and locked', () => {
    const sealed = publicOwnerFallback(
      {
        title: 'Secret wedding',
        eventType: 'WEDDING',
        estimatedDate: '2026-09-01',
        location: 'Lagos',
      },
      EventSiteAccessMode.INVITED_ONLY,
      false,
      { showEventType: true, showEventTitle: true },
    )
    expect(sealed.eventId).toBe('')
    expect(sealed.title).toBe('Secret wedding')
    expect(sealed.location).toBeNull()
    expect(sealed.estimatedDate).toBeNull()
    expect(sealed.schedule).toEqual([])
    expect(sealed.canRsvp).toBe(false)
  })

  it('uses owner cover fields when an OPEN child is visible, without the owner id', () => {
    const cover = publicOwnerFallback(
      {
        title: 'Amaka & Kemi',
        eventType: 'WEDDING',
        estimatedDate: '2026-09-01',
        location: 'Lagos',
      },
      EventSiteAccessMode.INVITED_ONLY,
      true,
      { showEventType: true, showEventTitle: true },
    )
    expect(cover.eventId).toBe('')
    expect(cover.title).toBe('Amaka & Kemi')
    expect(cover.schedule).toEqual([])
    expect(cover.canRsvp).toBe(false)
  })

  it('omits hidden cover lines, schedule times, and disabled sections from guest data', () => {
    expect(
      redactCoverIdentity(
        { title: 'Amaka & Kemi', eventType: 'WEDDING' },
        { showEventType: false, showEventTitle: false },
      ),
    ).toEqual({ title: '', eventType: '' })
    const hidden = publicOwnerFallback(
      {
        title: 'Amaka & Kemi',
        eventType: 'WEDDING',
        estimatedDate: '2026-09-01',
        location: 'Lagos',
      },
      EventSiteAccessMode.INVITED_ONLY,
      false,
      { showEventType: false, showEventTitle: false },
    )
    expect(hidden.title).toBe('')
    expect(hidden.eventType).toBe('')
    expect(hidden.location).toBeNull()
    expect(hidden.estimatedDate).toBeNull()
    const timed = redactPublicSchedule(
      [
        {
          startTime: '14:00',
          endTime: '15:00',
          location: 'Lagos',
        },
      ],
      { showTimes: false, showItemDirections: false },
    )[0]
    expect(timed.startTime).toBeNull()
    expect(timed.endTime).toBeNull()
    expect(timed.directionsUrl).toBeNull()
    expect(sectionIsOn([{ type: 'PHOTOS', enabled: false }], 'PHOTOS')).toBe(false)
    expect(
      redactSiteRsvp(
        {
          plusOneName: 'Ada',
          dietaryNote: 'Vegan',
          guestMessage: 'Hi',
          guest: { plusOneAllowed: true },
        },
        parseRsvpOptions({ collectPlusOne: false, collectDietary: false, collectMessage: false }),
      ),
    ).toEqual({
      plusOneName: null,
      dietaryNote: null,
      guestMessage: null,
      guest: { plusOneAllowed: false },
    })
  })

  it('treats expired invites as inactive', () => {
    expect(inviteIsActive(null)).toBe(true)
    expect(inviteIsActive(new Date(Date.now() + 60_000))).toBe(true)
    expect(inviteIsActive(new Date(Date.now() - 60_000))).toBe(false)
  })
})

describe('EventSitesService mutations (AC-2, AC-10)', () => {
  it('409s a second site on the same event', async () => {
    const service = new EventSitesService(
      { eventSite: { findUnique: jest.fn().mockResolvedValue({ id: 's1' }) } } as never,
      {
        requireSite: jest.fn().mockResolvedValue({ event: { id: 'e1', parentId: null } }),
      } as never,
      {} as never,
      { get: jest.fn() } as never,
    )
    await expect(service.create('clerk', 'e1', { slug: 'amaka-kemi' })).rejects.toBeInstanceOf(
      ConflictException,
    )
  })

  it('400s when the slug is already taken', async () => {
    const service = new EventSitesService(
      {
        eventSite: {
          findUnique: jest.fn((args: { where: { eventId?: string; slug?: string } }) => {
            if (args.where.slug) return Promise.resolve({ id: 'other', slug: args.where.slug })
            return Promise.resolve(null)
          }),
        },
      } as never,
      {
        requireSite: jest.fn().mockResolvedValue({ event: { id: 'e1', parentId: null } }),
      } as never,
      {} as never,
      { get: jest.fn() } as never,
    )
    await expect(service.create('clerk', 'e1', { slug: 'Amaka and Kemi' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('400s a 25th gallery photo', async () => {
    const photos = Array.from({ length: 24 }, (_, i) => ({ id: String(i) }))
    const service = new EventSitesService(
      {} as never,
      { requireSite: jest.fn().mockResolvedValue({}) } as never,
      {} as never,
      { get: jest.fn() } as never,
    )
    jest.spyOn(service as never, 'mustSiteByEvent').mockResolvedValue({ photos } as never)
    await expect(service.uploadPhoto('clerk', 'e1', 'x.jpg')).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('400s a hero on Wedding Party and a 21st section image', async () => {
    const service = new EventSitesService(
      {} as never,
      { requireSite: jest.fn().mockResolvedValue({}) } as never,
      {} as never,
      { get: jest.fn() } as never,
    )
    jest.spyOn(service as never, 'mustSiteByEvent').mockResolvedValue({
      sections: [{ id: 'ppl', type: 'PEOPLE' }],
      photos: [],
    } as never)
    await expect(service.uploadSectionPhoto('clerk', 'e1', 'ppl', 'x.jpg')).rejects.toBeInstanceOf(
      BadRequestException,
    )

    const heroes = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      sectionId: `s${i}`,
      personId: null,
    }))
    jest.spyOn(service as never, 'mustSiteByEvent').mockResolvedValue({
      sections: [{ id: 'about', type: 'ABOUT' }],
      photos: heroes,
    } as never)
    await expect(
      service.uploadSectionPhoto('clerk', 'e1', 'about', 'x.jpg'),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('400s a party photo for an unknown person', async () => {
    const service = new EventSitesService(
      { eventPartyMember: { findFirst: jest.fn().mockResolvedValue(null) } } as never,
      { requireSite: jest.fn().mockResolvedValue({}) } as never,
      {} as never,
      { get: jest.fn() } as never,
    )
    await expect(
      service.uploadPersonPhoto('clerk', 'e1', 'ppl', 'missing', 'x.jpg'),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
