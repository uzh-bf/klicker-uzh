import * as DB from '@klicker-uzh/prisma/client'
import { schema } from '../src/index.js'
import type { Context, ContextWithUser } from '../src/lib/context.js'
import {
  getComparableCalibrationTrend,
  getCompetenceTreeCalibrationOverview,
} from '../src/services/competenceTreeCalibrationReadModels.js'

const TREE_ID = '10000000-0000-4000-8000-000000000001'
const OWNER_ID = '10000000-0000-4000-8000-000000000002'
const READER_ID = '10000000-0000-4000-8000-000000000003'
const ADMIN_ID = '10000000-0000-4000-8000-000000000004'

describe('competence-tree calibration read permissions', () => {
  it('redacts all psychometric details for a linked reader', async () => {
    const fixture = contextFixture({ userId: READER_ID, ownerId: OWNER_ID })

    const result = await getCompetenceTreeCalibrationOverview(
      TREE_ID,
      fixture.ctx
    )

    expect(result).toEqual({
      treeId: TREE_ID,
      treeName: 'Linked adaptive tree',
      canManage: false,
      readiness: {
        status: 'CALIBRATED_BANK',
        activeScaleVersion: 1,
        enabledAssignmentCount: 1,
        calibratedAssignmentCount: 1,
        blockingAssignmentCount: 0,
        detailsRedacted: true,
      },
      scales: [],
    })
    expect(fixture.scaleFindMany).not.toHaveBeenCalled()
    expect(fixture.treeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: TREE_ID,
          isDeleted: false,
          OR: expect.any(Array),
        }),
      })
    )
    expect(JSON.stringify(result)).not.toMatch(
      /discrimination|difficulty|guessing|parameterUncertainty|diagnostics|lowerBound|itemDifficultyPrior|cutRationale|approval|scaleLink|empiricalValidation|artifact|downloadUrl|datasetVersion/
    )
  })

  it('redacts an owner using a read-only login scope', async () => {
    const fixture = contextFixture({
      userId: OWNER_ID,
      ownerId: OWNER_ID,
      scope: DB.UserLoginScope.READ_ONLY,
    })

    await expect(
      getCompetenceTreeCalibrationOverview(TREE_ID, fixture.ctx)
    ).resolves.toEqual({
      treeId: TREE_ID,
      treeName: 'Linked adaptive tree',
      canManage: false,
      readiness: expect.objectContaining({
        status: 'CALIBRATED_BANK',
        detailsRedacted: true,
      }),
      scales: [],
    })
    expect(fixture.scaleFindMany).not.toHaveBeenCalled()
  })

  it('retains the full calibration view for a full-access owner', async () => {
    const fixture = contextFixture({ userId: OWNER_ID, ownerId: OWNER_ID })

    const result = await getCompetenceTreeCalibrationOverview(
      TREE_ID,
      fixture.ctx
    )

    expect(result.canManage).toBe(true)
    expect(result.readiness).toMatchObject({
      status: 'CALIBRATED_BANK',
      detailsRedacted: false,
    })
    expect(result.scales).toHaveLength(1)
    expect(result.scales[0]).toMatchObject({
      priorMean: 0.2,
      levels: [{ lowerBound: -0.75, itemDifficultyPrior: -1 }],
      approvals: [{ cutRationale: { codes: ['PANEL_REVIEWED'] } }],
      calibrations: [{ discrimination: 1.4, difficulty: -0.4, guessing: 0.25 }],
      empiricalValidations: [{ aggregateMetrics: { accuracy: 0.82 } }],
    })
    expect(fixture.scaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { treeId: TREE_ID } })
    )
  })

  it('retains reviewer evidence for a persisted full-access administrator', async () => {
    const fixture = contextFixture({
      userId: ADMIN_ID,
      ownerId: OWNER_ID,
      role: DB.UserRole.ADMIN,
      persistedRole: DB.UserRole.ADMIN,
    })

    const result = await getCompetenceTreeCalibrationOverview(
      TREE_ID,
      fixture.ctx
    )

    expect(result.canManage).toBe(false)
    expect(result.scales[0]?.approvals).toHaveLength(1)
    expect(result.scales[0]?.calibrations).toHaveLength(1)
    expect(fixture.userFindUnique).toHaveBeenCalledWith({
      where: { id: ADMIN_ID },
      select: { role: true },
    })
  })

  it('redacts a persisted administrator using a read-only login scope', async () => {
    const fixture = contextFixture({
      userId: ADMIN_ID,
      ownerId: OWNER_ID,
      role: DB.UserRole.ADMIN,
      persistedRole: DB.UserRole.ADMIN,
      scope: DB.UserLoginScope.READ_ONLY,
    })

    await expect(
      getCompetenceTreeCalibrationOverview(TREE_ID, fixture.ctx)
    ).resolves.toMatchObject({ canManage: false, scales: [] })
    expect(fixture.scaleFindMany).not.toHaveBeenCalled()
    expect(fixture.treeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    )
  })

  it('does not trust a forged administrator claim', async () => {
    const fixture = contextFixture({
      userId: READER_ID,
      ownerId: OWNER_ID,
      role: DB.UserRole.ADMIN,
      persistedRole: DB.UserRole.USER,
    })

    await expect(
      getCompetenceTreeCalibrationOverview(TREE_ID, fixture.ctx)
    ).resolves.toMatchObject({ canManage: false, scales: [] })
    expect(fixture.scaleFindMany).not.toHaveBeenCalled()
    expect(fixture.treeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    )
  })

  it('rejects anonymous callers at the GraphQL authorization boundary', async () => {
    const resolver = schema.getQueryType()!.getFields()
      .competenceTreeCalibration!.resolve!

    await expect(
      resolver(
        {},
        { treeId: TREE_ID },
        {} as Context,
        {
          fieldName: 'competenceTreeCalibration',
        } as never
      )
    ).rejects.toMatchObject({ message: 'Unauthorized' })
  })

  it('rejects raw comparable trends for read-only owner sessions', async () => {
    const fixture = contextFixture({
      userId: OWNER_ID,
      ownerId: OWNER_ID,
      scope: DB.UserLoginScope.READ_ONLY,
    })

    await expect(
      getComparableCalibrationTrend(trendArgs(), fixture.ctx)
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } })
    expect(fixture.treeFindFirst).not.toHaveBeenCalled()
    expect(fixture.scaleLinkFindFirst).not.toHaveBeenCalled()
  })

  it('retains raw comparable trends for owners and persisted reviewers', async () => {
    const ownerFixture = contextFixture({
      userId: OWNER_ID,
      ownerId: OWNER_ID,
    })
    const reviewerFixture = contextFixture({
      userId: ADMIN_ID,
      ownerId: OWNER_ID,
      role: DB.UserRole.ADMIN,
      persistedRole: DB.UserRole.ADMIN,
    })

    await expect(
      getComparableCalibrationTrend(trendArgs(), ownerFixture.ctx)
    ).resolves.toMatchObject({
      anchors: [{ fromCalibration: { difficulty: -0.4 } }],
    })
    await expect(
      getComparableCalibrationTrend(trendArgs(), reviewerFixture.ctx)
    ).resolves.toMatchObject({
      anchors: [{ toCalibration: { difficulty: 0.1 } }],
    })
  })
})

function trendArgs() {
  return {
    treeId: TREE_ID,
    fromScaleVersionId: '20000000-0000-4000-8000-000000000001',
    toScaleVersionId: '20000000-0000-4000-8000-000000000002',
  }
}

function contextFixture({
  userId,
  ownerId,
  role = DB.UserRole.USER,
  persistedRole = DB.UserRole.USER,
  scope = DB.UserLoginScope.FULL_ACCESS,
}: {
  userId: string
  ownerId: string
  role?: DB.UserRole
  persistedRole?: DB.UserRole
  scope?: DB.UserLoginScope
}) {
  const userFindUnique = vi.fn().mockResolvedValue({ role: persistedRole })
  const treeFindFirst = vi.fn().mockResolvedValue({
    id: TREE_ID,
    name: 'Linked adaptive tree',
    ownerId,
    elementAssignments: [{ id: 1, element: { version: 1 } }],
    scaleVersions: [
      {
        version: 1,
        calibrations: [
          {
            assignmentId: 1,
            elementVersion: 1,
            status: DB.AdaptiveItemCalibrationStatus.CALIBRATED,
          },
        ],
      },
    ],
  })
  const scaleFindMany = vi.fn().mockResolvedValue([calibrationScaleFixture()])
  const scaleLinkFindFirst = vi
    .fn()
    .mockResolvedValue(comparableCalibrationTrendFixture())
  const ctx = {
    user: {
      sub: userId,
      role,
      scope,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    prisma: {
      user: { findUnique: userFindUnique },
      competenceTree: { findFirst: treeFindFirst },
      competenceTreeScaleVersion: { findMany: scaleFindMany },
      competenceTreeScaleLink: { findFirst: scaleLinkFindFirst },
    },
  } as unknown as ContextWithUser

  return {
    ctx,
    userFindUnique,
    treeFindFirst,
    scaleFindMany,
    scaleLinkFindFirst,
  }
}

function comparableCalibrationTrendFixture() {
  return {
    id: '50000000-0000-4000-8000-000000000001',
    method: 'MEAN_SIGMA',
    implementationVersion: 'mean-sigma-v1',
    fitMetrics: { rmse: 0.08 },
    uncertaintyMetrics: { standardError: 0.04 },
    anchors: [
      {
        fromCalibrationId: '40000000-0000-4000-8000-000000000001',
        toCalibrationId: '40000000-0000-4000-8000-000000000002',
        fromCalibration: {
          assignmentId: 1,
          elementId: 2,
          elementVersion: 1,
          difficulty: -0.4,
        },
        toCalibration: {
          assignmentId: 1,
          elementId: 2,
          elementVersion: 1,
          difficulty: 0.1,
        },
      },
    ],
  }
}

function calibrationScaleFixture() {
  const createdAt = new Date('2026-07-01T00:00:00.000Z')
  return {
    id: '20000000-0000-4000-8000-000000000001',
    version: 1,
    status: DB.AdaptiveScaleVersionStatus.ACTIVE,
    supersedesVersionId: null,
    priorMean: 0.2,
    priorStandardDeviation: 1.1,
    gridMin: -4,
    gridMax: 4,
    gridStep: 0.1,
    classificationPolicyVersion: 1,
    submittedForReviewAt: createdAt,
    createdAt,
    levels: [
      {
        id: 1,
        order: 0,
        label: 'Foundation',
        lowerBound: -0.75,
        itemDifficultyPrior: -1,
        sourceLevelId: 1,
      },
    ],
    approvals: [
      {
        id: '30000000-0000-4000-8000-000000000001',
        method: 'BOOKMARK',
        methodVersion: 'bookmark-v1',
        panelSize: 5,
        standardSettingDate: createdAt,
        cutRationale: { codes: ['PANEL_REVIEWED'] },
        decision: DB.AdaptiveScaleVersionStatus.APPROVED,
        reviewedAt: createdAt,
        createdAt,
      },
    ],
    calibrations: [
      {
        id: '40000000-0000-4000-8000-000000000001',
        assignmentId: 1,
        elementId: 2,
        elementVersion: 1,
        version: 1,
        model: DB.AdaptiveItemModel.THREE_PL_FIXED_C,
        status: DB.AdaptiveItemCalibrationStatus.CALIBRATED,
        discrimination: 1.4,
        difficulty: -0.4,
        guessing: 0.25,
        parameterUncertainty: { difficultyStandardError: 0.1 },
        responseCount: 250,
        participantCount: 180,
        diagnostics: { fitStatus: 'PASS' },
        modelImplementationVersion: '3pl-v1',
        approvedAt: createdAt,
        createdAt,
      },
    ],
    sourceScaleLinks: [
      {
        id: '50000000-0000-4000-8000-000000000001',
        status: DB.AdaptiveScaleLinkStatus.APPROVED,
        fromScaleVersionId: '20000000-0000-4000-8000-000000000001',
        toScaleVersionId: '20000000-0000-4000-8000-000000000002',
        method: 'MEAN_SIGMA',
        implementationVersion: 'mean-sigma-v1',
        reviewedAt: createdAt,
        createdAt,
      },
    ],
    targetScaleLinks: [],
    empiricalValidations: [
      {
        id: '60000000-0000-4000-8000-000000000001',
        configId: '70000000-0000-4000-8000-000000000001',
        status: DB.AdaptiveEmpiricalValidationStatus.APPROVED,
        measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
        estimatorImplementationVersion: 'IRT_V2_EAP_GRID_1',
        classificationPolicyVersion: 1,
        calibrationPolicyVersion: 1,
        approvedProbabilityThreshold: 0.8,
        aggregateMetrics: { accuracy: 0.82 },
        stratumMetrics: { foundation: { accuracy: 0.8 } },
        submittedAt: createdAt,
        reviewedAt: createdAt,
      },
    ],
  }
}
