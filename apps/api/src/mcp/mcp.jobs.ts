import { Injectable } from '@nestjs/common'
import {
  EventCommentSubject,
  EventMemberRole,
  EventPartySide,
  EventPartyStatus,
  EventSurface,
  EventType,
  Tribe,
  VendorCategory,
  WeddingTheme,
} from '@prisma/client'
import { EventAccessService } from '../events/event-access.service'
import { EventActivityService } from '../events/event-activity.service'
import { EventCommentsService } from '../events/event-comments.service'
import { EventMembersService } from '../events/event-members.service'
import { EventPartyService } from '../events/event-party.service'
import { EventsService } from '../events/events.service'
import { EventSitesService } from '../event-sites/event-sites.service'
import type { CreateSiteDto, PatchSiteDto } from '../event-sites/dto/event-site.dto'
import { GuestsService } from '../guests/guests.service'
import type { BulkSendInviteDto, CreateGuestDto, SendInviteDto } from '../guests/dto/guests.dto'
import { InquiriesService } from '../inquiries/inquiries.service'
import type { PostInquiryMessageDto } from '../inquiries/dto/post-inquiry-message.dto'
import { InspirationService } from '../inspiration/inspiration.service'
import { NotificationsService } from '../notifications/notifications.service'
import { BlobStorageService, makeUploadName } from '../uploads/blob-storage.service'
import { UsersService } from '../users/users.service'
import { VendorContactsService } from '../vendor-contacts/vendor-contacts.service'
import { VendorPostsService } from '../vendors/vendor-posts.service'
import { VendorsService } from '../vendors/vendors.service'
import { McpConfirmService } from './mcp.confirm.service'
import type { McpCtx } from './mcp.context'
import { mcpError } from './mcp.errors'
import { decodeUpload } from './mcp.files'
import { McpRateLimitService } from './mcp.rate-limit'
import { McpScopeService } from './mcp.scope'
import { McpSessionService } from './mcp.session.service'

type Args = Record<string, unknown>

const GATED = new Set([
  'delete_event',
  'publish_site',
  'unpublish_site',
  'delete_site',
  'invite_guest',
  'bulk_invite_guests',
  'inquire_vendor',
  'accept_quote',
  'reject_quote',
  'book_vendor',
  'invite_member',
  'update_member',
  'remove_member',
  'leave_event',
])

@Injectable()
export class McpJobsService {
  constructor(
    private users: UsersService,
    private events: EventsService,
    private access: EventAccessService,
    private party: EventPartyService,
    private members: EventMembersService,
    private comments: EventCommentsService,
    private activity: EventActivityService,
    private guests: GuestsService,
    private sites: EventSitesService,
    private inquiries: InquiriesService,
    private inspiration: InspirationService,
    private notifications: NotificationsService,
    private vendors: VendorsService,
    private vendorPosts: VendorPostsService,
    private vendorContacts: VendorContactsService,
    private storage: BlobStorageService,
    private scope: McpScopeService,
    private sessions: McpSessionService,
    private confirm: McpConfirmService,
    private rate: McpRateLimitService,
  ) {}

  private gated(name: string) {
    return GATED.has(name)
  }

  async run(ctx: McpCtx, tool: string, args: Args) {
    this.rate.hit(ctx.clerkId, this.gated(tool))
    await this.sessions.touch(ctx.sessionId, ctx.clerkId)
    return this.dispatch(ctx, tool, args)
  }

  private async eventId(ctx: McpCtx, args: Args) {
    return this.scope.resolve(ctx.sessionId, ctx.clerkId, {
      event_id: str(args.event_id),
      event_title: str(args.event_title),
    })
  }

  private async needConfirm(ctx: McpCtx, tool: string, args: Args, summary: string, blast: string) {
    if (str(args.confirm_token)) {
      await this.confirm.spend(ctx.sessionId, ctx.clerkId, tool, args)
      return null
    }
    return this.confirm.preview(ctx.sessionId, ctx.clerkId, tool, args, summary, blast)
  }

  private async dispatch(ctx: McpCtx, tool: string, args: Args): Promise<unknown> {
    switch (tool) {
      case 'who_am_i':
        return this.whoAmI(ctx)
      case 'set_active_mode':
        return this.users.setMode(ctx.clerkId, modeArg(args.mode))
      case 'update_me':
        return this.users.updateMe(ctx.clerkId, {
          firstName: str(args.first_name),
          lastName: str(args.last_name),
          phone: str(args.phone),
          city: str(args.city),
        })
      case 'complete_onboarding':
        return this.users.completeOnboarding(ctx.clerkId, {
          firstName: str(args.first_name),
          lastName: str(args.last_name),
          role: args.role === 'VENDOR' ? 'VENDOR' : 'USER',
          tribes: arr(args.tribes),
          city: str(args.city),
          countryOfOrigin: str(args.country_of_origin),
          dateOfBirth: str(args.date_of_birth),
        })
      case 'list_events':
        return page(await this.scope.listRefs(ctx.clerkId), args)
      case 'get_event':
        return this.events.findById(ctx.clerkId, await this.eventId(ctx, args))
      case 'set_current_event': {
        const id = await this.eventId(ctx, args)
        const refs = await this.scope.listRefs(ctx.clerkId)
        return { currentEvent: refs.find((e) => e.id === id) ?? { id } }
      }
      case 'clear_current_event':
        await this.sessions.setCurrentEvent(ctx.sessionId, ctx.clerkId, null)
        return { currentEvent: null }
      case 'create_event':
        return this.events.create(ctx.clerkId, {
          title: req(args.title, 'title'),
          eventType: (args.event_type as EventType) ?? EventType.RECEPTION,
          tribes: (arr(args.tribes) as Tribe[]) ?? [],
          themes: (arr(args.themes) as WeddingTheme[]) ?? [],
          totalBudget: num(args.total_budget) ?? 0,
          includeDefaultBudget: bool(args.include_default_budget),
          includeDefaultChecklist: bool(args.include_default_checklist),
          estimatedDate: str(args.estimated_date),
          guestCount: num(args.guest_count),
          location: str(args.location),
        })
      case 'update_event':
        return this.events.updateEvent(ctx.clerkId, await this.eventId(ctx, args), {
          title: str(args.title),
          estimatedDate: str(args.estimated_date),
          location: str(args.location),
          notes: str(args.notes),
          totalBudget: num(args.total_budget),
          guestCount: num(args.guest_count),
          isCompleted: bool(args.is_completed),
          partyEnabled: bool(args.party_enabled),
        } as never)
      case 'delete_event': {
        const id = await this.eventId(ctx, args)
        const preview = await this.needConfirm(
          ctx,
          tool,
          args,
          `Delete event ${id} and its planning data`,
          'The event, guests, site, and nested records are soft-deleted. This cannot be undone from chat.',
        )
        if (preview) return preview
        return this.events.softDelete(ctx.clerkId, id)
      }
      case 'add_child_event':
        return this.events.addChild(ctx.clerkId, await this.eventId(ctx, args), {
          title: req(args.title, 'title'),
          eventType: args.event_type as EventType,
        } as never)
      case 'attach_child_event':
        return this.events.attachChild(ctx.clerkId, await this.eventId(ctx, args), {
          childId: req(args.child_id, 'child_id'),
        } as never)
      case 'detach_child_event':
        return this.events.detachChild(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.child_id, 'child_id'),
        )
      case 'reorder_children':
        return this.events.reorderChildren(ctx.clerkId, await this.eventId(ctx, args), {
          childIds: arr(args.child_ids) ?? [],
        } as never)
      case 'list_checklist':
        return this.events.listChecklist(ctx.clerkId, await this.eventId(ctx, args))
      case 'add_checklist_item':
        return this.events.addChecklistItem(ctx.clerkId, await this.eventId(ctx, args), {
          title: req(args.title, 'title'),
          description: str(args.description),
          dueDate: str(args.due_date),
        })
      case 'update_checklist_item':
        return this.events.updateChecklistItem(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.item_id, 'item_id'),
          {
            title: str(args.title),
            description: str(args.description),
            isCompleted: bool(args.is_completed),
            dueDate: str(args.due_date),
          },
        )
      case 'delete_checklist_item':
        return this.events.deleteChecklistItem(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.item_id, 'item_id'),
        )
      case 'list_schedule':
        return this.events.listSchedule(ctx.clerkId, await this.eventId(ctx, args))
      case 'add_schedule_item':
        return this.events.addScheduleItem(ctx.clerkId, await this.eventId(ctx, args), {
          title: req(args.title, 'title'),
          notes: str(args.notes),
          date: str(args.date),
          startTime: str(args.start_time),
          endTime: str(args.end_time),
          location: str(args.location),
          showOnSite: bool(args.show_on_site),
        })
      case 'update_schedule_item':
        return this.events.updateScheduleItem(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.item_id, 'item_id'),
          {
            title: str(args.title),
            notes: str(args.notes),
            date: str(args.date),
            startTime: str(args.start_time),
            endTime: str(args.end_time),
            location: str(args.location),
            showOnSite: bool(args.show_on_site),
          },
        )
      case 'delete_schedule_item':
        return this.events.deleteScheduleItem(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.item_id, 'item_id'),
        )
      case 'list_party':
        return this.party.list(ctx.clerkId, await this.eventId(ctx, args))
      case 'add_party_member':
        return this.party.add(ctx.clerkId, await this.eventId(ctx, args), {
          name: req(args.name, 'name'),
          role: str(args.role),
          side: args.side as EventPartySide,
          group: str(args.group),
          bio: str(args.bio),
          showOnSite: bool(args.show_on_site),
          status: args.status as EventPartyStatus,
        })
      case 'update_party_member':
        return this.party.update(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.member_id, 'member_id'),
          {
            name: str(args.name),
            role: str(args.role),
            side: args.side as EventPartySide,
            group: str(args.group),
            bio: str(args.bio),
            showOnSite: bool(args.show_on_site),
            status: args.status as EventPartyStatus,
          },
        )
      case 'delete_party_member':
        return this.party.remove(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.member_id, 'member_id'),
        )
      case 'pair_party_members':
        return this.party.pair(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.member_id, 'member_id'),
          req(args.partner_id, 'partner_id'),
        )
      case 'unpair_party_member':
        return this.party.unpair(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.member_id, 'member_id'),
        )
      case 'set_party_photo': {
        const eventId = await this.eventId(ctx, args)
        const file = decodeUpload({
          filename: str(args.filename),
          mime: str(args.mime),
          base64: str(args.base64),
          kind: 'image',
        })
        const stored = makeUploadName(file.originalname)
        await this.storage.upload('images', stored, file.buffer, file.mimetype)
        return this.party.setPhoto(ctx.clerkId, eventId, req(args.member_id, 'member_id'), stored)
      }
      case 'clear_party_photo':
        return this.party.deletePhoto(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.member_id, 'member_id'),
        )
      case 'list_guests':
        return this.guests.listGuests(ctx.clerkId, await this.eventId(ctx, args))
      case 'add_guest':
        return this.guests.addGuest(ctx.clerkId, await this.eventId(ctx, args), guestDto(args))
      case 'update_guest':
        return this.guests.updateGuest(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.guest_id, 'guest_id'),
          guestDto(args),
        )
      case 'delete_guest':
        return this.guests.removeGuest(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.guest_id, 'guest_id'),
        )
      case 'import_guests':
        return this.guests.importGuests(ctx.clerkId, await this.eventId(ctx, args), {
          guests: (args.guests as CreateGuestDto[]) ?? [],
        })
      case 'invite_guest': {
        const eventId = await this.eventId(ctx, args)
        const guestId = req(args.guest_id, 'guest_id')
        const preview = await this.needConfirm(
          ctx,
          tool,
          args,
          `Send an RSVP invite to guest ${guestId}`,
          `An email or text leaves Djanora to that guest on event ${eventId}.`,
        )
        if (preview) return preview
        return this.guests.sendInvite(ctx.clerkId, eventId, guestId, {
          via: (args.via as SendInviteDto['via']) ?? 'email',
          customNote: str(args.custom_note),
        })
      }
      case 'bulk_invite_guests': {
        const eventId = await this.eventId(ctx, args)
        const ids = arr(args.guest_ids) ?? []
        const preview = await this.needConfirm(
          ctx,
          tool,
          args,
          `Send RSVP invites to ${ids.length} guests`,
          `Email or text goes to those guests on event ${eventId}.`,
        )
        if (preview) return preview
        return this.guests.bulkSendInvites(ctx.clerkId, eventId, {
          guestIds: ids,
          via: (args.via as BulkSendInviteDto['via']) ?? 'email',
          customNote: str(args.custom_note),
        })
      }
      case 'list_budget':
        return this.events.listBudget(ctx.clerkId, await this.eventId(ctx, args))
      case 'add_budget_item':
        return this.events.addBudgetItem(ctx.clerkId, await this.eventId(ctx, args), {
          category: args.category as VendorCategory,
          label: req(args.label, 'label'),
          allocatedAmount: num(args.allocated_amount) ?? 0,
          vendorName: str(args.vendor_name),
          vendorProfileId: str(args.vendor_profile_id),
          userVendorContactId: str(args.contact_id),
        })
      case 'update_budget_item':
        return this.events.updateBudgetItem(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.item_id, 'item_id'),
          {
            label: str(args.label),
            allocatedAmount: num(args.allocated_amount),
            spentAmount: num(args.spent_amount),
            vendorName: str(args.vendor_name),
          },
        )
      case 'delete_budget_item':
        return this.events.deleteBudgetItem(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.item_id, 'item_id'),
        )
      case 'import_budget':
        return this.events.importBudgetItems(ctx.clerkId, await this.eventId(ctx, args), {
          items: args.items,
        } as never)
      case 'add_budget_receipt': {
        const eventId = await this.eventId(ctx, args)
        const file = decodeUpload({
          filename: str(args.filename),
          mime: str(args.mime),
          base64: str(args.base64),
          kind: 'receipt',
        })
        const stored = makeUploadName(file.originalname)
        await this.storage.upload('receipts', stored, file.buffer, file.mimetype)
        return this.events.addReceipt(
          ctx.clerkId,
          eventId,
          req(args.item_id, 'item_id'),
          file.originalname,
          `private/${stored}`,
          file.mimetype,
          file.size,
        )
      }
      case 'delete_budget_receipt':
        return this.events.deleteReceipt(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.receipt_id, 'receipt_id'),
        )
      case 'list_comments':
        return this.comments.list(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.subject_type, 'subject_type') as EventCommentSubject,
          req(args.subject_id, 'subject_id'),
        )
      case 'add_comment':
        return this.comments.create(ctx.clerkId, await this.eventId(ctx, args), {
          subjectType: req(args.subject_type, 'subject_type') as EventCommentSubject,
          subjectId: req(args.subject_id, 'subject_id'),
          body: req(args.body, 'body'),
          parentId: str(args.parent_id),
          mentionUserIds: arr(args.mention_user_ids),
        })
      case 'update_comment':
        return this.comments.update(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.comment_id, 'comment_id'),
          { body: req(args.body, 'body') },
        )
      case 'delete_comment':
        return this.comments.remove(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.comment_id, 'comment_id'),
        )
      case 'list_activity':
        return this.activity.list(ctx.clerkId, await this.eventId(ctx, args), {
          limit: clamp(num(args.limit), 20),
          cursor: str(args.cursor),
        })
      case 'get_unread':
        return this.activity.unreadCounts(ctx.clerkId, await this.eventId(ctx, args))
      case 'mark_unread':
        return this.activity.markSeen(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.surface, 'surface'),
        )
      case 'list_personal_checklists':
        return this.users.listChecklists(ctx.clerkId, {
          limit: clamp(num(args.limit), 20),
          cursor: str(args.cursor),
        })
      case 'add_personal_checklist':
        return this.users.createChecklist(ctx.clerkId, {
          title: req(args.title, 'title'),
          dueDate: str(args.due_date) ?? new Date().toISOString().slice(0, 10),
          eventId: str(args.event_id),
        })
      case 'update_personal_checklist':
        return this.users.updateChecklist(ctx.clerkId, req(args.item_id, 'item_id'), {
          title: str(args.title),
          isCompleted: bool(args.is_completed),
          dueDate: str(args.due_date),
        })
      case 'delete_personal_checklist':
        return this.users.deleteChecklist(ctx.clerkId, req(args.item_id, 'item_id'))
      case 'get_site':
        return this.sites.getEditor(ctx.clerkId, await this.eventId(ctx, args))
      case 'create_site':
        return this.sites.create(ctx.clerkId, await this.eventId(ctx, args), {
          slug: req(args.slug, 'slug'),
          ownerAccessMode: args.owner_access_mode as CreateSiteDto['ownerAccessMode'],
        })
      case 'update_site':
        return this.sites.patch(ctx.clerkId, await this.eventId(ctx, args), sitePatch(args))
      case 'publish_site': {
        const eventId = await this.eventId(ctx, args)
        const preview = await this.needConfirm(
          ctx,
          tool,
          args,
          `Publish the event site for ${eventId}`,
          'The public /e/[slug] page goes live for anyone the site access mode allows.',
        )
        if (preview) return preview
        return this.sites.publish(ctx.clerkId, eventId)
      }
      case 'unpublish_site': {
        const eventId = await this.eventId(ctx, args)
        const preview = await this.needConfirm(
          ctx,
          tool,
          args,
          `Unpublish the event site for ${eventId}`,
          'The public URL 404s. Content stays in the draft.',
        )
        if (preview) return preview
        return this.sites.unpublish(ctx.clerkId, eventId)
      }
      case 'delete_site': {
        const eventId = await this.eventId(ctx, args)
        const preview = await this.needConfirm(
          ctx,
          tool,
          args,
          `Delete the event site for ${eventId}`,
          'The slug, photos, and site rows are removed. The event stays.',
        )
        if (preview) return preview
        return this.sites.remove(ctx.clerkId, eventId)
      }
      case 'set_site_cover':
        return this.uploadSiteImage(ctx, args, 'cover')
      case 'add_site_photo':
        return this.uploadSiteImage(ctx, args, 'gallery')
      case 'delete_site_photo':
        return this.sites.deletePhoto(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.photo_id, 'photo_id'),
        )
      case 'set_section_photo':
        return this.uploadSiteImage(ctx, args, 'section')
      case 'clear_section_photo':
        return this.sites.deleteSectionPhoto(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.section_id, 'section_id'),
        )
      case 'set_site_person_photo':
        return this.uploadSiteImage(ctx, args, 'person')
      case 'clear_site_person_photo':
        return this.sites.deletePersonPhoto(
          ctx.clerkId,
          await this.eventId(ctx, args),
          req(args.section_id, 'section_id'),
          req(args.person_id, 'person_id'),
        )
      case 'list_members':
        return this.members.list(ctx.clerkId, await this.eventId(ctx, args))
      case 'invite_member': {
        const eventId = await this.eventId(ctx, args)
        const email = req(args.email, 'email')
        const preview = await this.needConfirm(
          ctx,
          tool,
          args,
          `Invite ${email} to the event`,
          `They get an email and the surfaces you named on event ${eventId}.`,
        )
        if (preview) return preview
        return this.members.invite(ctx.clerkId, eventId, {
          email,
          role: (args.role as EventMemberRole) ?? EventMemberRole.VIEWER,
          surfaces: (arr(args.surfaces) as EventSurface[]) ?? [],
        })
      }
      case 'update_member':
        return this.updateMember(ctx, args)
      case 'remove_member': {
        const eventId = await this.eventId(ctx, args)
        const memberId = req(args.member_id, 'member_id')
        const preview = await this.needConfirm(
          ctx,
          tool,
          args,
          `Remove collaborator ${memberId}`,
          `They lose access to event ${eventId}.`,
        )
        if (preview) return preview
        return this.members.remove(ctx.clerkId, eventId, memberId)
      }
      case 'leave_event': {
        const eventId = await this.eventId(ctx, args)
        const preview = await this.needConfirm(
          ctx,
          tool,
          args,
          `Leave event ${eventId}`,
          'You drop off this event. The host stays.',
        )
        if (preview) return preview
        return this.members.leave(ctx.clerkId, eventId)
      }
      case 'list_event_invites':
        return this.members.listPending(ctx.clerkId)
      case 'accept_event_invite':
        return this.members.accept(ctx.clerkId, req(args.token, 'token'))
      case 'search_vendors':
        return this.vendors.findAll(str(args.category))
      case 'get_vendor':
        return this.vendors.findBySlug(req(args.slug, 'slug'))
      case 'favorite_vendor':
        return this.vendors.favorite(ctx.clerkId, req(args.slug, 'slug'))
      case 'unfavorite_vendor':
        return this.vendors.unfavorite(ctx.clerkId, req(args.slug, 'slug'))
      case 'list_favorite_vendors':
        return this.vendors.getFavorites(ctx.clerkId)
      case 'inquire_vendor': {
        const preview = await this.needConfirm(
          ctx,
          tool,
          args,
          `Contact vendor ${str(args.vendor_profile_id) ?? ''}`,
          'A real message is sent to that business.',
        )
        if (preview) return preview
        return this.inquiries.createInquiry(ctx.clerkId, {
          eventId: str(args.event_id),
          vendorProfileId: req(args.vendor_profile_id, 'vendor_profile_id'),
          message: req(args.message, 'message'),
          eventDate: str(args.event_date),
          inspirationItemId: str(args.inspiration_item_id),
        })
      }
      case 'list_inquiries':
        return this.inquiries.getMyInquiries(ctx.clerkId)
      case 'list_event_inquiries':
        return this.inquiries.getEventInquiries(ctx.clerkId, await this.eventId(ctx, args))
      case 'list_inquiry_messages':
        return this.inquiries.getMessages(ctx.clerkId, req(args.inquiry_id, 'inquiry_id'))
      case 'send_inquiry_message':
        return this.inquiries.postMessage(ctx.clerkId, req(args.inquiry_id, 'inquiry_id'), {
          message: str(args.message),
          kind: args.kind as PostInquiryMessageDto['kind'],
        })
      case 'accept_quote':
      case 'reject_quote':
      case 'book_vendor': {
        const inquiryId = req(args.inquiry_id, 'inquiry_id')
        const messageId = req(args.message_id, 'message_id')
        const label =
          tool === 'book_vendor'
            ? 'Book this vendor'
            : tool === 'accept_quote'
              ? 'Accept quote'
              : 'Reject quote'
        const preview = await this.needConfirm(
          ctx,
          tool,
          args,
          `${label} on inquiry ${inquiryId}`,
          tool === 'book_vendor'
            ? 'Marks this inquiry booked in Djanora.'
            : 'Updates the quote status. The vendor is notified.',
        )
        if (preview) return preview
        if (tool === 'book_vendor')
          return this.inquiries.bookQuote(ctx.clerkId, inquiryId, messageId)
        if (tool === 'accept_quote')
          return this.inquiries.acceptQuote(ctx.clerkId, inquiryId, messageId)
        return this.inquiries.rejectQuote(ctx.clerkId, inquiryId, messageId)
      }
      case 'list_vendor_inquiries':
        return this.inquiries.getVendorInquiries(ctx.clerkId)
      case 'set_inquiry_status':
        return this.inquiries.updateInquiryStatus(
          ctx.clerkId,
          req(args.inquiry_id, 'inquiry_id'),
          args.status === 'DECLINED' ? 'DECLINED' : 'ACCEPTED',
        )
      case 'get_vendor_me':
        return this.vendors.getMyProfile(ctx.clerkId)
      case 'update_vendor_me':
        return this.vendors.updateMe(ctx.clerkId, {
          businessName: str(args.business_name),
          bio: str(args.bio),
          websiteUrl: str(args.website_url),
        } as never)
      case 'create_vendor_profile':
        return this.vendors.createProfile(ctx.clerkId, {
          businessName: req(args.business_name, 'business_name'),
          category: args.category as VendorCategory,
        })
      case 'list_vendor_posts':
        return this.vendorPosts.listMine(ctx.clerkId)
      case 'create_vendor_post':
        return this.vendorPosts.create(ctx.clerkId, {
          title: req(args.title, 'title'),
          description: str(args.caption) ?? str(args.description),
        })
      case 'update_vendor_post':
        return this.vendorPosts.update(ctx.clerkId, req(args.post_id, 'post_id'), {
          title: str(args.title),
          description: str(args.caption) ?? str(args.description),
        })
      case 'delete_vendor_post':
        return this.vendorPosts.remove(ctx.clerkId, req(args.post_id, 'post_id'))
      case 'add_vendor_post_media':
        return this.vendorPosts.addExternal(
          ctx.clerkId,
          req(args.post_id, 'post_id'),
          req(args.url, 'url'),
        )
      case 'list_notifications':
        return this.notifications.findByUser(ctx.clerkId, clamp(num(args.limit), 20))
      case 'get_notification':
        return this.notifications.findOne(ctx.clerkId, req(args.notification_id, 'notification_id'))
      case 'mark_notification_read':
        return this.notifications.markRead(
          ctx.clerkId,
          req(args.notification_id, 'notification_id'),
        )
      case 'mark_notifications_read':
        return this.notifications.markAllRead(ctx.clerkId)
      case 'search_inspiration':
        return str(args.q)
          ? this.inspiration.search(
              str(args.q)!,
              args.category as never,
              clamp(num(args.limit), 20),
            )
          : this.inspiration.findAll(args.category as never, clamp(num(args.limit), 20))
      case 'get_inspiration':
        return this.inspiration.findOne(req(args.inspiration_id, 'inspiration_id'), ctx.clerkId)
      case 'like_inspiration':
        return this.inspiration.like(ctx.clerkId, req(args.inspiration_id, 'inspiration_id'))
      case 'unlike_inspiration':
        return this.inspiration.unlike(ctx.clerkId, req(args.inspiration_id, 'inspiration_id'))
      case 'list_mood_board':
        return this.inspiration.getMoodBoard(ctx.clerkId, await this.eventId(ctx, args))
      case 'add_mood_board_item':
        return this.inspiration.saveToMoodBoard(
          ctx.clerkId,
          req(args.inspiration_id, 'inspiration_id'),
          await this.eventId(ctx, args),
          str(args.notes),
        )
      case 'remove_mood_board_item':
        return this.inspiration.removeFromMoodBoard(
          ctx.clerkId,
          req(args.inspiration_id, 'inspiration_id'),
          await this.eventId(ctx, args),
        )
      case 'list_vendor_contacts':
        return this.vendorContacts.findAll(ctx.clerkId, str(args.category))
      case 'add_vendor_contact':
        return this.vendorContacts.create(ctx.clerkId, {
          name: req(args.name, 'name'),
          email: str(args.email),
          phone: str(args.phone),
          category: args.category as VendorCategory,
        })
      case 'update_vendor_contact':
        return this.vendorContacts.update(ctx.clerkId, req(args.contact_id, 'contact_id'), {
          name: str(args.name),
          email: str(args.email),
          phone: str(args.phone),
        })
      case 'delete_vendor_contact':
        return this.vendorContacts.remove(ctx.clerkId, req(args.contact_id, 'contact_id'))
      default:
        mcpError('invalid', `Unknown job ${tool}`)
    }
  }

  private async whoAmI(ctx: McpCtx) {
    const user = await this.users.ensureFromClerk(ctx.clerkId)
    const currentId = await this.sessions.currentEventId(ctx.sessionId)
    let currentEvent: { id: string; title: string; estimatedDate: Date | null } | null = null
    let surfacesOnCurrentEvent: EventSurface[] | undefined
    if (currentId) {
      try {
        const access = await this.access.require(ctx.clerkId, currentId)
        currentEvent = {
          id: access.event.id,
          title: access.event.title,
          estimatedDate: access.event.estimatedDate,
        }
        surfacesOnCurrentEvent = access.isHost
          ? ([...Object.values(EventSurface)] as EventSurface[])
          : access.surfaces
      } catch {
        await this.sessions.setCurrentEvent(ctx.sessionId, ctx.clerkId, null)
      }
    }
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        hasVendorProfile: user.hasVendorProfile,
      },
      activeMode: user.activeMode,
      role: user.role,
      vendorProfile: user.vendorProfile
        ? {
            id: user.vendorProfile.id,
            slug: user.vendorProfile.slug,
            businessName: user.vendorProfile.businessName,
          }
        : null,
      currentEvent,
      surfacesOnCurrentEvent,
    }
  }

  private async updateMember(ctx: McpCtx, args: Args) {
    const eventId = await this.eventId(ctx, args)
    const memberId = req(args.member_id, 'member_id')
    const listed = await this.members.list(ctx.clerkId, eventId)
    const current = listed.members.find((m) => m.id === memberId)
    if (!current) mcpError('not_found', 'Event not found')
    const nextSurfaces = (arr(args.surfaces) as EventSurface[] | undefined) ?? current.surfaces
    const nextRole = (args.role as EventMemberRole | undefined) ?? current.role
    const addingSite =
      nextSurfaces.includes(EventSurface.SITE) && !current.surfaces.includes(EventSurface.SITE)
    const roleUp = nextRole === EventMemberRole.EDITOR && current.role !== EventMemberRole.EDITOR
    if (addingSite || roleUp) {
      const preview = await this.needConfirm(
        ctx,
        'update_member',
        args,
        `Raise access for ${current.email}`,
        addingSite
          ? 'They will be able to edit and publish the event site.'
          : 'They will be able to edit the surfaces they already have.',
      )
      if (preview) return preview
    }
    return this.members.update(ctx.clerkId, eventId, memberId, {
      role: args.role as EventMemberRole,
      surfaces: arr(args.surfaces) as EventSurface[],
    })
  }

  private async uploadSiteImage(
    ctx: McpCtx,
    args: Args,
    kind: 'cover' | 'gallery' | 'section' | 'person',
  ) {
    const eventId = await this.eventId(ctx, args)
    const file = decodeUpload({
      filename: str(args.filename),
      mime: str(args.mime),
      base64: str(args.base64),
      kind: 'image',
    })
    const stored = makeUploadName(file.originalname)
    await this.storage.upload('images', stored, file.buffer, file.mimetype)
    if (kind === 'cover') return this.sites.uploadCover(ctx.clerkId, eventId, stored)
    if (kind === 'gallery') return this.sites.uploadPhoto(ctx.clerkId, eventId, stored)
    if (kind === 'section') {
      return this.sites.uploadSectionPhoto(
        ctx.clerkId,
        eventId,
        req(args.section_id, 'section_id'),
        stored,
        str(args.alt) ?? '',
      )
    }
    return this.sites.uploadPersonPhoto(
      ctx.clerkId,
      eventId,
      req(args.section_id, 'section_id'),
      req(args.person_id, 'person_id'),
      stored,
      str(args.alt) ?? '',
    )
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined
}

function req(v: unknown, name: string): string {
  const s = str(v)
  if (!s) mcpError('invalid', `${name} is required`)
  return s
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}

function arr(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.map(String) : undefined
}

function clamp(n: number | undefined, fallback: number) {
  if (!n || n < 1) return fallback
  return Math.min(n, 50)
}

function page<T>(items: T[], args: Args) {
  const limit = clamp(num(args.limit), 20)
  const offset = Math.max(0, Number.parseInt(str(args.cursor) ?? '0', 10) || 0)
  const slice = items.slice(offset, offset + limit)
  return {
    items: slice,
    nextCursor: offset + limit < items.length ? String(offset + limit) : null,
  }
}

function modeArg(v: unknown): 'user' | 'vendor' {
  if (v === 'vendor') return 'vendor'
  if (v === 'host' || v === 'user') return 'user'
  mcpError('invalid', 'mode must be host, user, or vendor')
}

function guestDto(args: Args): CreateGuestDto {
  return {
    firstName: str(args.first_name) ?? '',
    lastName: str(args.last_name),
    email: str(args.email),
    phone: str(args.phone),
    note: str(args.note),
    plusOneAllowed: bool(args.plus_one_allowed),
    tableNumber: str(args.table_number),
  }
}

function sitePatch(args: Args): PatchSiteDto {
  return {
    slug: str(args.slug),
    ownerAccessMode: args.owner_access_mode as PatchSiteDto['ownerAccessMode'],
    themePreset: args.theme_preset as PatchSiteDto['themePreset'],
    fontPair: args.font_pair as PatchSiteDto['fontPair'],
    colorPalette: args.color_palette as PatchSiteDto['colorPalette'],
    buttonStyle: args.button_style as PatchSiteDto['buttonStyle'],
    coverLayout: args.cover_layout as PatchSiteDto['coverLayout'],
    sections: args.sections as PatchSiteDto['sections'],
  }
}
