const TITLE_MAX = 48

const GREETING =
  /^(hi|hello|hey|yo|sup|thanks|thank you|please|ok|okay|bonjour|salut|coucou)\b[\s,!.'’-]*/i

const JOB_TITLES: Record<string, string> = {
  import_guests: 'Guest list',
  import_budget: 'Budget import',
  import_checklist: 'Checklist import',
  import_schedule: 'Schedule import',
  import_party: 'Wedding party',
  apply_weekend: 'Weekend plan',
  draft_site_copy: 'Site copy',
  add_guest: 'Add a guest',
  invite_guest: 'Send invites',
  bulk_invite_guests: 'Send invites',
  add_budget_item: 'Budget line',
  add_checklist_item: 'Checklist',
  lookup_culture: 'Culture notes',
  lookup_city: 'City notes',
}

const KIND_TITLES: Record<string, string> = {
  guests: 'Guest list',
  budget: 'Budget import',
  checklist: 'Checklist import',
  schedule: 'Schedule import',
  party: 'Wedding party',
}

function collapse(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function finish(value: string) {
  const text = collapse(value)
  if (!text) return undefined
  const sliced = text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1).trimEnd()}…` : text
  return sliced.charAt(0).toUpperCase() + sliced.slice(1)
}

function stripGreetings(value: string) {
  let text = collapse(value)
  for (let i = 0; i < 3; i += 1) {
    const next = text.replace(GREETING, '').trim()
    if (next === text) break
    text = next
  }
  return text
}

function fromSheetMessage(value: string) {
  const match = /^I attached (.+?) from the (guests|budget|checklist|schedule|party) screen/i.exec(
    value,
  )
  if (!match) return undefined
  const filename = match[1].split(/[/\\]/).pop()?.trim()
  const kind = KIND_TITLES[match[2].toLowerCase()] ?? 'Spreadsheet'
  return filename ? `${kind} · ${filename}` : kind
}

export function isWeakThreadTitle(title: string | null | undefined) {
  if (!title?.trim()) return true
  return !titleFromUserText(title)
}

export function titleFromUserText(message: string) {
  const raw = collapse(message)
  if (!raw) return undefined
  const fromSheet = fromSheetMessage(raw)
  if (fromSheet) return finish(fromSheet)
  const body = stripGreetings(raw)
    .replace(/^[,!.\-:;]+/, '')
    .trim()
  if (body.length < 6) return undefined
  const words = body.split(' ').filter(Boolean)
  if (words.length === 1 && words[0].length < 10) return undefined
  return finish(body)
}

export function titleFromJobs(jobs?: string[]) {
  if (!jobs?.length) return undefined
  for (const job of jobs) {
    if (JOB_TITLES[job]) return JOB_TITLES[job]
  }
  return undefined
}

/** Created and never messaged — title stays empty and updatedAt is still create time. */
export function isUnusedAssistantThread(thread: {
  title: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return !thread.title && thread.updatedAt.getTime() === thread.createdAt.getTime()
}

export function nextThreadTitle(input: {
  userMessage: string
  currentTitle?: string | null
  jobs?: string[]
}) {
  const next = titleFromUserText(input.userMessage) ?? titleFromJobs(input.jobs)
  if (!next) return undefined
  if (isWeakThreadTitle(input.currentTitle)) return next
  return undefined
}
