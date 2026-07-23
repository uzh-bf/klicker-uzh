import * as DB from '@klicker-uzh/prisma/client'
import type {
  CodePublicTestResult as CodePublicTestResultType,
  CodeSubmissionFeedback as CodeSubmissionFeedbackType,
  CodeSubmissionReceipt as CodeSubmissionReceiptType,
  CodeTestEvaluation as CodeTestEvaluationType,
} from '@klicker-uzh/types'
import builder from '../builder.js'

export const CodeSubmissionStatus = builder.enumType('CodeSubmissionStatus', {
  values: Object.values(DB.CodeSubmissionStatus),
})

export const CodeTestEvaluation = builder
  .objectRef<CodeTestEvaluationType>('CodeTestEvaluation')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
      passedCount: t.exposeInt('passedCount'),
      totalCount: t.exposeInt('totalCount'),
    }),
  })

export const CodePublicTestResult = builder
  .objectRef<CodePublicTestResultType>('CodePublicTestResult')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
      passed: t.exposeBoolean('passed'),
      actualOutput: t.expose('actualOutput', {
        type: 'Json',
        nullable: true,
      }),
      stdout: t.exposeString('stdout', { nullable: true }),
      stderr: t.exposeString('stderr', { nullable: true }),
    }),
  })

export const CodeSubmissionFeedback = builder
  .objectRef<CodeSubmissionFeedbackType>('CodeSubmissionFeedback')
  .implement({
    fields: (t) => ({
      pointsPercentage: t.exposeFloat('pointsPercentage'),
      publicTestResults: t.expose('publicTestResults', {
        type: [CodePublicTestResult],
      }),
    }),
  })

export const CodeSubmissionReceipt = builder
  .objectRef<CodeSubmissionReceiptType>('CodeSubmissionReceipt')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      gradingStatus: t.expose('gradingStatus', {
        type: CodeSubmissionStatus,
      }),
      feedback: t.expose('feedback', {
        type: CodeSubmissionFeedback,
        nullable: true,
      }),
    }),
  })
