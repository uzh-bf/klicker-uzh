import type {
  AdaptivePermissionWrapper,
  AdaptiveSchemaBuilder,
} from '@klicker-uzh/graphql/adaptive-schema-host-types'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  AdaptiveDryRunRecord,
  AdaptiveDryRunWorkspace,
} from '../services/adaptivePracticeQuizzes.js'
import * as AdaptivePracticeQuizRuntimeService from '../services/adaptivePracticeQuizzes.js'

type QueryFieldBuilder = Parameters<
  Parameters<AdaptiveSchemaBuilder['queryFields']>[0]
>[0]
type MutationFieldBuilder = Parameters<
  Parameters<AdaptiveSchemaBuilder['mutationFields']>[0]
>[0]

// Adaptive dry runs (testing environments only). Spec, settings, summary and
// students are exposed as Json: a debugging read model for the manage UI, not
// a contract other clients branch on.
export function createAdaptiveDryRunSchema(builder: AdaptiveSchemaBuilder) {
  const AdaptiveDryRunRef = builder
    .objectRef<AdaptiveDryRunRecord>('AdaptiveDryRun')
    .implement({
      fields: (t) => ({
        id: t.exposeString('id'),
        number: t.exposeInt('number'),
        publicationId: t.exposeString('publicationId'),
        engineRevision: t.exposeString('engineRevision', { nullable: true }),
        durationMs: t.exposeInt('durationMs'),
        createdAt: t.expose('createdAt', { type: 'Date' }),
        spec: t.expose('spec', { type: 'Json' }),
        effectiveSettings: t.expose('effectiveSettings', { type: 'Json' }),
        summary: t.expose('summary', { type: 'Json' }),
        // Only on the run detail and on a new run.
        students: t.expose('students', { type: 'Json', nullable: true }),
      }),
    })

  const LevelType = builder
    .objectRef<AdaptiveDryRunWorkspace['levels'][number]>('AdaptiveDryRunLevel')
    .implement({
      fields: (t) => ({
        id: t.exposeInt('id'),
        label: t.exposeString('label'),
        order: t.exposeInt('order'),
      }),
    })

  const CompetenceType = builder
    .objectRef<AdaptiveDryRunWorkspace['competences'][number]>(
      'AdaptiveDryRunCompetence'
    )
    .implement({
      fields: (t) => ({
        nodeId: t.exposeInt('nodeId'),
        name: t.exposeString('name'),
      }),
    })

  const SubcompetenceType = builder
    .objectRef<AdaptiveDryRunWorkspace['subcompetences'][number]>(
      'AdaptiveDryRunSubcompetence'
    )
    .implement({
      fields: (t) => ({
        nodeId: t.exposeInt('nodeId'),
        rootId: t.exposeInt('rootId'),
        name: t.exposeString('name'),
      }),
    })

  const ItemType = builder
    .objectRef<AdaptiveDryRunWorkspace['items'][number]>('AdaptiveDryRunItem')
    .implement({
      fields: (t) => ({
        poolItemId: t.exposeInt('poolItemId'),
        elementName: t.exposeString('elementName'),
        levelId: t.exposeInt('levelId'),
        nodeNames: t.exposeStringList('nodeNames'),
      }),
    })

  const AdaptiveDryRunWorkspaceRef = builder
    .objectRef<AdaptiveDryRunWorkspace>('AdaptiveDryRunWorkspace')
    .implement({
      fields: (t) => ({
        available: t.exposeBoolean('available'),
        unavailableReason: t.exposeString('unavailableReason', {
          nullable: true,
        }),
        publicationId: t.exposeString('publicationId', { nullable: true }),
        levels: t.expose('levels', { type: [LevelType] }),
        competences: t.expose('competences', { type: [CompetenceType] }),
        subcompetences: t.expose('subcompetences', {
          type: [SubcompetenceType],
        }),
        items: t.expose('items', { type: [ItemType] }),
        defaults: t.expose('defaults', { type: 'Json', nullable: true }),
        maxStudents: t.exposeInt('maxStudents'),
        maxDecisions: t.exposeInt('maxDecisions'),
        runs: t.expose('runs', { type: [AdaptiveDryRunRef] }),
      }),
    })

  return { AdaptiveDryRunRef, AdaptiveDryRunWorkspaceRef }
}

type DryRunRefs = ReturnType<typeof createAdaptiveDryRunSchema>
const asUser = { authenticated: true, role: DB.UserRole.USER }

// Testing environments only (ADAPTIVE_QUIZ_SHOW_SOLUTIONS=true); null
// elsewhere. Same lecturer permission as the attempt check.
export function adaptiveDryRunQueryFields(
  t: QueryFieldBuilder,
  {
    withPermission,
    AdaptiveDryRunRef,
    AdaptiveDryRunWorkspaceRef,
  }: { withPermission: AdaptivePermissionWrapper } & DryRunRefs
) {
  return {
    adaptivePracticeQuizDryRuns: t.withAuth(asUser).field({
      nullable: true,
      type: AdaptiveDryRunWorkspaceRef,
      args: { practiceQuizId: t.arg.string({ required: true }) },
      resolve: withPermission(
        (args) => ({ practiceQuizId: args.practiceQuizId }),
        DB.PermissionLevel.ADMIN,
        async (_, args, ctx) =>
          await AdaptivePracticeQuizRuntimeService.getAdaptivePracticeQuizDryRuns(
            args,
            ctx
          )
      ),
    }),

    adaptivePracticeQuizDryRun: t.withAuth(asUser).field({
      nullable: true,
      type: AdaptiveDryRunRef,
      args: {
        practiceQuizId: t.arg.string({ required: true }),
        id: t.arg.string({ required: true }),
      },
      resolve: withPermission(
        (args) => ({ practiceQuizId: args.practiceQuizId }),
        DB.PermissionLevel.ADMIN,
        async (_, args, ctx) =>
          await AdaptivePracticeQuizRuntimeService.getAdaptivePracticeQuizDryRun(
            args,
            ctx
          )
      ),
    }),
  }
}

export function adaptiveDryRunMutationFields(
  t: MutationFieldBuilder,
  {
    withPermission,
    AdaptiveDryRunRef,
  }: { withPermission: AdaptivePermissionWrapper } & Pick<
    DryRunRefs,
    'AdaptiveDryRunRef'
  >
) {
  return {
    runAdaptivePracticeQuizDryRun: t.withAuth(asUser).field({
      nullable: true,
      type: AdaptiveDryRunRef,
      args: {
        practiceQuizId: t.arg.string({ required: true }),
        students: t.arg.int({ required: true }),
        noiseProbability: t.arg.float({ required: true }),
        fromLevelId: t.arg.int({ required: true }),
        toLevelId: t.arg.int({ required: true }),
        competences: t.arg.string({ required: true }),
        seed: t.arg.string({ required: false }),
        totalQuestionCap: t.arg.int({ required: true }),
        minQuestionsPerLeaf: t.arg.int({ required: true }),
        classificationZ: t.arg.float({ required: true }),
        classificationToleranceBands: t.arg.int({ required: true }),
      },
      resolve: withPermission(
        (args) => ({ practiceQuizId: args.practiceQuizId }),
        DB.PermissionLevel.ADMIN,
        async (_, { practiceQuizId, competences, ...input }, ctx) =>
          await AdaptivePracticeQuizRuntimeService.runAdaptivePracticeQuizDryRun(
            {
              practiceQuizId,
              input: {
                ...input,
                competences: competences as 'SAME_LEVEL' | 'INDEPENDENT',
              },
            },
            ctx
          )
      ),
    }),

    deleteAdaptivePracticeQuizDryRun: t.withAuth(asUser).field({
      nullable: true,
      type: 'Boolean',
      args: {
        practiceQuizId: t.arg.string({ required: true }),
        id: t.arg.string({ required: true }),
      },
      resolve: withPermission(
        (args) => ({ practiceQuizId: args.practiceQuizId }),
        DB.PermissionLevel.ADMIN,
        async (_, args, ctx) =>
          await AdaptivePracticeQuizRuntimeService.deleteAdaptivePracticeQuizDryRun(
            args,
            ctx
          )
      ),
    }),
  }
}
