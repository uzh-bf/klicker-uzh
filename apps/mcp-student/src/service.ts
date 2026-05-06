import type { StudentMcpSession } from './auth.js'
import type { StudentPracticeBackend } from './backend.js'
import {
  assertQuestionRefMatchesStack,
  rankPracticeStacks,
  toSafeStackRenderPayload,
  validateCompleteStackSubmission,
} from './practice.js'
import {
  createQuestionRefSync,
  verifyQuestionRef,
  type QuestionRefCodecOptions,
} from './questionRef.js'
import type {
  Candidate,
  PracticeQuiz,
  PracticeStack,
  QuestionRefPayload,
  SafeStackRenderPayload,
  StackResponseInput,
} from './types.js'

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
    await this.backend.assertChatbotCourseAccess({
      chatbotId: input.chatbotId,
      courseId: input.courseId,
      participantId: session.participantId,
    })

    const practiceQuiz = await this.loadPracticeQuiz(
      input.courseId,
      session.participantId
    )
    const query = `${input.conversationSummary ?? ''}\n${input.lastUserMessage}`
    const limit = Math.min(Math.max(input.limit ?? 3, 1), 5)

    return {
      candidates: rankPracticeStacks({
        chatbotId: input.chatbotId,
        courseId: input.courseId,
        createQuestionRef: (payload) =>
          createQuestionRefSync(payload, this.questionRefOptions),
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
    courseId: string,
    participantId: string
  ): Promise<PracticeQuiz> {
    const practiceQuiz = await this.backend.getCoursePracticeQuiz(
      courseId,
      participantId
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

    await this.backend.assertChatbotCourseAccess({
      chatbotId: ref.chatbotId,
      courseId: ref.courseId,
      participantId: session.participantId,
    })

    const practiceQuiz = await this.loadPracticeQuiz(
      ref.courseId,
      session.participantId
    )
    const stack = this.findEligibleStack(practiceQuiz, ref.stackId)
    assertQuestionRefMatchesStack(ref, stack)

    return { ref, stack }
  }
}
