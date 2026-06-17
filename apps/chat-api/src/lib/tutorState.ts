import { generateText, Output } from 'ai'
import { z } from 'zod'

type PlannerModel = Parameters<typeof generateText>[0]['model']

const STUDENT_STATES = [
  'asking',
  'attempting',
  'correct',
  'partial',
  'incorrect',
  'unclear',
  'stuck',
  'off_task',
] as const

const ALLOWED_MOVES = [
  'ask',
  'hint',
  'simplify',
  'explain',
  'worked_micro_step',
  'self_explain',
  'reflect',
  'summarize',
] as const

const AFFECT_SIGNALS = [
  'neutral',
  'frustrated',
  'confident',
  'disengaged',
] as const

export type TutorTurnState = {
  skillPackVersion: string
  currentSkill?: string
  studentState: (typeof STUDENT_STATES)[number]
  firstError?: {
    step?: string
    explanation: string
  }
  misconception?: {
    id?: string
    label: string
    confidence: number
  }
  hintDepth: number
  allowedMove: (typeof ALLOWED_MOVES)[number]
  leakageAllowed: boolean
  retrievalNeeded: boolean
  retrievedEvidenceIds?: string[]
  affectSignal?: (typeof AFFECT_SIGNALS)[number]
  imageUncertainty?: boolean
}

export type TutorTurnStateResult = {
  state: TutorTurnState
  source: 'model' | 'heuristic'
  errorMessage?: string
}

export type TutorPlannerMessage = {
  role: 'user' | 'assistant'
  content: string
}

const TutorTurnStateModelSchema = z.object({
  skillPackVersion: z.string(),
  currentSkill: z.string().nullable(),
  studentState: z.enum(STUDENT_STATES),
  firstError: z
    .object({
      step: z.string().nullable(),
      explanation: z.string(),
    })
    .nullable(),
  misconception: z
    .object({
      id: z.string().nullable(),
      label: z.string(),
      confidence: z.number(),
    })
    .nullable(),
  hintDepth: z.number().int().min(0).max(5),
  allowedMove: z.enum(ALLOWED_MOVES),
  leakageAllowed: z.boolean(),
  retrievalNeeded: z.boolean(),
  retrievedEvidenceIds: z.array(z.string()).nullable(),
  affectSignal: z.enum(AFFECT_SIGNALS).nullable(),
  imageUncertainty: z.boolean(),
})

const PLANNER_SYSTEM_PROMPT = `You classify the hidden state for a university tutoring turn.
Return only the requested structured object.
Do not solve the student's problem.
Prefer the first pedagogically useful error or missing idea over later errors.
Mark leakageAllowed true only when the student explicitly asks for a final answer after showing work, asks to verify an answer, or the next useful move requires a worked micro-step.`

function latestUserMessage(messages: TutorPlannerMessage[]) {
  return [...messages].reverse().find((message) => message.role === 'user')
}

function lowerLatestUserContent(messages: TutorPlannerMessage[]) {
  return latestUserMessage(messages)?.content.toLowerCase() ?? ''
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0.5
  return Math.max(0, Math.min(1, value))
}

function normalizeTutorTurnState(
  raw: z.infer<typeof TutorTurnStateModelSchema>,
  skillPackVersion: string
): TutorTurnState {
  return {
    skillPackVersion,
    ...(raw.currentSkill ? { currentSkill: raw.currentSkill } : {}),
    studentState: raw.studentState,
    ...(raw.firstError
      ? {
          firstError: {
            ...(raw.firstError.step ? { step: raw.firstError.step } : {}),
            explanation: raw.firstError.explanation,
          },
        }
      : {}),
    ...(raw.misconception
      ? {
          misconception: {
            ...(raw.misconception.id ? { id: raw.misconception.id } : {}),
            label: raw.misconception.label,
            confidence: clampConfidence(raw.misconception.confidence),
          },
        }
      : {}),
    hintDepth: raw.hintDepth,
    allowedMove: raw.allowedMove,
    leakageAllowed: raw.leakageAllowed,
    retrievalNeeded: raw.retrievalNeeded,
    ...(raw.retrievedEvidenceIds && raw.retrievedEvidenceIds.length > 0
      ? { retrievedEvidenceIds: raw.retrievedEvidenceIds }
      : {}),
    ...(raw.affectSignal ? { affectSignal: raw.affectSignal } : {}),
    imageUncertainty: raw.imageUncertainty,
  }
}

function inferStudentState(content: string): TutorTurnState['studentState'] {
  if (
    /\b(weather|movie|joke|song|restaurant|travel)\b/.test(content) &&
    !/\b(finance|math|wacc|capm|bond|portfolio|kurs)\b/.test(content)
  ) {
    return 'off_task'
  }
  if (
    /verstehe[^.?!]{0,80}nicht|keine ahnung|ich stecke|stuck|lost|confused|help/.test(
      content
    )
  ) {
    return 'stuck'
  }
  if (/stimmt|richtig|correct|check|überprüf|verify/.test(content)) {
    return 'partial'
  }
  if (/fehler|falsch|wrong|incorrect|mistake/.test(content)) {
    return 'incorrect'
  }
  if (/\bstep\b|schritt|\d+\s*[+\-*/=]|\$.*\$/.test(content)) {
    return 'attempting'
  }
  if (content.includes('?')) return 'asking'
  return 'unclear'
}

function inferAllowedMove(
  studentState: TutorTurnState['studentState']
): TutorTurnState['allowedMove'] {
  switch (studentState) {
    case 'stuck':
      return 'simplify'
    case 'incorrect':
    case 'partial':
      return 'hint'
    case 'attempting':
      return 'self_explain'
    case 'off_task':
      return 'summarize'
    case 'correct':
      return 'reflect'
    case 'asking':
      return 'explain'
    default:
      return 'ask'
  }
}

function inferAffect(content: string): TutorTurnState['affectSignal'] {
  if (/frustriert|frustrated|nervig|annoying|geht nicht/.test(content)) {
    return 'frustrated'
  }
  if (/sicher|confident|easy|klar/.test(content)) return 'confident'
  if (/egal|whatever|keine lust|don't care/.test(content)) return 'disengaged'
  return 'neutral'
}

function inferLeakageAllowed(content: string) {
  const asksForAnswer =
    /lösung|answer|final|resultat|ergebnis|solve|gib mir/.test(content)
  const showsWork = /\bstep\b|schritt|\d+\s*[+\-*/=]|\$.*\$/.test(content)
  const asksForCheck = /stimmt|richtig|correct|check|überprüf|verify/.test(
    content
  )
  return asksForCheck || (asksForAnswer && showsWork)
}

function inferRetrievalNeeded(content: string) {
  return /skript|folie|slide|lecture|vorlesung|financewiki|quelle|reference|citation|kurs|wacc|capm|bond|portfolio/.test(
    content
  )
}

function inferHintDepth(messages: TutorPlannerMessage[]) {
  const assistantTurns = messages.filter(
    (message) => message.role === 'assistant'
  )
  const hints = assistantTurns.filter((message) =>
    /hint|hinweis|schritt|try|versuch/i.test(message.content)
  )
  return Math.min(5, hints.length)
}

export function buildHeuristicTutorTurnState({
  messages,
  skillPackVersion,
}: {
  messages: TutorPlannerMessage[]
  skillPackVersion: string
}): TutorTurnState {
  const content = lowerLatestUserContent(messages)
  const studentState = inferStudentState(content)
  return {
    skillPackVersion,
    studentState,
    hintDepth: inferHintDepth(messages),
    allowedMove: inferAllowedMove(studentState),
    leakageAllowed: inferLeakageAllowed(content),
    retrievalNeeded: inferRetrievalNeeded(content),
    affectSignal: inferAffect(content),
    imageUncertainty:
      content.includes('[attached image') &&
      /unclear|nicht lesbar|can't read|ambiguous/.test(content),
  }
}

function formatPlannerMessages(messages: TutorPlannerMessage[]) {
  return messages
    .slice(-6)
    .map((message) => {
      const content =
        message.content.length > 1200
          ? `${message.content.slice(0, 1200)}...`
          : message.content
      return `${message.role.toUpperCase()}: ${content}`
    })
    .join('\n\n')
}

export async function planTutorTurnState({
  messages,
  model,
  providerOptions,
  skillPackVersion,
}: {
  messages: TutorPlannerMessage[]
  model: PlannerModel
  providerOptions?: Parameters<typeof generateText>[0]['providerOptions']
  skillPackVersion: string
}): Promise<TutorTurnStateResult> {
  try {
    const result = await generateText({
      model,
      system: PLANNER_SYSTEM_PROMPT,
      prompt: [
        `Skill pack version: ${skillPackVersion}`,
        'Recent conversation:',
        formatPlannerMessages(messages),
      ].join('\n\n'),
      output: Output.object({ schema: TutorTurnStateModelSchema }),
      maxOutputTokens: 600,
      temperature: 0,
      providerOptions,
    })

    return {
      state: normalizeTutorTurnState(result.output, skillPackVersion),
      source: 'model',
    }
  } catch (error) {
    return {
      state: buildHeuristicTutorTurnState({ messages, skillPackVersion }),
      source: 'heuristic',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}

export function isTutorMode(mode: string) {
  return mode.toLowerCase().startsWith('tutor')
}
