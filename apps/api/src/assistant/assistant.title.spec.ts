import {
  isUnusedAssistantThread,
  isWeakThreadTitle,
  nextThreadTitle,
  titleFromUserText,
} from './assistant.title'

describe('assistant.title', () => {
  it('does not name a chat after a greeting', () => {
    expect(titleFromUserText('Hi')).toBeUndefined()
    expect(titleFromUserText('hello!')).toBeUndefined()
    expect(isWeakThreadTitle('Hi')).toBe(true)
  })

  it('uses the useful part after a greeting', () => {
    expect(titleFromUserText('Hi, add these 12 guests')).toBe('Add these 12 guests')
  })

  it('names a spreadsheet from the screen and file', () => {
    expect(
      titleFromUserText(
        'I attached RSVP list.xlsx from the guests screen. Read the cells. Map a column only when its meaning is clear.',
      ),
    ).toBe('Guest list · RSVP list.xlsx')
  })

  it('replaces a weak title once the topic is clear', () => {
    expect(
      nextThreadTitle({
        currentTitle: 'Hi',
        userMessage: 'What is left this week for the introduction?',
      }),
    ).toBe('What is left this week for the introduction?')
    expect(
      nextThreadTitle({
        currentTitle: 'Guest list',
        userMessage: 'thanks',
        jobs: ['import_guests'],
      }),
    ).toBeUndefined()
  })

  it('falls back to the job when the message is thin', () => {
    expect(nextThreadTitle({ userMessage: 'yes', jobs: ['import_budget'] })).toBe('Budget import')
  })

  it('treats a never-messaged chat as unused', () => {
    const at = new Date('2026-09-21T18:00:00.000Z')
    expect(isUnusedAssistantThread({ title: null, createdAt: at, updatedAt: at })).toBe(true)
    expect(
      isUnusedAssistantThread({
        title: null,
        createdAt: at,
        updatedAt: new Date('2026-09-21T18:01:00.000Z'),
      }),
    ).toBe(false)
    expect(isUnusedAssistantThread({ title: 'Guest list', createdAt: at, updatedAt: at })).toBe(
      false,
    )
  })
})
