import * as DB from '@klicker-uzh/prisma/client'
import * as AdaptivePracticeQuizRuntimeService from '../services/adaptivePracticeQuizzes.js'
import * as CompetenceTreeCalibrationService from '../services/competenceTreeCalibration.js'
import * as CompetenceTreeService from '../services/competenceTreeManagement.js'
import * as CourseService from '../services/adaptiveCourseCommands.js'
import type { createAdaptivePracticeQuizRuntimeSchema } from './adaptivePracticeQuizRuntime.js'
import type { createCompetenceTreeSchema } from './competenceTree.js'
import type { createCompetenceTreeCalibrationSchema } from './competenceTreeCalibration.js'
import type { AdaptiveSchemaBuilder } from '@klicker-uzh/graphql/adaptive-schema-host-types'
type FieldBuilder = Parameters<
  Parameters<AdaptiveSchemaBuilder['mutationFields']>[0]
>[0]

export function adaptiveMutationFields(
  t: FieldBuilder,
  {
    AdaptivePracticeQuizAttemptStateRef,
    AdaptivePracticeQuizResponseInput,
    CompetenceTree,
    CompetenceTreeElementAssignmentUpdateInput,
    CompetenceTreeInput,
    CompetenceTreeMetadataInput,
    DuplicateCompetenceTreeInput,
    AdaptiveCalibrationExportRequestRef,
    AdaptiveCalibrationImportReceiptRef,
    AdaptiveReviewDecision,
    AdaptiveWorkflowReceiptRef,
    CompetenceTreeScaleLevelInput,
    Course,
  }: {
    AdaptivePracticeQuizAttemptStateRef: ReturnType<
      typeof createAdaptivePracticeQuizRuntimeSchema
    >['AdaptivePracticeQuizAttemptStateRef']
    AdaptivePracticeQuizResponseInput: ReturnType<
      typeof createAdaptivePracticeQuizRuntimeSchema
    >['AdaptivePracticeQuizResponseInput']
    CompetenceTree: ReturnType<
      typeof createCompetenceTreeSchema
    >['CompetenceTree']
    CompetenceTreeElementAssignmentUpdateInput: ReturnType<
      typeof createCompetenceTreeSchema
    >['CompetenceTreeElementAssignmentUpdateInput']
    CompetenceTreeInput: ReturnType<
      typeof createCompetenceTreeSchema
    >['CompetenceTreeInput']
    CompetenceTreeMetadataInput: ReturnType<
      typeof createCompetenceTreeSchema
    >['CompetenceTreeMetadataInput']
    DuplicateCompetenceTreeInput: ReturnType<
      typeof createCompetenceTreeSchema
    >['DuplicateCompetenceTreeInput']
    AdaptiveCalibrationExportRequestRef: ReturnType<
      typeof createCompetenceTreeCalibrationSchema
    >['AdaptiveCalibrationExportRequestRef']
    AdaptiveCalibrationImportReceiptRef: ReturnType<
      typeof createCompetenceTreeCalibrationSchema
    >['AdaptiveCalibrationImportReceiptRef']
    AdaptiveReviewDecision: ReturnType<
      typeof createCompetenceTreeCalibrationSchema
    >['AdaptiveReviewDecision']
    AdaptiveWorkflowReceiptRef: ReturnType<
      typeof createCompetenceTreeCalibrationSchema
    >['AdaptiveWorkflowReceiptRef']
    CompetenceTreeScaleLevelInput: ReturnType<
      typeof createCompetenceTreeCalibrationSchema
    >['CompetenceTreeScaleLevelInput']
    Course: typeof import('@klicker-uzh/graphql/adaptive-schema-host-types')['Course']
  }
) {
  const asParticipant = { authenticated: true, role: DB.UserRole.PARTICIPANT }
  const asUser = { authenticated: true, role: DB.UserRole.USER }
  const asAdmin = { authenticated: true, role: DB.UserRole.ADMIN }
  const asUserFullAccess = { ...asUser, scope: DB.UserLoginScope.FULL_ACCESS }
  return {
    startAdaptivePracticeQuizAttempt: t.withAuth(asParticipant).field({
      nullable: false,
      type: AdaptivePracticeQuizAttemptStateRef,
      args: {
        practiceQuizId: t.arg.string({ required: true }),
      },
      resolve: async (_, args, ctx) =>
        await AdaptivePracticeQuizRuntimeService.startAdaptivePracticeQuizAttempt(
          args,
          ctx
        ),
    }),

    resumeAdaptivePracticeQuizAttempt: t.withAuth(asParticipant).field({
      nullable: false,
      type: AdaptivePracticeQuizAttemptStateRef,
      args: {
        attemptId: t.arg.string({ required: true }),
      },
      resolve: async (_, args, ctx) =>
        await AdaptivePracticeQuizRuntimeService.resumeAdaptivePracticeQuizAttempt(
          args,
          ctx
        ),
    }),

    restartAdaptivePracticeQuizAttempt: t.withAuth(asParticipant).field({
      nullable: false,
      type: AdaptivePracticeQuizAttemptStateRef,
      args: {
        attemptId: t.arg.string({ required: true }),
      },
      resolve: async (_, args, ctx) =>
        await AdaptivePracticeQuizRuntimeService.restartAdaptivePracticeQuizAttempt(
          args,
          ctx
        ),
    }),

    submitAdaptivePracticeQuizResponse: t.withAuth(asParticipant).field({
      nullable: false,
      type: AdaptivePracticeQuizAttemptStateRef,
      args: {
        attemptId: t.arg.string({ required: true }),
        servedItemId: t.arg.int({ required: true }),
        response: t.arg({
          type: AdaptivePracticeQuizResponseInput,
          required: true,
        }),
        elapsedSeconds: t.arg.int({ required: false }),
      },
      resolve: async (_, args, ctx) =>
        await AdaptivePracticeQuizRuntimeService.submitAdaptivePracticeQuizResponse(
          args,
          ctx
        ),
    }),

    abandonAdaptivePracticeQuizAttempt: t.withAuth(asParticipant).field({
      nullable: false,
      type: AdaptivePracticeQuizAttemptStateRef,
      args: {
        attemptId: t.arg.string({ required: true }),
      },
      resolve: async (_, args, ctx) =>
        await AdaptivePracticeQuizRuntimeService.abandonAdaptivePracticeQuizAttempt(
          args,
          ctx
        ),
    }),

    createCompetenceTree: t.withAuth(asUserFullAccess).field({
      type: CompetenceTree,
      args: {
        input: t.arg({ type: CompetenceTreeInput, required: true }),
      },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.createCompetenceTree(args, ctx),
    }),

    createCompetenceTreeScaleVersion: t.withAuth(asUserFullAccess).field({
      type: AdaptiveWorkflowReceiptRef,
      args: {
        treeId: t.arg.string({ required: true }),
        supersedesVersionId: t.arg.string({ required: false }),
        priorMean: t.arg.float({ required: false }),
        priorStandardDeviation: t.arg.float({ required: false }),
        gridMin: t.arg.float({ required: false }),
        gridMax: t.arg.float({ required: false }),
        gridStep: t.arg.float({ required: false }),
        classificationPolicyVersion: t.arg.int({ required: false }),
        levels: t.arg({
          type: [CompetenceTreeScaleLevelInput],
          required: false,
        }),
      },
      resolve: async (_, args, ctx) => {
        const scale =
          await CompetenceTreeCalibrationService.createCompetenceTreeScaleVersion(
            {
              treeId: args.treeId,
              supersedesVersionId: args.supersedesVersionId,
              priorMean: args.priorMean ?? undefined,
              priorStandardDeviation: args.priorStandardDeviation ?? undefined,
              gridMin: args.gridMin ?? undefined,
              gridMax: args.gridMax ?? undefined,
              gridStep: args.gridStep ?? undefined,
              classificationPolicyVersion:
                args.classificationPolicyVersion ?? undefined,
              levels: args.levels,
            },
            ctx
          )
        return { id: scale.id, status: scale.status }
      },
    }),

    submitCompetenceTreeScaleForReview: t.withAuth(asUserFullAccess).field({
      type: AdaptiveWorkflowReceiptRef,
      args: { artifact: t.arg({ type: 'Json', required: true }) },
      resolve: async (_, { artifact }, ctx) => {
        const approval =
          await CompetenceTreeCalibrationService.submitCompetenceTreeScaleForReview(
            artifact,
            ctx
          )
        return { id: approval.scaleVersionId, status: 'IN_REVIEW' }
      },
    }),

    reviewCompetenceTreeScale: t.withAuth(asAdmin).field({
      type: AdaptiveWorkflowReceiptRef,
      args: {
        scaleVersionId: t.arg.string({ required: true }),
        decision: t.arg({ type: AdaptiveReviewDecision, required: true }),
      },
      resolve: async (_, args, ctx) => {
        const scale =
          await CompetenceTreeCalibrationService.reviewCompetenceTreeScale(
            args,
            ctx
          )
        return { id: scale.id, status: scale.status }
      },
    }),

    activateCompetenceTreeScaleVersion: t.withAuth(asUserFullAccess).field({
      type: AdaptiveWorkflowReceiptRef,
      args: { scaleVersionId: t.arg.string({ required: true }) },
      resolve: async (_, args, ctx) => {
        const scale =
          await CompetenceTreeCalibrationService.activateCompetenceTreeScaleVersion(
            args,
            ctx
          )
        return { id: scale.id, status: scale.status }
      },
    }),

    submitCompetenceTreeScaleLink: t.withAuth(asUserFullAccess).field({
      type: AdaptiveWorkflowReceiptRef,
      args: { artifact: t.arg({ type: 'Json', required: true }) },
      resolve: async (_, { artifact }, ctx) => {
        const link =
          await CompetenceTreeCalibrationService.submitCompetenceTreeScaleLink(
            artifact,
            ctx
          )
        return { id: link.id, status: link.status }
      },
    }),

    reviewCompetenceTreeScaleLink: t.withAuth(asAdmin).field({
      type: AdaptiveWorkflowReceiptRef,
      args: {
        scaleLinkId: t.arg.string({ required: true }),
        decision: t.arg({ type: AdaptiveReviewDecision, required: true }),
      },
      resolve: async (_, args, ctx) => {
        const link =
          await CompetenceTreeCalibrationService.reviewCompetenceTreeScaleLink(
            args,
            ctx
          )
        return { id: link.id, status: link.status }
      },
    }),

    importAdaptiveItemCalibrations: t.withAuth(asUserFullAccess).field({
      type: AdaptiveCalibrationImportReceiptRef,
      args: { artifact: t.arg({ type: 'Json', required: true }) },
      resolve: async (_, { artifact }, ctx) => {
        const calibrations =
          await CompetenceTreeCalibrationService.submitAdaptiveItemCalibrationCandidates(
            artifact,
            ctx
          )
        return {
          calibrationIds: calibrations.map(({ id }) => id),
          importedCount: calibrations.length,
        }
      },
    }),

    approveAdaptiveItemCalibration: t.withAuth(asAdmin).field({
      type: AdaptiveWorkflowReceiptRef,
      args: { calibrationId: t.arg.string({ required: true }) },
      resolve: async (_, args, ctx) => {
        const calibration =
          await CompetenceTreeCalibrationService.approveAdaptiveItemCalibration(
            args,
            ctx
          )
        return { id: calibration.id, status: calibration.status }
      },
    }),

    submitAdaptiveEmpiricalValidation: t.withAuth(asUserFullAccess).field({
      type: AdaptiveWorkflowReceiptRef,
      args: { artifact: t.arg({ type: 'Json', required: true }) },
      resolve: async (_, { artifact }, ctx) => {
        const validation =
          await CompetenceTreeCalibrationService.submitAdaptiveEmpiricalValidation(
            artifact,
            ctx
          )
        return { id: validation.id, status: validation.status }
      },
    }),

    reviewAdaptiveEmpiricalValidation: t.withAuth(asAdmin).field({
      type: AdaptiveWorkflowReceiptRef,
      args: {
        validationId: t.arg.string({ required: true }),
        decision: t.arg({ type: AdaptiveReviewDecision, required: true }),
      },
      resolve: async (_, args, ctx) => {
        const validation =
          await CompetenceTreeCalibrationService.reviewAdaptiveEmpiricalValidation(
            args,
            ctx
          )
        return { id: validation.id, status: validation.status }
      },
    }),

    setCourseAdaptiveCalibrationCollectionEnabled: t.withAuth(asAdmin).boolean({
      args: {
        courseId: t.arg.string({ required: true }),
        enabled: t.arg.boolean({ required: true }),
      },
      resolve: async (_, args, ctx) => {
        const course =
          await CompetenceTreeCalibrationService.setCourseAdaptiveCalibrationCollectionEnabled(
            args,
            ctx
          )
        return course.isAdaptiveLearningCalibrationEnabled
      },
    }),

    requestAdaptiveCalibrationExport: t.withAuth(asUserFullAccess).field({
      type: AdaptiveCalibrationExportRequestRef,
      args: {
        treeId: t.arg.string({ required: true }),
        scaleVersionId: t.arg.string({ required: true }),
        datasetVersion: t.arg.string({ required: true }),
      },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeCalibrationService.requestAdaptiveCalibrationExport(
          args,
          ctx
        ),
    }),

    replaceCompetenceTree: t.withAuth(asUserFullAccess).field({
      type: CompetenceTree,
      args: {
        id: t.arg.string({ required: true }),
        input: t.arg({ type: CompetenceTreeInput, required: true }),
      },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.replaceCompetenceTree(args, ctx),
    }),

    updateCompetenceTreeMetadata: t.withAuth(asUserFullAccess).field({
      type: CompetenceTree,
      args: {
        id: t.arg.string({ required: true }),
        input: t.arg({ type: CompetenceTreeMetadataInput, required: true }),
      },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.updateCompetenceTreeMetadata(args, ctx),
    }),

    updateCompetenceTreeElementAssignment: t.withAuth(asUserFullAccess).field({
      type: CompetenceTree,
      args: {
        treeId: t.arg.string({ required: true }),
        elementId: t.arg.int({ required: true }),
        assignment: t.arg({
          type: CompetenceTreeElementAssignmentUpdateInput,
          required: false,
        }),
      },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.updateCompetenceTreeElementAssignment(
          args,
          ctx
        ),
    }),

    duplicateCompetenceTree: t.withAuth(asUserFullAccess).field({
      type: CompetenceTree,
      args: {
        id: t.arg.string({ required: true }),
        input: t.arg({ type: DuplicateCompetenceTreeInput, required: false }),
      },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.duplicateCompetenceTree(args, ctx),
    }),

    linkCompetenceTreeToCourse: t.withAuth(asUserFullAccess).field({
      type: CompetenceTree,
      args: {
        treeId: t.arg.string({ required: true }),
        courseId: t.arg.string({ required: true }),
      },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.linkCompetenceTreeToCourse(args, ctx),
    }),

    unlinkCompetenceTreeFromCourse: t.withAuth(asUserFullAccess).boolean({
      args: {
        treeId: t.arg.string({ required: true }),
        courseId: t.arg.string({ required: true }),
      },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.unlinkCompetenceTreeFromCourse(args, ctx),
    }),

    deleteCompetenceTree: t.withAuth(asUserFullAccess).boolean({
      args: { id: t.arg.string({ required: true }) },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.deleteCompetenceTree(args, ctx),
    }),

    archiveCompetenceTree: t.withAuth(asUserFullAccess).boolean({
      args: { id: t.arg.string({ required: true }) },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.archiveCompetenceTree(args, ctx),
    }),

    restoreCompetenceTree: t.withAuth(asUserFullAccess).boolean({
      args: { id: t.arg.string({ required: true }) },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.restoreCompetenceTree(args, ctx),
    }),

    setCourseAdaptiveLearningEnabled: t.withAuth(asAdmin).field({
      type: Course,
      args: {
        courseId: t.arg.string({ required: true }),
        enabled: t.arg.boolean({ required: true }),
      },
      resolve: async (_, args, ctx) =>
        await CourseService.setCourseAdaptiveLearningEnabled(args, ctx),
    }),
  }
}
