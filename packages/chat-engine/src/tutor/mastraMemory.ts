import type { AgentMemoryOption } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { PostgresStore } from '@mastra/pg'
import type { TutorMemoryGateDecision } from './memoryGate.js'

export const TUTOR_WORKING_MEMORY_TEMPLATE = `# Course Learner State

## Current Course
- course_id:
- chatbot_id:
- active_topic:

## Skill State
- current_skill:
- prerequisite_gaps:
- mastery_estimates:

## Tutoring State
- last_misconception:
- current_hint_depth:
- last_tutor_move:
- unresolved_question:

## Preferences
- language:
- explanation_depth:
- formula_style:
`

export type TutorMastraMemoryRuntime = {
  status: 'enabled' | 'inactive'
  reason: string
  agentMemory?: Memory
  runMemory?: AgentMemoryOption
}

export type TutorMastraMemoryOptions = {
  decision: TutorMemoryGateDecision
  connectionString?: string
  participantId: string
  chatbotId: string
  courseId?: string
  threadId?: string | null
}

function tutorMemoryResourceId({
  participantId,
  chatbotId,
  courseId,
}: Pick<TutorMastraMemoryOptions, 'participantId' | 'chatbotId' | 'courseId'>) {
  return [
    'participant',
    participantId,
    'chatbot',
    chatbotId,
    'course',
    courseId ?? 'none',
  ].join(':')
}

export function buildTutorMastraMemoryRuntime({
  decision,
  connectionString,
  participantId,
  chatbotId,
  courseId,
  threadId,
}: TutorMastraMemoryOptions): TutorMastraMemoryRuntime {
  if (decision.status !== 'enabled') {
    return {
      status: 'inactive',
      reason: `Tutor memory gate is ${decision.status}.`,
    }
  }
  if (!connectionString) {
    return {
      status: 'inactive',
      reason: 'DATABASE_URL is required for Mastra tutor memory.',
    }
  }
  if (!threadId) {
    return {
      status: 'inactive',
      reason: 'A chat thread id is required for Mastra tutor memory.',
    }
  }

  const options = {
    lastMessages: 6,
    semanticRecall: false,
    workingMemory: {
      enabled: true,
      scope: 'resource' as const,
      template: TUTOR_WORKING_MEMORY_TEMPLATE,
    },
  }
  const resource = tutorMemoryResourceId({ participantId, chatbotId, courseId })

  return {
    status: 'enabled',
    reason:
      'Mastra tutor memory is enabled for participant+chatbot+course scope.',
    agentMemory: new Memory({
      storage: new PostgresStore({
        id: 'klicker-tutor-memory',
        connectionString,
      }),
      options,
    }),
    runMemory: {
      resource,
      thread: {
        id: threadId,
        title: 'Tutor chat',
        metadata: {
          participantId,
          chatbotId,
          courseId: courseId ?? null,
          scope: 'participant_chatbot_course',
        },
      },
      options,
    },
  }
}
