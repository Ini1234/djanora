import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { VendorsService } from './vendors.service'
import { VendorPostsService } from './vendor-posts.service'
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard'
import { BlobStorageService, makeUploadName } from '../uploads/blob-storage.service'
import { CreateVendorProfileDto } from './dto/create-vendor-profile.dto'
import { CreateReviewDto } from './dto/create-review.dto'
import {
  AddExternalMediaDto,
  CreateVendorPostDto,
  UpdateVendorMeDto,
  UpdateVendorPostDto,
} from './dto/vendor-post.dto'

const imageUpload = FileInterceptor('file', {
  storage: memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new BadRequestException('Only JPEG, PNG, WebP, and GIF images are allowed'), false)
  },
  limits: { fileSize: 10 * 1024 * 1024 },
})

function uploadedUrl(filename: string) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  return `${apiBase}/uploads/${filename}`
}

@Controller('vendors')
export class VendorsController {
  constructor(
    private readonly vendorsService: VendorsService,
    private readonly posts: VendorPostsService,
    private readonly storage: BlobStorageService,
  ) {}

  @Get()
  findAll(@Query('category') category?: string) {
    return this.vendorsService.findAll(category)
  }

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  getMyProfile(@Request() req: { userId: string }) {
    return this.vendorsService.getMyProfile(req.userId)
  }

  @Patch('me')
  @UseGuards(ClerkAuthGuard)
  updateMe(@Request() req: { userId: string }, @Body() dto: UpdateVendorMeDto) {
    return this.vendorsService.updateMe(req.userId, dto)
  }

  @Post('profile')
  @UseGuards(ClerkAuthGuard)
  createProfile(@Request() req: { userId: string }, @Body() dto: CreateVendorProfileDto) {
    return this.vendorsService.createProfile(req.userId, dto)
  }

  @Get('me/posts')
  @UseGuards(ClerkAuthGuard)
  listMyPosts(@Request() req: { userId: string }) {
    return this.posts.listMine(req.userId)
  }

  @Post('me/posts')
  @UseGuards(ClerkAuthGuard)
  createPost(@Request() req: { userId: string }, @Body() dto: CreateVendorPostDto) {
    return this.posts.create(req.userId, dto)
  }

  @Patch('me/posts/:id')
  @UseGuards(ClerkAuthGuard)
  updatePost(
    @Request() req: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateVendorPostDto,
  ) {
    return this.posts.update(req.userId, id, dto)
  }

  @Delete('me/posts/:id')
  @UseGuards(ClerkAuthGuard)
  deletePost(@Request() req: { userId: string }, @Param('id') id: string) {
    return this.posts.remove(req.userId, id)
  }

  @Post('me/posts/:id/media')
  @UseGuards(ClerkAuthGuard)
  @UseInterceptors(imageUpload)
  async addPostImage(
    @Request() req: { userId: string },
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded')
    const filename = makeUploadName(file.originalname, 'post-')
    await this.storage.upload('images', filename, file.buffer, file.mimetype)
    return this.posts.addImage(req.userId, id, uploadedUrl(filename))
  }

  @Post('me/posts/:id/media/link')
  @UseGuards(ClerkAuthGuard)
  addPostLink(
    @Request() req: { userId: string },
    @Param('id') id: string,
    @Body() dto: AddExternalMediaDto,
  ) {
    return this.posts.addExternal(req.userId, id, dto.url)
  }

  @Patch('me/posts/:id/media/:mediaId')
  @UseGuards(ClerkAuthGuard)
  setCover(
    @Request() req: { userId: string },
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.posts.setCover(req.userId, id, mediaId)
  }

  @Delete('me/posts/:id/media/:mediaId')
  @UseGuards(ClerkAuthGuard)
  removeMedia(
    @Request() req: { userId: string },
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.posts.removeMedia(req.userId, id, mediaId)
  }

  @Get('favorites')
  @UseGuards(ClerkAuthGuard)
  getFavorites(@Request() req: { userId: string }) {
    return this.vendorsService.getFavorites(req.userId)
  }

  @Get(':slug/favorite-status')
  @UseGuards(ClerkAuthGuard)
  favoriteStatus(@Param('slug') slug: string, @Request() req: { userId: string }) {
    return this.vendorsService.favoriteStatus(req.userId, slug)
  }

  @Post(':slug/favorite')
  @UseGuards(ClerkAuthGuard)
  favorite(@Param('slug') slug: string, @Request() req: { userId: string }) {
    return this.vendorsService.favorite(req.userId, slug)
  }

  @Delete(':slug/favorite')
  @UseGuards(ClerkAuthGuard)
  unfavorite(@Param('slug') slug: string, @Request() req: { userId: string }) {
    return this.vendorsService.unfavorite(req.userId, slug)
  }

  @Get(':slug/review-status')
  @UseGuards(ClerkAuthGuard)
  reviewStatus(@Param('slug') slug: string, @Request() req: { userId: string }) {
    return this.vendorsService.reviewStatus(req.userId, slug)
  }

  @Post(':slug/view')
  @UseGuards(ClerkAuthGuard)
  recordView(@Param('slug') slug: string, @Request() req: { userId: string }) {
    return this.vendorsService.recordView(slug, req.userId)
  }

  @Post(':slug/reviews')
  @UseGuards(ClerkAuthGuard)
  createReview(
    @Param('slug') slug: string,
    @Request() req: { userId: string },
    @Body() dto: CreateReviewDto,
  ) {
    return this.vendorsService.createReview(req.userId, slug, dto)
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.vendorsService.findBySlug(slug)
  }
}
