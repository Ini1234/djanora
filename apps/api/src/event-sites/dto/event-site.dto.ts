import { applyDecorators } from '@nestjs/common'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { EventSiteSectionType } from '@prisma/client'
import {
  BUTTON_STYLES,
  COLOR_PALETTES,
  COVER_LAYOUTS,
  COVER_PHOTO_SIDES,
  FAQ_STYLES,
  FONT_PAIRS,
  GIFTS_STYLES,
  HEX_RE,
  MAP_MODES,
  MAX_DIETARY,
  MAX_EMAIL,
  MAX_GUEST_MESSAGE,
  MAX_PLUS_ONE,
  NAV_ALIGNS,
  NAV_BORDERS,
  NAV_BORDER_STYLES,
  NAV_BORDER_WIDTHS,
  NAV_PLACEMENTS,
  NAV_STYLES,
  PEOPLE_STYLES,
  PHOTO_SIZES,
  PHOTO_STYLES,
  SCHEDULE_STYLES,
  SECTION_LAYOUTS,
  THEME_PRESETS,
} from '../event-site.constants'

const ACCESS_MODES = ['OPEN', 'INVITED_ONLY'] as const

/** Freeform title. The API slugifies it and checks uniqueness. */
function SiteName() {
  return applyDecorators(
    IsString(),
    MinLength(1, { message: 'Enter a name' }),
    MaxLength(80, { message: 'Keep the name under 80 characters' }),
    Matches(/[\p{L}\p{N}]/u, { message: 'Use some letters or numbers in the name' }),
    Matches(/^[^/\\?#<>]+$/, { message: 'Remove / \\ ? # < > from the name' }),
  )
}

export class IncludedEventConfigDto {
  @IsString()
  eventId: string

  @IsIn([...ACCESS_MODES])
  accessMode: (typeof ACCESS_MODES)[number]

  @IsBoolean()
  hasOwnGuestList: boolean
}

export class SiteSectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id?: string

  @IsEnum(EventSiteSectionType)
  type: EventSiteSectionType

  @IsBoolean()
  enabled: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number

  @IsOptional()
  @IsIn([...SECTION_LAYOUTS])
  layout?: (typeof SECTION_LAYOUTS)[number]

  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  body?: string

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  about?: string

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  dressCode?: string

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  stay?: string

  @IsOptional()
  people?: { id?: string; name?: string; role?: string; group?: string; bio?: string }[]

  @IsOptional()
  faq?: { question: string; answer: string }[]

  @IsOptional()
  gifts?: { label: string; url: string }[]

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  travel?: string

  @IsOptional()
  @IsIn([...PEOPLE_STYLES])
  peopleStyle?: (typeof PEOPLE_STYLES)[number]

  @IsOptional()
  @IsIn([...SCHEDULE_STYLES])
  scheduleStyle?: (typeof SCHEDULE_STYLES)[number]

  @IsOptional()
  @IsBoolean()
  groupByDay?: boolean

  @IsOptional()
  @IsBoolean()
  showTimes?: boolean

  @IsOptional()
  @IsBoolean()
  showItemDirections?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string

  @IsOptional()
  @IsIn([...MAP_MODES])
  map?: (typeof MAP_MODES)[number]

  @IsOptional()
  @IsIn([...FAQ_STYLES])
  faqStyle?: (typeof FAQ_STYLES)[number]

  @IsOptional()
  @IsIn([...GIFTS_STYLES])
  giftsStyle?: (typeof GIFTS_STYLES)[number]

  @IsOptional()
  @IsIn([...PHOTO_STYLES])
  photosStyle?: (typeof PHOTO_STYLES)[number]

  @IsOptional()
  @IsIn([...PHOTO_SIZES])
  photosSize?: (typeof PHOTO_SIZES)[number]

  @IsOptional()
  @IsString()
  @MaxLength(500)
  intro?: string

  @IsOptional()
  @IsBoolean()
  rsvpOpen?: boolean

  @IsOptional()
  @IsBoolean()
  allowMaybe?: boolean

  @IsOptional()
  @IsBoolean()
  collectPlusOne?: boolean

  @IsOptional()
  @IsBoolean()
  collectDietary?: boolean

  @IsOptional()
  @IsBoolean()
  collectMessage?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(10)
  deadline?: string
}

export class SiteCustomColorsDto {
  @IsString()
  @Matches(HEX_RE, { message: 'Use a hex color like #1a1a1a' })
  bg: string

  @IsString()
  @Matches(HEX_RE, { message: 'Use a hex color like #1a1a1a' })
  fg: string

  @IsString()
  @Matches(HEX_RE, { message: 'Use a hex color like #1a1a1a' })
  accent: string

  @IsOptional()
  @IsString()
  @Matches(HEX_RE, { message: 'Use a hex color like #1a1a1a' })
  muted?: string

  @IsOptional()
  @IsString()
  @Matches(HEX_RE, { message: 'Use a hex color like #1a1a1a' })
  card?: string
}

export class CreateSiteDto {
  @SiteName()
  slug: string

  @IsOptional()
  @IsIn([...ACCESS_MODES])
  ownerAccessMode?: (typeof ACCESS_MODES)[number]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncludedEventConfigDto)
  included?: IncludedEventConfigDto[]
}

export class PatchSiteDto {
  @IsOptional()
  @SiteName()
  slug?: string

  @IsOptional()
  @IsIn([...ACCESS_MODES])
  ownerAccessMode?: (typeof ACCESS_MODES)[number]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncludedEventConfigDto)
  included?: IncludedEventConfigDto[]

  @IsOptional()
  @IsIn([...THEME_PRESETS])
  themePreset?: (typeof THEME_PRESETS)[number]

  @IsOptional()
  @IsIn([...FONT_PAIRS])
  fontPair?: (typeof FONT_PAIRS)[number]

  @IsOptional()
  @IsIn([...COLOR_PALETTES])
  colorPalette?: (typeof COLOR_PALETTES)[number]

  @IsOptional()
  @IsIn([...BUTTON_STYLES])
  buttonStyle?: (typeof BUTTON_STYLES)[number]

  @IsOptional()
  @IsIn([...COVER_LAYOUTS])
  coverLayout?: (typeof COVER_LAYOUTS)[number]

  @IsOptional()
  @IsIn([...COVER_PHOTO_SIDES])
  coverPhotoSide?: (typeof COVER_PHOTO_SIDES)[number]

  @IsOptional()
  @IsBoolean()
  showEventType?: boolean

  @IsOptional()
  @IsBoolean()
  showEventTitle?: boolean

  @IsOptional()
  @IsIn([...NAV_PLACEMENTS])
  navPlacement?: (typeof NAV_PLACEMENTS)[number]

  @IsOptional()
  @IsIn([...NAV_STYLES])
  navStyle?: (typeof NAV_STYLES)[number]

  @IsOptional()
  @IsIn([...NAV_ALIGNS])
  navAlign?: (typeof NAV_ALIGNS)[number]

  @IsOptional()
  @IsString()
  @MaxLength(80)
  navName?: string

  @IsOptional()
  @IsIn([...NAV_BORDERS])
  navBorder?: (typeof NAV_BORDERS)[number]

  @IsOptional()
  @IsIn([...NAV_BORDER_WIDTHS])
  navBorderWidth?: (typeof NAV_BORDER_WIDTHS)[number]

  @IsOptional()
  @IsIn([...NAV_BORDER_STYLES])
  navBorderStyle?: (typeof NAV_BORDER_STYLES)[number]

  @IsOptional()
  @ValidateNested()
  @Type(() => SiteCustomColorsDto)
  customColors?: SiteCustomColorsDto

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SiteSectionDto)
  sections?: SiteSectionDto[]
}

export class SiteSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EMAIL)
  email?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  inviteeId?: string
}

export class SiteRsvpDto {
  @IsString()
  eventId: string

  @IsOptional()
  @IsString()
  @MaxLength(MAX_EMAIL)
  email?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  inviteeId?: string

  @IsEnum(['ATTENDING', 'DECLINED', 'MAYBE'])
  status: 'ATTENDING' | 'DECLINED' | 'MAYBE'

  @IsOptional()
  @IsString()
  @MaxLength(MAX_PLUS_ONE)
  plusOneName?: string

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DIETARY)
  dietaryNote?: string

  @IsOptional()
  @IsString()
  @MaxLength(MAX_GUEST_MESSAGE)
  guestMessage?: string
}
