import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpCtx } from './mcp.context'
import { McpJobsService } from './mcp.jobs'
import { catchJob, okJson } from './mcp.result'

const eventScope = {
  event_id: z.string().optional(),
  event_title: z.string().optional(),
}

const confirm = { confirm_token: z.string().optional() }
const file = {
  filename: z.string().optional(),
  mime: z.string().optional(),
  base64: z.string().optional(),
}

type Shape = Record<string, z.ZodTypeAny>

export function registerMcpTools(server: McpServer, jobs: McpJobsService) {
  const add = (name: string, description: string, inputSchema: Shape) => {
    server.registerTool(name, { description, inputSchema }, async (args, extra) => {
      try {
        const result = await jobs.run(mcpCtx(extra), name, args)
        return okJson(result)
      } catch (err) {
        return catchJob(err)
      }
    })
  }

  add(
    'who_am_i',
    'Signed-in Djanora user, active mode, and current event for this connector session.',
    {},
  )
  add('set_active_mode', 'Switch between host (user) and vendor mode. Same as the website.', {
    mode: z.enum(['host', 'user', 'vendor']),
  })
  add('update_me', 'Update the signed-in profile.', {
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    city: z.string().optional(),
  })
  add('complete_onboarding', 'Finish onboarding if the account has not.', {
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    role: z.enum(['USER', 'VENDOR']),
    tribes: z.array(z.string()).optional(),
    city: z.string().optional(),
    country_of_origin: z.string().optional(),
    date_of_birth: z.string().optional(),
  })
  add('list_events', 'Events this user can see.', {
    limit: z.number().optional(),
    cursor: z.string().optional(),
  })
  add('get_event', 'Full event the user can access.', eventScope)
  add('set_current_event', 'Sticky event for this connector session.', eventScope)
  add('clear_current_event', 'Unset the session event.', {})
  add('create_event', 'Create an event.', {
    title: z.string(),
    event_type: z.string().optional(),
    tribes: z.array(z.string()).optional(),
    themes: z.array(z.string()).optional(),
    total_budget: z.number().optional(),
    include_default_budget: z.boolean().optional(),
    include_default_checklist: z.boolean().optional(),
    estimated_date: z.string().optional(),
    guest_count: z.number().optional(),
    location: z.string().optional(),
  })
  add('update_event', 'Update event fields.', {
    ...eventScope,
    title: z.string().optional(),
    estimated_date: z.string().optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
    total_budget: z.number().optional(),
    guest_count: z.number().optional(),
    is_completed: z.boolean().optional(),
    party_enabled: z.boolean().optional(),
  })
  add('delete_event', 'Soft-delete an event. Confirm required.', { ...eventScope, ...confirm })
  add('add_child_event', 'Add a child ceremony under this event.', {
    ...eventScope,
    title: z.string(),
    event_type: z.string().optional(),
  })
  add('attach_child_event', 'Attach an existing event as a child.', {
    ...eventScope,
    child_id: z.string(),
  })
  add('detach_child_event', 'Detach a child event.', { ...eventScope, child_id: z.string() })
  add('reorder_children', 'Reorder child events.', {
    ...eventScope,
    child_ids: z.array(z.string()),
  })
  add('list_checklist', 'Checklist rows the viewer may see.', eventScope)
  add('add_checklist_item', 'Add a checklist item.', {
    ...eventScope,
    title: z.string(),
    description: z.string().optional(),
    due_date: z.string().optional(),
  })
  add('update_checklist_item', 'Update a checklist item.', {
    ...eventScope,
    item_id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    is_completed: z.boolean().optional(),
    due_date: z.string().optional(),
  })
  add('delete_checklist_item', 'Delete a checklist item.', { ...eventScope, item_id: z.string() })
  add('list_schedule', 'Schedule items.', eventScope)
  add('add_schedule_item', 'Add a schedule item.', {
    ...eventScope,
    title: z.string(),
    notes: z.string().optional(),
    date: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    location: z.string().optional(),
    show_on_site: z.boolean().optional(),
  })
  add('update_schedule_item', 'Update a schedule item.', {
    ...eventScope,
    item_id: z.string(),
    title: z.string().optional(),
    notes: z.string().optional(),
    date: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    location: z.string().optional(),
    show_on_site: z.boolean().optional(),
  })
  add('delete_schedule_item', 'Delete a schedule item.', { ...eventScope, item_id: z.string() })
  add('list_party', 'Wedding party roster.', eventScope)
  add('add_party_member', 'Add a party member.', {
    ...eventScope,
    name: z.string(),
    role: z.string().optional(),
    side: z.string().optional(),
    group: z.string().optional(),
    bio: z.string().optional(),
    show_on_site: z.boolean().optional(),
    status: z.string().optional(),
  })
  add('update_party_member', 'Update a party member.', {
    ...eventScope,
    member_id: z.string(),
    name: z.string().optional(),
    role: z.string().optional(),
    side: z.string().optional(),
    group: z.string().optional(),
    bio: z.string().optional(),
    show_on_site: z.boolean().optional(),
    status: z.string().optional(),
  })
  add('delete_party_member', 'Remove a party member.', { ...eventScope, member_id: z.string() })
  add('pair_party_members', 'Pair two party members.', {
    ...eventScope,
    member_id: z.string(),
    partner_id: z.string(),
  })
  add('unpair_party_member', 'Unpair a party member.', { ...eventScope, member_id: z.string() })
  add('set_party_photo', 'Upload a party photo (jpeg/png/webp, 8MB).', {
    ...eventScope,
    member_id: z.string(),
    ...file,
  })
  add('clear_party_photo', 'Remove a party photo.', { ...eventScope, member_id: z.string() })
  add('list_guests', 'Guests on the event.', eventScope)
  add('add_guest', 'Add a guest.', {
    ...eventScope,
    first_name: z.string(),
    last_name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    note: z.string().optional(),
    plus_one_allowed: z.boolean().optional(),
    table_number: z.string().optional(),
  })
  add('update_guest', 'Update a guest.', {
    ...eventScope,
    guest_id: z.string(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    note: z.string().optional(),
    plus_one_allowed: z.boolean().optional(),
    table_number: z.string().optional(),
  })
  add('delete_guest', 'Remove a guest.', { ...eventScope, guest_id: z.string() })
  add('import_guests', 'Import guests.', {
    ...eventScope,
    guests: z.array(z.record(z.string(), z.unknown())),
  })
  add('invite_guest', 'Email or text an RSVP invite. Confirm required.', {
    ...eventScope,
    guest_id: z.string(),
    via: z.enum(['email', 'sms', 'both']).optional(),
    custom_note: z.string().optional(),
    ...confirm,
  })
  add('bulk_invite_guests', 'Bulk RSVP invites. Confirm required.', {
    ...eventScope,
    guest_ids: z.array(z.string()),
    via: z.enum(['email', 'sms', 'both']).optional(),
    custom_note: z.string().optional(),
    ...confirm,
  })
  add('list_budget', 'Budget lines.', eventScope)
  add('add_budget_item', 'Add a budget line.', {
    ...eventScope,
    category: z.string(),
    label: z.string(),
    allocated_amount: z.number().optional(),
    vendor_name: z.string().optional(),
    vendor_profile_id: z.string().optional(),
    contact_id: z.string().optional(),
  })
  add('update_budget_item', 'Update a budget line.', {
    ...eventScope,
    item_id: z.string(),
    label: z.string().optional(),
    allocated_amount: z.number().optional(),
    spent_amount: z.number().optional(),
    vendor_name: z.string().optional(),
  })
  add('delete_budget_item', 'Delete a budget line.', { ...eventScope, item_id: z.string() })
  add('import_budget', 'Import budget lines.', { ...eventScope, items: z.unknown().optional() })
  add('add_budget_receipt', 'Attach a receipt image or PDF.', {
    ...eventScope,
    item_id: z.string(),
    ...file,
  })
  add('delete_budget_receipt', 'Delete a receipt.', { ...eventScope, receipt_id: z.string() })
  add('list_comments', 'Comments on a subject.', {
    ...eventScope,
    subject_type: z.string(),
    subject_id: z.string(),
  })
  add('add_comment', 'Add a comment.', {
    ...eventScope,
    subject_type: z.string(),
    subject_id: z.string(),
    body: z.string(),
    parent_id: z.string().optional(),
    mention_user_ids: z.array(z.string()).optional(),
  })
  add('update_comment', 'Edit a comment.', {
    ...eventScope,
    comment_id: z.string(),
    body: z.string(),
  })
  add('delete_comment', 'Delete a comment.', { ...eventScope, comment_id: z.string() })
  add('list_activity', 'Activity feed.', {
    ...eventScope,
    limit: z.number().optional(),
    cursor: z.string().optional(),
  })
  add('get_unread', 'Unread surface counts.', eventScope)
  add('mark_unread', 'Mark a surface seen.', { ...eventScope, surface: z.string() })
  add('list_personal_checklists', 'Home checklist.', {
    limit: z.number().optional(),
    cursor: z.string().optional(),
  })
  add('add_personal_checklist', 'Add a personal checklist item.', {
    title: z.string(),
    due_date: z.string().optional(),
    event_id: z.string().optional(),
  })
  add('update_personal_checklist', 'Update a personal checklist item.', {
    item_id: z.string(),
    title: z.string().optional(),
    is_completed: z.boolean().optional(),
    due_date: z.string().optional(),
  })
  add('delete_personal_checklist', 'Delete a personal checklist item.', { item_id: z.string() })
  add('get_site', 'Event site editor payload.', eventScope)
  add('create_site', 'Create a draft event site.', {
    ...eventScope,
    slug: z.string(),
    owner_access_mode: z.enum(['OPEN', 'INVITED_ONLY']).optional(),
  })
  add('update_site', 'Patch site catalogs and sections (draft).', {
    ...eventScope,
    slug: z.string().optional(),
    owner_access_mode: z.enum(['OPEN', 'INVITED_ONLY']).optional(),
    theme_preset: z.string().optional(),
    font_pair: z.string().optional(),
    color_palette: z.string().optional(),
    button_style: z.string().optional(),
    cover_layout: z.string().optional(),
    sections: z.unknown().optional(),
  })
  add('publish_site', 'Publish the site. Confirm required.', { ...eventScope, ...confirm })
  add('unpublish_site', 'Unpublish the site. Confirm required.', { ...eventScope, ...confirm })
  add('delete_site', 'Delete the site. Confirm required.', { ...eventScope, ...confirm })
  add('set_site_cover', 'Upload the cover photo.', { ...eventScope, ...file })
  add('add_site_photo', 'Add a gallery photo.', { ...eventScope, ...file })
  add('delete_site_photo', 'Remove a gallery photo.', { ...eventScope, photo_id: z.string() })
  add('set_section_photo', 'Upload a section hero.', {
    ...eventScope,
    section_id: z.string(),
    alt: z.string().optional(),
    ...file,
  })
  add('clear_section_photo', 'Clear a section hero.', { ...eventScope, section_id: z.string() })
  add('set_site_person_photo', 'Upload a people-section photo.', {
    ...eventScope,
    section_id: z.string(),
    person_id: z.string(),
    alt: z.string().optional(),
    ...file,
  })
  add('clear_site_person_photo', 'Clear a people-section photo.', {
    ...eventScope,
    section_id: z.string(),
    person_id: z.string(),
  })
  add('list_members', 'Collaborators on the event.', eventScope)
  add('invite_member', 'Invite a collaborator. Confirm required.', {
    ...eventScope,
    email: z.string(),
    role: z.string().optional(),
    surfaces: z.array(z.string()).optional(),
    ...confirm,
  })
  add('update_member', 'Change role or surfaces. Confirm if access goes up.', {
    ...eventScope,
    member_id: z.string(),
    role: z.string().optional(),
    surfaces: z.array(z.string()).optional(),
    ...confirm,
  })
  add('remove_member', 'Remove a collaborator. Confirm required.', {
    ...eventScope,
    member_id: z.string(),
    ...confirm,
  })
  add('leave_event', 'Leave the event. Confirm required.', { ...eventScope, ...confirm })
  add('list_event_invites', 'Pending event invites for the signed-in user.', {})
  add('accept_event_invite', 'Accept an event invite.', { token: z.string() })
  add('search_vendors', 'Search the vendor directory.', { category: z.string().optional() })
  add('get_vendor', 'Inspect a vendor profile.', { slug: z.string() })
  add('favorite_vendor', 'Save a vendor.', { slug: z.string() })
  add('unfavorite_vendor', 'Unsave a vendor.', { slug: z.string() })
  add('list_favorite_vendors', 'Saved vendors.', {})
  add('inquire_vendor', 'Contact a vendor. Confirm required.', {
    vendor_profile_id: z.string(),
    message: z.string(),
    event_id: z.string().optional(),
    event_date: z.string().optional(),
    inspiration_item_id: z.string().optional(),
    ...confirm,
  })
  add('list_inquiries', 'Inquiries this user sent.', {})
  add('list_event_inquiries', 'Inquiries on the current event.', eventScope)
  add('list_inquiry_messages', 'Messages in an inquiry.', { inquiry_id: z.string() })
  add('send_inquiry_message', 'Reply on an inquiry.', {
    inquiry_id: z.string(),
    message: z.string().optional(),
    kind: z.string().optional(),
  })
  add('accept_quote', 'Accept a quote. Confirm required.', {
    inquiry_id: z.string(),
    message_id: z.string(),
    ...confirm,
  })
  add('reject_quote', 'Reject a quote. Confirm required.', {
    inquiry_id: z.string(),
    message_id: z.string(),
    ...confirm,
  })
  add('book_vendor', 'Mark an inquiry booked. Confirm required.', {
    inquiry_id: z.string(),
    message_id: z.string(),
    ...confirm,
  })
  add('list_vendor_inquiries', 'Inquiries received by this vendor.', {})
  add('set_inquiry_status', 'Vendor accept or decline an inquiry.', {
    inquiry_id: z.string(),
    status: z.enum(['ACCEPTED', 'DECLINED']),
  })
  add('get_vendor_me', 'This account’s vendor profile.', {})
  add('update_vendor_me', 'Update the vendor profile.', {
    business_name: z.string().optional(),
    bio: z.string().optional(),
    website_url: z.string().optional(),
  })
  add('create_vendor_profile', 'Create a vendor profile.', {
    business_name: z.string(),
    category: z.string(),
  })
  add('list_vendor_posts', 'This vendor’s posts.', {})
  add('create_vendor_post', 'Create a vendor post.', {
    title: z.string(),
    caption: z.string().optional(),
    description: z.string().optional(),
  })
  add('update_vendor_post', 'Update a vendor post.', {
    post_id: z.string(),
    title: z.string().optional(),
    caption: z.string().optional(),
    description: z.string().optional(),
  })
  add('delete_vendor_post', 'Delete a vendor post.', { post_id: z.string() })
  add('add_vendor_post_media', 'Attach an external media URL to a post.', {
    post_id: z.string(),
    url: z.string(),
  })
  add('list_notifications', 'Inbox on demand.', { limit: z.number().optional() })
  add('get_notification', 'Open one notification.', { notification_id: z.string() })
  add('mark_notification_read', 'Mark one notification read.', { notification_id: z.string() })
  add('mark_notifications_read', 'Mark the inbox read.', {})
  add('search_inspiration', 'Search inspiration.', {
    q: z.string().optional(),
    category: z.string().optional(),
    limit: z.number().optional(),
  })
  add('get_inspiration', 'One inspiration item.', { inspiration_id: z.string() })
  add('like_inspiration', 'Like inspiration.', { inspiration_id: z.string() })
  add('unlike_inspiration', 'Unlike inspiration.', { inspiration_id: z.string() })
  add('list_mood_board', 'Mood board membership for the event.', eventScope)
  add('add_mood_board_item', 'Save inspiration to the mood board.', {
    ...eventScope,
    inspiration_id: z.string(),
    notes: z.string().optional(),
  })
  add('remove_mood_board_item', 'Remove inspiration from the mood board.', {
    ...eventScope,
    inspiration_id: z.string(),
  })
  add('list_vendor_contacts', 'Personal vendor contacts.', { category: z.string().optional() })
  add('add_vendor_contact', 'Add a personal vendor contact.', {
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    category: z.string().optional(),
  })
  add('update_vendor_contact', 'Update a personal vendor contact.', {
    contact_id: z.string(),
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
  })
  add('delete_vendor_contact', 'Delete a personal vendor contact.', { contact_id: z.string() })
}
