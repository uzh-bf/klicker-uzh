import {
  buildManageAssistantSkillsPrompt,
  selectManageAssistantSkills,
  STATIC_MANAGE_ASSISTANT_SKILLS,
  type ManageAssistantSkill,
} from '@/src/services/manageAssistantSkills'
import { describe, expect, test } from 'vitest'

const skills: ManageAssistantSkill[] = [
  {
    enabled: true,
    id: 'low',
    instructions: 'Low priority instructions.',
    name: 'Low Priority',
    priority: 10,
  },
  {
    enabled: false,
    id: 'disabled',
    instructions: 'This should not appear.',
    name: 'Disabled',
    priority: 100,
  },
  {
    enabled: true,
    id: 'high',
    instructions: 'High priority instructions.',
    name: 'High Priority',
    priority: 50,
  },
]

describe('Manage assistant skills', () => {
  test('selects enabled skills ordered by priority', () => {
    expect(
      selectManageAssistantSkills(skills).map((skill) => skill.id)
    ).toEqual(['high', 'low'])
  })

  test('builds a prompt without disabled skills', () => {
    const prompt = buildManageAssistantSkillsPrompt(skills)

    expect(prompt).toContain('Manage assistant skills')
    expect(prompt).toContain('High priority instructions.')
    expect(prompt).toContain('Low priority instructions.')
    expect(prompt).not.toContain('This should not appear.')
  })

  test('trims the skill prompt to the configured character budget', () => {
    const prompt = buildManageAssistantSkillsPrompt(
      [
        {
          enabled: true,
          id: 'long',
          instructions: 'A'.repeat(500),
          name: 'Long Skill',
          priority: 1,
        },
      ],
      { maxChars: 120 }
    )

    expect(prompt.length).toBeLessThanOrEqual(120)
    expect(prompt).toContain('[trimmed]')
  })

  test('default skills include documentation and media guidance', () => {
    const prompt = buildManageAssistantSkillsPrompt(
      STATIC_MANAGE_ASSISTANT_SKILLS
    )

    expect(prompt).toContain('Klicker Documentation Navigator')
    expect(prompt).toContain('https://www.klicker.uzh.ch/tutorials/live_quiz/')
    expect(prompt).toContain(
      'https://www.klicker.uzh.ch/use_cases/chatbot_tutoring/'
    )
    expect(prompt).toContain('entryId/0_ugtkafd3')
    expect(prompt).not.toContain('[trimmed]')
  })
})
