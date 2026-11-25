import { parseArguments } from '../src/cli/arguments.js'

const QUIZ = '11111111-1111-4111-8111-111111111111'
const PARTICIPANT = '22222222-2222-4222-8222-222222222222'

describe('owner audit CLI arguments', () => {
  it('normalizes uppercase UUIDs to the stored lowercase form', () => {
    expect(
      parseArguments([
        'export',
        '--live-quiz-id',
        QUIZ.toUpperCase(),
        '--participant-id',
        PARTICIPANT.toUpperCase(),
        '--output',
        'export.json',
      ])
    ).toMatchObject({ liveQuizId: QUIZ, participantId: PARTICIPANT })
    expect(
      parseArguments(['verify', '--event-id', QUIZ.toUpperCase()])
    ).toMatchObject({ eventId: QUIZ })
  })

  it('still rejects values that are not UUIDs', () => {
    expect(() =>
      parseArguments(['verify', '--event-id', 'not-a-uuid'])
    ).toThrow('event ID must be a UUID')
  })
})
