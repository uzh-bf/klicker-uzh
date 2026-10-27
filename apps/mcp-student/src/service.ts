import type {
  StudentMcpCandidate as Candidate,
  StudentMcpPracticeQuiz as PracticeQuiz,
  StudentMcpPracticeStack as PracticeStack,
  StudentMcpQuestionRefPayload as QuestionRefPayload,
  StudentMcpSafeStackRenderPayload as SafeStackRenderPayload,
  StudentMcpStackResponseInput as StackResponseInput,
} from '@klicker-uzh/types'
import type { StudentMcpSession } from './auth.js'
import type { SubmitStackAnswerInput } from './graphqlClient.js'
import {
  assertQuestionRefMatchesStack,
  rankPracticeStacks,
  toSafeStackRenderPayload,
  validateCompleteStackSubmission,
} from './practice.js'
import {
  createQuestionRefSync,
  getQuestionRefExpiresAt,
  verifyQuestionRef,
  type QuestionRefCodecOptions,
} from './questionRef.js'

type CoursePracticeQuizInput = {
  chatbotId: string
  courseId: string
}

type StudentPracticeBackend = {
  getCoursePracticeQuiz(
    input: CoursePracticeQuizInput,
    bearerToken: string
  ): Promise<PracticeQuiz | null>
  submitStackAnswer(
    input: SubmitStackAnswerInput,
    bearerToken: string
  ): Promise<unknown>
}

export type LookupRelevantPracticeStacksInput = {
  chatbotId: string
  conversationSummary?: string
  courseId: string
  lastUserMessage: string
  limit?: number
}

export type LookupRelevantPracticeStacksOutput = {
  candidates: Candidate[]
}

export type GetPracticeStackForQuizInput = {
  questionRef: string
}

export type GetPracticeStackForQuizOutput = {
  chatbotId: string
  courseId: string
  expiresAt: string
  questionRef: string
  stack: SafeStackRenderPayload
}

export type SubmitPracticeStackAnswerInput = {
  questionRef: string
  responses: StackResponseInput[]
  stackAnswerTimeSeconds: number
}

export type SubmitPracticeStackAnswerOutput = {
  chatbotId: string
  courseId: string
  result: unknown
  stackId: number
}

export class StudentPracticeService {
  constructor(
    private readonly backend: StudentPracticeBackend,
    private readonly questionRefOptions: QuestionRefCodecOptions
  ) {}

  async lookupRelevantPracticeStacks(
    input: LookupRelevantPracticeStacksInput,
    session: StudentMcpSession
  ): Promise<LookupRelevantPracticeStacksOutput> {
    const practiceQuiz = await this.loadPracticeQuiz(
      {
        chatbotId: input.chatbotId,
        courseId: input.courseId,
      },
      session.bearerToken
    )
    const query = `${input.conversationSummary ?? ''}\n${input.lastUserMessage}`
    const limit = Math.min(Math.max(input.limit ?? 3, 1), 5)

    return {
      candidates: rankPracticeStacks({
        chatbotId: input.chatbotId,
        courseId: input.courseId,
        createQuestionRef: (payload) =>
          createQuestionRefSync(payload, this.questionRefOptions),
        getQuestionRefExpiresAt,
        limit,
        participantId: session.participantId,
        practiceQuiz,
        query,
      }),
    }
  }

  async getPracticeStackForQuiz(
    input: GetPracticeStackForQuizInput,
    session: StudentMcpSession
  ): Promise<GetPracticeStackForQuizOutput> {
    const { ref, stack } = await this.resolveReferencedStack(
      input.questionRef,
      session
    )

    return {
      chatbotId: ref.chatbotId,
      courseId: ref.courseId,
      expiresAt: getQuestionRefExpiresAt(input.questionRef),
      questionRef: input.questionRef,
      stack: toSafeStackRenderPayload(stack),
    }
  }

  async submitPracticeStackAnswer(
    input: SubmitPracticeStackAnswerInput,
    session: StudentMcpSession
  ): Promise<SubmitPracticeStackAnswerOutput> {
    const { ref } = await this.resolveReferencedStack(
      input.questionRef,
      session
    )
    validateCompleteStackSubmission(ref, input.responses)

    const result = await this.backend.submitStackAnswer(
      {
        courseId: ref.courseId,
        responses: input.responses,
        stackAnswerTimeSeconds: input.stackAnswerTimeSeconds,
        stackId: ref.stackId,
      },
      session.bearerToken
    )

    return {
      chatbotId: ref.chatbotId,
      courseId: ref.courseId,
      result,
      stackId: ref.stackId,
    }
  }

  private async loadPracticeQuiz(
    input: { chatbotId: string; courseId: string },
    bearerToken: string
  ): Promise<PracticeQuiz> {
    const practiceQuiz = await this.backend.getCoursePracticeQuiz(
      input,
      bearerToken
    )
    if (!practiceQuiz) {
      throw new Error('No practice pool is available for this course')
    }
    return practiceQuiz
  }

  private findEligibleStack(
    practiceQuiz: PracticeQuiz,
    stackId: number
  ): PracticeStack {
    const stack = practiceQuiz.stacks?.find(
      (candidate) => candidate.id === stackId
    )
    if (!stack) {
      throw new Error('Referenced practice stack is no longer eligible')
    }
    return stack
  }

  private async resolveReferencedStack(
    questionRef: string,
    session: StudentMcpSession
  ): Promise<{ ref: QuestionRefPayload; stack: PracticeStack }> {
    const ref = await verifyQuestionRef(
      questionRef,
      { participantId: session.participantId },
      this.questionRefOptions
    )

    const practiceQuiz = await this.loadPracticeQuiz(
      {
        chatbotId: ref.chatbotId,
        courseId: ref.courseId,
      },
      session.bearerToken
    )
    const stack = this.findEligibleStack(practiceQuiz, ref.stackId)
    assertQuestionRefMatchesStack(ref, stack)

    return { ref, stack }
  }
}
