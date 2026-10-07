import type {
  AdaptivePermissionWrapper,
  AdaptiveSchemaBuilder,
} from '@klicker-uzh/graphql/adaptive-schema-host-types'
import * as DB from '@klicker-uzh/prisma/client'
import * as AdaptivePracticeQuizService from '../services/adaptivePracticeQuizConfig.js'
import * as AdaptivePracticeQuizRuntimeService from '../services/adaptivePracticeQuizzes.js'
import * as CompetenceTreeCalibrationService from '../services/competenceTreeCalibration.js'
import * as CompetenceTreeService from '../services/competenceTreeManagement.js'
import type { createAdaptiveAttemptDiagnosticsSchema } from './adaptiveAttemptDiagnostics.js'
import type { createAdaptivePracticeQuizSchema } from './adaptivePracticeQuiz.js'
import type { createAdaptivePracticeQuizRuntimeSchema } from './adaptivePracticeQuizRuntime.js'
import type { createCompetenceTreeSchema } from './competenceTree.js'
import type { createCompetenceTreeCalibrationSchema } from './competenceTreeCalibration.js'

type FieldBuilder = Parameters<
  Parameters<AdaptiveSchemaBuilder['queryFields']>[0]
>[0]

export function adaptiveQueryFields(
  t: FieldBuilder,
  {
    withPermission,
    AdaptivePracticeQuizConfigInput,
    AdaptivePracticeQuizPreviewType,
    AdaptivePracticeQuizSetupPreviewType,
    PracticeQuizPublicationPreviewType,
    AdaptiveCohortResultsRef,
    AdaptiveParticipantElementType,
    AdaptivePracticeQuizAttemptStateRef,
    AdaptiveStudentResultRef,
    AdaptiveAttemptDiagnosticsRef,
    AdaptiveAttemptDiagnosticRef,
    CompetenceTree,
    CompetenceTreeCatalogOwnership,
    CompetenceTreeCatalogPageType,
    CompetenceTreeInput,
    CompetenceTreeSummaryType,
    CompetenceTreeValidationResultType,
    AdaptiveCalibrationExportRequestRef,
    CompetenceTreeCalibrationRef,
  }: {
    withPermission: AdaptivePermissionWrapper
    AdaptivePracticeQuizConfigInput: ReturnType<
      typeof createAdaptivePracticeQuizSchema
    >['AdaptivePracticeQuizConfigInput']
    AdaptivePracticeQuizPreviewType: ReturnType<
      typeof createAdaptivePracticeQuizSchema
    >['AdaptivePracticeQuizPreviewType']
    AdaptivePracticeQuizSetupPreviewType: ReturnType<
      typeof createAdaptivePracticeQuizSchema
    >['AdaptivePracticeQuizSetupPreviewType']
    PracticeQuizPublicationPreviewType: ReturnType<
      typeof createAdaptivePracticeQuizSchema
    >['PracticeQuizPublicationPreviewType']
    AdaptiveParticipantElementType: ReturnType<
      typeof createAdaptivePracticeQuizRuntimeSchema
    >['AdaptiveParticipantElementType']
    AdaptiveCohortResultsRef: ReturnType<
      typeof createAdaptivePracticeQuizRuntimeSchema
    >['AdaptiveCohortResultsRef']
    AdaptivePracticeQuizAttemptStateRef: ReturnType<
      typeof createAdaptivePracticeQuizRuntimeSchema
    >['AdaptivePracticeQuizAttemptStateRef']
    AdaptiveStudentResultRef: ReturnType<
      typeof createAdaptivePracticeQuizRuntimeSchema
    >['AdaptiveStudentResultRef']
    AdaptiveAttemptDiagnosticsRef: ReturnType<
      typeof createAdaptiveAttemptDiagnosticsSchema
    >['AdaptiveAttemptDiagnosticsRef']
    AdaptiveAttemptDiagnosticRef: ReturnType<
      typeof createAdaptiveAttemptDiagnosticsSchema
    >['AdaptiveAttemptDiagnosticRef']
    CompetenceTree: ReturnType<
      typeof createCompetenceTreeSchema
    >['CompetenceTree']
    CompetenceTreeCatalogOwnership: ReturnType<
      typeof createCompetenceTreeSchema
    >['CompetenceTreeCatalogOwnership']
    CompetenceTreeCatalogPageType: ReturnType<
      typeof createCompetenceTreeSchema
    >['CompetenceTreeCatalogPageType']
    CompetenceTreeInput: ReturnType<
      typeof createCompetenceTreeSchema
    >['CompetenceTreeInput']
    CompetenceTreeSummaryType: ReturnType<
      typeof createCompetenceTreeSchema
    >['CompetenceTreeSummaryType']
    CompetenceTreeValidationResultType: ReturnType<
      typeof createCompetenceTreeSchema
    >['CompetenceTreeValidationResultType']
    AdaptiveCalibrationExportRequestRef: ReturnType<
      typeof createCompetenceTreeCalibrationSchema
    >['AdaptiveCalibrationExportRequestRef']
    CompetenceTreeCalibrationRef: ReturnType<
      typeof createCompetenceTreeCalibrationSchema
    >['CompetenceTreeCalibrationRef']
  }
) {
  const asParticipant = { authenticated: true, role: DB.UserRole.PARTICIPANT }
  const asUser = { authenticated: true, role: DB.UserRole.USER }
  const asUserFullAccess = { ...asUser, scope: DB.UserLoginScope.FULL_ACCESS }
  const asUserSessionExec = {
    ...asUser,
    scope: DB.UserLoginScope.SESSION_EXEC,
  }
  return {
    competenceTrees: t.withAuth(asUser).field({
      type: [CompetenceTreeSummaryType],
      args: {
        includeArchived: t.arg.boolean({
          required: false,
          defaultValue: false,
        }),
      },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.getCompetenceTrees(args, ctx),
    }),

    competenceTreeCatalog: t.withAuth(asUser).field({
      type: CompetenceTreeCatalogPageType,
      args: {
        search: t.arg.string({ required: false }),
        cursor: t.arg.string({ required: false }),
        limit: t.arg.int({ required: false, defaultValue: 25 }),
        includeArchived: t.arg.boolean({
          required: false,
          defaultValue: false,
        }),
        ownership: t.arg({
          type: CompetenceTreeCatalogOwnership,
          required: false,
          defaultValue: 'ALL',
        }),
        courseId: t.arg.string({ required: false }),
        excludeCourseId: t.arg.string({ required: false }),
      },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.getCompetenceTreeCatalog(args, ctx),
    }),

    competenceTree: t.withAuth(asUser).field({
      nullable: true,
      type: CompetenceTree,
      args: { id: t.arg.string({ required: true }) },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.getCompetenceTree(args, ctx),
    }),

    competenceTreeCalibration: t.withAuth(asUser).field({
      type: CompetenceTreeCalibrationRef,
      args: { treeId: t.arg.string({ required: true }) },
      resolve: async (_, { treeId }, ctx) =>
        await CompetenceTreeCalibrationService.getCompetenceTreeCalibrationOverview(
          treeId,
          ctx
        ),
    }),

    adaptiveCalibrationExportRequest: t.withAuth(asUserFullAccess).field({
      type: AdaptiveCalibrationExportRequestRef,
      args: { requestId: t.arg.string({ required: true }) },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeCalibrationService.getAdaptiveCalibrationExportRequest(
          args,
          ctx
        ),
    }),

    courseCompetenceTrees: t.withAuth(asUser).field({
      type: [CompetenceTreeSummaryType],
      args: { courseId: t.arg.string({ required: true }) },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.getCourseCompetenceTrees(args, ctx),
    }),

    courseCompetenceTreeCatalog: t.withAuth(asUser).field({
      type: CompetenceTreeCatalogPageType,
      args: {
        courseId: t.arg.string({ required: true }),
        search: t.arg.string({ required: false }),
        cursor: t.arg.string({ required: false }),
        limit: t.arg.int({ required: false, defaultValue: 25 }),
      },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.getCourseCompetenceTreeCatalog(args, ctx),
    }),

    elementCompetenceTrees: t.withAuth(asUser).field({
      type: [CompetenceTree],
      args: { elementId: t.arg.int({ required: true }) },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.getElementCompetenceTrees(args, ctx),
    }),

    validateCompetenceTree: t.withAuth(asUser).field({
      type: CompetenceTreeValidationResultType,
      args: {
        input: t.arg({ type: CompetenceTreeInput, required: true }),
      },
      resolve: async (_, args, ctx) =>
        await CompetenceTreeService.validateCompetenceTreeInput(args, ctx),
    }),

    adaptivePracticeQuizPreview: t.withAuth(asUser).field({
      nullable: true,
      type: AdaptivePracticeQuizPreviewType,
      args: { id: t.arg.string({ required: true }) },
      resolve: withPermission(
        (args) => ({ practiceQuizId: args.id }),
        DB.PermissionLevel.WRITE,
        async (_, args, ctx) => {
          return await AdaptivePracticeQuizService.getAdaptivePracticeQuizPreview(
            args,
            ctx
          )
        }
      ),
    }),

    adaptivePracticeQuizSetupPreview: t.withAuth(asUser).field({
      nullable: true,
      type: AdaptivePracticeQuizSetupPreviewType,
      args: {
        courseId: t.arg.string({ required: true }),
        input: t.arg({
          type: AdaptivePracticeQuizConfigInput,
          required: true,
        }),
      },
      resolve: withPermission(
        (args) => ({ courseId: args.courseId }),
        DB.PermissionLevel.WRITE,
        async (_, args, ctx) =>
          await AdaptivePracticeQuizService.getAdaptivePracticeQuizSetupPreview(
            args,
            ctx
          )
      ),
    }),

    practiceQuizPublicationPreview: t.withAuth(asUserSessionExec).field({
      nullable: true,
      type: PracticeQuizPublicationPreviewType,
      args: { id: t.arg.string({ required: true }) },
      resolve: withPermission(
        (args) => ({ practiceQuizId: args.id }),
        DB.PermissionLevel.EXECUTE,
        async (_, args, ctx) =>
          await AdaptivePracticeQuizService.getPracticeQuizPublicationPreview(
            args,
            ctx
          )
      ),
    }),

    adaptivePracticeQuizAttemptState: t.withAuth(asParticipant).field({
      nullable: true,
      type: AdaptivePracticeQuizAttemptStateRef,
      args: {
        practiceQuizId: t.arg.string({ required: true }),
      },
      resolve: async (_, args, ctx) =>
        await AdaptivePracticeQuizRuntimeService.getAdaptivePracticeQuizState(
          args,
          ctx
        ),
    }),

    adaptivePracticeQuizResult: t.withAuth(asParticipant).field({
      nullable: false,
      type: AdaptiveStudentResultRef,
      args: {
        attemptId: t.arg.string({ required: true }),
      },
      resolve: async (_, args, ctx) =>
        await AdaptivePracticeQuizRuntimeService.getAdaptivePracticeQuizResult(
          args,
          ctx
        ),
    }),

    adaptivePracticeQuizItemPreview: t.withAuth(asUser).field({
      nullable: true,
      type: AdaptiveParticipantElementType,
      args: {
        practiceQuizId: t.arg.string({ required: true }),
        poolItemId: t.arg.int({ required: true }),
      },
      resolve: withPermission(
        (args) => ({ practiceQuizId: args.practiceQuizId }),
        DB.PermissionLevel.ADMIN,
        async (_, args, ctx) =>
          AdaptivePracticeQuizRuntimeService.getAdaptivePracticeQuizItemPreview(
            args,
            ctx
          )
      ),
    }),

    // Testing environments only (ADAPTIVE_QUIZ_SHOW_SOLUTIONS=true); null
    // elsewhere. Same lecturer permission as the cohort results.
    adaptivePracticeQuizAttemptDiagnostics: t.withAuth(asUser).field({
      nullable: true,
      type: AdaptiveAttemptDiagnosticsRef,
      args: {
        practiceQuizId: t.arg.string({ required: true }),
      },
      resolve: withPermission(
        (args) => ({ practiceQuizId: args.practiceQuizId }),
        DB.PermissionLevel.ADMIN,
        async (_, args, ctx) =>
          await AdaptivePracticeQuizRuntimeService.getAdaptivePracticeQuizAttemptDiagnostics(
            args,
            ctx
          )
      ),
    }),

    adaptivePracticeQuizAttemptDiagnostic: t.withAuth(asUser).field({
      nullable: true,
      type: AdaptiveAttemptDiagnosticRef,
      args: {
        practiceQuizId: t.arg.string({ required: true }),
        attemptCode: t.arg.string({ required: true }),
      },
      resolve: withPermission(
        (args) => ({ practiceQuizId: args.practiceQuizId }),
        DB.PermissionLevel.ADMIN,
        async (_, args, ctx) =>
          await AdaptivePracticeQuizRuntimeService.getAdaptivePracticeQuizAttemptDiagnostic(
            args,
            ctx
          )
      ),
    }),

    adaptivePracticeQuizCohortResults: t.withAuth(asUser).field({
      nullable: true,
      type: AdaptiveCohortResultsRef,
      args: {
        practiceQuizId: t.arg.string({ required: true }),
      },
      resolve: withPermission(
        (args) => ({ practiceQuizId: args.practiceQuizId }),
        DB.PermissionLevel.ADMIN,
        async (_, args, ctx) =>
          await AdaptivePracticeQuizRuntimeService.getAdaptivePracticeQuizCohortResults(
            args,
            ctx
          )
      ),
    }),
  }
}
