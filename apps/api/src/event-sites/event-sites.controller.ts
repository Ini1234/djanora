import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { BlobStorageService, makeUploadName } from '../uploads/blob-storage.service'
import { EventSitesService } from './event-sites.service'
import { CreateSiteDto, PatchSiteDto } from './dto/event-site.dto'
import { MAX_PHOTO_BYTES } from './event-site.constants'

type ClerkPayload = { sub: string }

const imageUpload = FileInterceptor('file', {
  storage: memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true)
    else cb(new BadRequestException('Only jpeg, png, and webp are allowed'), false)
  },
  limits: { fileSize: MAX_PHOTO_BYTES },
})

@Controller('events/:eventId/site')
@UseGuards(ClerkAuthGuard)
export class EventSitesController {
  constructor(
    private readonly sites: EventSitesService,
    private readonly storage: BlobStorageService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: ClerkPayload,
    @Param('eventId') eventId: string,
    @Body() dto: CreateSiteDto,
  ) {
    return this.sites.create(user.sub, eventId, dto)
  }

  @Get()
  get(@CurrentUser() user: ClerkPayload, @Param('eventId') eventId: string) {
    return this.sites.getEditor(user.sub, eventId)
  }

  @Patch()
  patch(
    @CurrentUser() user: ClerkPayload,
    @Param('eventId') eventId: string,
    @Body() dto: PatchSiteDto,
  ) {
    return this.sites.patch(user.sub, eventId, dto)
  }

  @Post('publish')
  publish(@CurrentUser() user: ClerkPayload, @Param('eventId') eventId: string) {
    return this.sites.publish(user.sub, eventId)
  }

  @Post('unpublish')
  unpublish(@CurrentUser() user: ClerkPayload, @Param('eventId') eventId: string) {
    return this.sites.unpublish(user.sub, eventId)
  }

  @Delete()
  remove(@CurrentUser() user: ClerkPayload, @Param('eventId') eventId: string) {
    return this.sites.remove(user.sub, eventId)
  }

  @Post('cover')
  @UseInterceptors(imageUpload)
  async cover(
    @CurrentUser() user: ClerkPayload,
    @Param('eventId') eventId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded')
    const storedName = makeUploadName(file.originalname)
    await this.storage.upload('images', storedName, file.buffer, file.mimetype)
    return this.sites.uploadCover(user.sub, eventId, storedName)
  }

  @Post('photos')
  @UseInterceptors(imageUpload)
  async photos(
    @CurrentUser() user: ClerkPayload,
    @Param('eventId') eventId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded')
    const storedName = makeUploadName(file.originalname)
    await this.storage.upload('images', storedName, file.buffer, file.mimetype)
    return this.sites.uploadPhoto(user.sub, eventId, storedName)
  }

  @Delete('photos/:photoId')
  deletePhoto(
    @CurrentUser() user: ClerkPayload,
    @Param('eventId') eventId: string,
    @Param('photoId') photoId: string,
  ) {
    return this.sites.deletePhoto(user.sub, eventId, photoId)
  }

  @Post('sections/:sectionId/photo')
  @UseInterceptors(imageUpload)
  async sectionPhoto(
    @CurrentUser() user: ClerkPayload,
    @Param('eventId') eventId: string,
    @Param('sectionId') sectionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { alt?: string },
  ) {
    if (!file) throw new BadRequestException('No file uploaded')
    const storedName = makeUploadName(file.originalname)
    await this.storage.upload('images', storedName, file.buffer, file.mimetype)
    return this.sites.uploadSectionPhoto(user.sub, eventId, sectionId, storedName, body.alt ?? '')
  }

  @Delete('sections/:sectionId/photo')
  deleteSectionPhoto(
    @CurrentUser() user: ClerkPayload,
    @Param('eventId') eventId: string,
    @Param('sectionId') sectionId: string,
  ) {
    return this.sites.deleteSectionPhoto(user.sub, eventId, sectionId)
  }

  @Post('sections/:sectionId/people/:personId/photo')
  @UseInterceptors(imageUpload)
  async personPhoto(
    @CurrentUser() user: ClerkPayload,
    @Param('eventId') eventId: string,
    @Param('sectionId') sectionId: string,
    @Param('personId') personId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { alt?: string },
  ) {
    if (!file) throw new BadRequestException('No file uploaded')
    const storedName = makeUploadName(file.originalname)
    await this.storage.upload('images', storedName, file.buffer, file.mimetype)
    return this.sites.uploadPersonPhoto(
      user.sub,
      eventId,
      sectionId,
      personId,
      storedName,
      body.alt ?? '',
    )
  }

  @Delete('sections/:sectionId/people/:personId/photo')
  deletePersonPhoto(
    @CurrentUser() user: ClerkPayload,
    @Param('eventId') eventId: string,
    @Param('sectionId') sectionId: string,
    @Param('personId') personId: string,
  ) {
    return this.sites.deletePersonPhoto(user.sub, eventId, sectionId, personId)
  }
}
