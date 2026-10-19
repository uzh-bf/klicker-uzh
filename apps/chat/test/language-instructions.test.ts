import { describe, expect, test } from 'vitest'

import { readMeetingClock } from '../src/lib/meetingClock'
import { stepReminder } from '../src/lib/server/calculatorTool'
import {
  formatMeetingClock,
  REPLY_LANGUAGE_REMINDER,
  replyLanguageReminder,
  withLanguageStyleContract,
} from '../src/lib/server/languageInstructions'
import { renderPromptTemplate } from '../src/lib/server/promptTemplates'

describe('withLanguageStyleContract', () => {
  test('appends the contract to a non-empty base prompt', () => {
    const base = 'You are a helpful tutor.'
    const result = withLanguageStyleContract(base)
    expect(result.startsWith(base)).toBe(true)
    expect(result).not.toBe(base)
  })

  test('locks the reply language to the user instead of retrieved material', () => {
    const result = withLanguageStyleContract('Base prompt.')
    expect(result).toContain("user's latest non-trivial message")
    expect(result).toContain('short acknowledgement')
    expect(result).toContain('Do not choose the reply language')
    expect(result).toContain('attached images or their descriptions')
    expect(result).toContain('retrieved passages')
    expect(result).toContain('Use one reply language throughout')
    expect(result).toContain('Translate or paraphrase relevant tool material')
  })

  test('demands Swiss orthography: ss over ß and real umlauts', () => {
    const result = withLanguageStyleContract('Base prompt.')
    expect(result).toContain('"ss" instead of "ß"')
    expect(result).toContain('ä, ö, ü')
    expect(result).toContain('ae, oe or ue')
  })

  // Lecturer guidance and custom personas do not own language policy, so the
  // contract must hold without any cooperation from earlier prompt layers.
  test('applies to an arbitrary lecturer prompt without conditions', () => {
    const lecturerPrompt = 'Du bist ein strenger Quizmaster für MAT182.'
    const result = withLanguageStyleContract(lecturerPrompt)
    expect(result).toContain(lecturerPrompt)
    expect(result).toContain('Swiss Standard German')
  })

  test.each([
    ['empty', ''],
    ['whitespace-only', '   \n  '],
  ])('handles a %s base prompt without leading blank lines', (_label, base) => {
    const result = withLanguageStyleContract(base)
    expect(result.trim()).toBe(result)
    expect(result).toContain('Swiss Standard German')
  })
})

describe('REPLY_LANGUAGE_REMINDER', () => {
  test('is a non-empty system message', () => {
    expect(REPLY_LANGUAGE_REMINDER.role).toBe('system')
    expect(REPLY_LANGUAGE_REMINDER.content.length).toBeGreaterThan(0)
  })
})

describe('locked reply language', () => {
  test('keeps the unlocked contract and reminder when no language is locked', () => {
    expect(withLanguageStyleContract('Base prompt.', null)).toBe(
      withLanguageStyleContract('Base prompt.')
    )
    expect(replyLanguageReminder(null)).toBe(REPLY_LANGUAGE_REMINDER)
  })

  test.each([
    ['en', 'English'],
    ['de', 'German'],
  ] as const)('names the locked language %s in the contract and the reminder', (locale, name) => {
    const contract = withLanguageStyleContract('Base prompt.', locale)
    const reminder = replyLanguageReminder(locale)

    expect(contract).not.toBe(withLanguageStyleContract('Base prompt.'))
    expect(contract).toContain(name)
    // Swiss orthography still applies whenever the reply is German.
    expect(contract).toContain('Swiss Standard German')
    expect(reminder.role).toBe('system')
    expect(reminder.content).not.toBe(REPLY_LANGUAGE_REMINDER.content)
    expect(reminder.content).toContain(name)
  })

  test('puts the meeting clock before the language rule, which stays last', () => {
    const clockLine = '<SYNTHETIC-CLOCK>'
    const locked = replyLanguageReminder('en', clockLine)
    expect(locked.content.startsWith(clockLine)).toBe(true)
    expect(locked.content.endsWith(replyLanguageReminder('en').content)).toBe(
      true
    )

    const unlocked = replyLanguageReminder(null, clockLine)
    expect(unlocked.content.startsWith(clockLine)).toBe(true)
    expect(unlocked.content.endsWith(REPLY_LANGUAGE_REMINDER.content)).toBe(
      true
    )

    // Calculator modes keep their precision rule ahead of the same reminder.
    expect(
      stepReminder('quizzer', locked).content.endsWith(locked.content)
    ).toBe(true)
    expect(stepReminder('explainer', locked)).toBe(locked)
  })
})

describe('formatMeetingClock', () => {
  const firstMessageAt = new Date('2026-10-19T08:00:30Z')

  function clock(elapsedMinutes: number, currentTime: string | null = null) {
    return renderPromptTemplate('meeting-clock', {
      elapsedMinutes,
      currentTime,
      timeZone: 'Europe/Zurich',
    })
  }

  test('is absent while the clock is off', () => {
    expect(formatMeetingClock(null, firstMessageAt, new Date())).toBeNull()
  })

  test('counts whole minutes since the first participant message', () => {
    const now = new Date('2026-10-19T08:13:29Z')
    expect(formatMeetingClock('ELAPSED', firstMessageAt, now)).toBe(clock(12))
  })

  test('starts at zero without a first message or with clock skew', () => {
    const now = new Date('2026-10-19T08:00:00Z')
    expect(formatMeetingClock('ELAPSED', null, now)).toBe(clock(0))
    expect(formatMeetingClock('ELAPSED', firstMessageAt, now)).toBe(clock(0))
  })

  test('adds the current Zurich time of day when requested', () => {
    const now = new Date('2026-10-19T08:05:00Z')
    expect(formatMeetingClock('ELAPSED_AND_TIME', firstMessageAt, now)).toBe(
      clock(4, '10:05')
    )
  })
})

describe('readMeetingClock', () => {
  test('shows participants the minute and time the model receives', () => {
    const startedAt = new Date('2026-10-19T08:00:30Z')
    const serverNow = new Date('2026-10-19T08:05:10Z')
    // This browser runs 90 seconds behind the server.
    const skewMs = 90_000
    const clientNow = new Date(serverNow.getTime() - skewMs)

    const reading = readMeetingClock(startedAt, skewMs, clientNow)

    expect(
      renderPromptTemplate('meeting-clock', {
        elapsedMinutes: reading.elapsedMinutes,
        currentTime: reading.timeOfDay,
        timeZone: 'Europe/Zurich',
      })
    ).toBe(formatMeetingClock('ELAPSED_AND_TIME', startedAt, serverNow))
  })
})
