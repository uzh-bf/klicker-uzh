import { describe, expect, test } from 'vitest'
import {
  formatKlickerChatContextForPrompt,
  getKlickerChatContextLabel,
  sanitizeKlickerChatContext,
} from '../src/services/chatContext'

describe('Klicker chat context', () => {
  test('keeps answer-safe page context and strips unsupported fields', () => {
    const context = sanitizeKlickerChatContext({
      version: 1,
      source: 'pwa',
      surface: 'practice-quiz',
      locale: 'en',
      courseId: 'course-1',
      activity: {
        type: 'practiceQuiz',
        id: 'quiz-1',
        displayName: 'Week 1',
      },
      question: {
        stackId: '10',
        elementInstanceId: 20,
        type: 'SC',
        contentPreview: 'Which option describes opportunity cost?',
        currentStep: 2,
        totalSteps: 5,
        solution: 'secret',
        sampleSolution: 'secret',
      },
    })

    expect(context).toEqual({
      version: 1,
      source: 'pwa',
      surface: 'practice-quiz',
      locale: 'en',
      courseId: 'course-1',
      activity: {
        type: 'practiceQuiz',
        id: 'quiz-1',
        displayName: 'Week 1',
      },
      question: {
        stackId: '10',
        elementInstanceId: 20,
        type: 'SC',
        contentPreview: 'Which option describes opportunity cost?',
        currentStep: 2,
        totalSteps: 5,
      },
    })
    expect(JSON.stringify(context)).not.toContain('secret')
  })

  test('formats context for the model without exposing forbidden keys', () => {
    const prompt = formatKlickerChatContextForPrompt({
      version: 1,
      source: 'pwa',
      surface: 'practice-quiz',
      locale: 'en',
      courseId: 'course-1',
      activity: {
        type: 'practiceQuiz',
        id: 'quiz-1',
        displayName: 'Week 1',
      },
      question: {
        stackId: '10',
        elementInstanceId: 20,
        type: 'SC',
        contentPreview: 'Which option describes opportunity cost?',
        currentStep: 2,
        totalSteps: 5,
      },
    })

    expect(prompt).toContain('Surface: practice-quiz')
    expect(prompt).toContain('Activity: practiceQuiz "Week 1"')
    expect(prompt).toContain('Question: step 2 of 5')
    expect(prompt).toContain('Question preview: Which option describes')
    expect(prompt).not.toMatch(/solution|correct answer|grading/i)
  })

  test('builds a compact user-facing label', () => {
    expect(
      getKlickerChatContextLabel({
        version: 1,
        source: 'pwa',
        surface: 'practice-quiz',
        locale: 'en',
        courseId: 'course-1',
        activity: { type: 'practiceQuiz', id: 'quiz-1' },
        question: { currentStep: 2, totalSteps: 5 },
      })
    ).toBe('Practice quiz - Question 2/5')
  })
})
