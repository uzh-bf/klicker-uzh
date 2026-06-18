import {
  faCircleCheck,
  faCircleHalfStroke,
  faCircleMinus,
  faCircleXmark,
  faFileCircleCheck,
  faPenToSquare,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { InstanceStackStudentResponseType } from '@klicker-uzh/shared-components/src/StudentElement'
import {
  Button,
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCell,
  ShadcnTableHead,
  ShadcnTableHeader,
  ShadcnTableRow,
  Tooltip,
  UserNotification,
} from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Fragment, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { ResponseCorrectness } from '../../../lib/assessmentResultsTypes'
import { trpc } from '../../../lib/trpc'
import PointCorrectionsModal from '../../courses/PointCorrectionsModal'
import StudentAssessmentResponseModal, {
  AssessmentResultInstance,
} from './StudentAssessmentResponseModal'
import { useStudentInstanceResponseMapper } from './useStudentInstanceResponseMapper'

const CorrectnessIconMap: Record<
  ResponseCorrectness | 'UNSET',
  { icon: any; className: string }
> = {
  [ResponseCorrectness.Correct]: {
    icon: faCircleCheck,
    className: 'text-uzh-darkgreen-100',
  },
  [ResponseCorrectness.Partial]: {
    icon: faCircleHalfStroke,
    className: 'text-uzh-red-100',
  },
  [ResponseCorrectness.Wrong]: {
    icon: faCircleXmark,
    className: 'text-red-600',
  },
  UNSET: {
    icon: faCircleMinus,
    className: 'text-muted-foreground',
  },
}

function LiveQuizSingleStudentResults({
  liveQuizId,
  participantId,
  participantEmail,
  quizBasePoints,
  quizCorrectnessPoints,
  quizBonusPoints,
}: {
  liveQuizId: string
  participantId: string
  participantEmail: string
  quizBasePoints: number
  quizCorrectnessPoints: number
  quizBonusPoints: number
}) {
  const t = useTranslations()
  const router = useRouter()
  const formatter = useFormatter()
  const toStudentElementResponse = useStudentInstanceResponseMapper()

  const [instancePointCorrection, setInstancePointCorrection] = useState<
    { instanceId: string; participantId: string } | undefined
  >(undefined)

  const { data, error, isLoading } =
    trpc.activity.liveQuizStudentAssessmentResponses.useQuery(
      { liveQuizId, participantId },
      { enabled: Boolean(liveQuizId && participantId) }
    )
  const [selectedInstance, setSelectedInstance] = useState<{
    instance: AssessmentResultInstance
    response: InstanceStackStudentResponseType
  } | null>(null)

  const blocks = data?.liveQuizStudentAssessmentResponses ?? []
  const computedBlocks = useMemo(() => {
    return blocks.map((block, blockIx) => {
      const instances = block.instances.map((instanceObj) => {
        const instance = instanceObj.instance
        const elementData = instance.elementData

        const hasBasePoints = instance.options?.basePoints ?? false
        const multiplier = instance.options?.pointsMultiplier ?? 1
        const hasSampleSolution =
          'options' in elementData &&
          'hasSampleSolution' in elementData.options &&
          (elementData.options.hasSampleSolution ?? false)

        const availableBase = hasBasePoints ? quizBasePoints : 0
        const availableCorrect = hasSampleSolution
          ? multiplier * quizCorrectnessPoints
          : 0
        const availableBonus = hasSampleSolution
          ? multiplier * quizBonusPoints
          : 0

        const totalPoints =
          instanceObj.basePoints +
          instanceObj.correctnessPoints +
          instanceObj.bonusPoints
        const totalAvailablePoints =
          availableBase + availableCorrect + availableBonus

        return {
          ...instance,
          hasSampleSolution,
          basePoints: instanceObj.basePoints,
          correctnessPoints: instanceObj.correctnessPoints,
          bonusPoints: instanceObj.bonusPoints,
          correctness: instanceObj.correctness,
          availableBasePoints: availableBase,
          availableCorrectnessPoints: availableCorrect,
          availableBonusPoints: availableBonus,
          totalPoints,
          totalAvailablePoints,
          submission: instanceObj.submission,
          corrections: instanceObj.corrections,
        }
      })

      const blockTotals = instances.reduce(
        (acc, instance) => {
          acc.basePoints += instance.basePoints
          acc.availableBasePoints += instance.availableBasePoints
          acc.correctnessPoints += instance.correctnessPoints
          acc.availableCorrectnessPoints += instance.availableCorrectnessPoints
          acc.bonusPoints += instance.bonusPoints
          acc.availableBonusPoints += instance.availableBonusPoints
          acc.totalPoints += instance.totalPoints
          acc.totalAvailablePoints += instance.totalAvailablePoints
          return acc
        },
        {
          basePoints: 0,
          availableBasePoints: 0,
          correctnessPoints: 0,
          availableCorrectnessPoints: 0,
          bonusPoints: 0,
          availableBonusPoints: 0,
          totalPoints: 0,
          totalAvailablePoints: 0,
        }
      )

      return {
        block,
        blockIx,
        instances,
        totals: blockTotals,
      }
    })
  }, [blocks, quizBasePoints, quizBonusPoints, quizCorrectnessPoints])

  if (isLoading) {
    return <Loader />
  }

  if (error) {
    return (
      <UserNotification
        type="error"
        message={t('manage.assessment.errorLoadingStudentLiveQuizResponses')}
      />
    )
  }

  if (computedBlocks.length === 0) {
    return (
      <UserNotification
        type="info"
        message={t('manage.assessment.liveQuizStudentHasNoResponses')}
      />
    )
  }

  const formatPoints = (value: number) =>
    formatter.number(value, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    })

  const renderPointsStack = (achieved: number, available: number) => (
    <div className="flex items-baseline justify-center gap-1 leading-tight">
      <span className="text-sm">{formatPoints(achieved)}</span>
      <span className="text-muted-foreground text-[0.65rem]">
        {`/ ${formatPoints(available)}`}
      </span>
    </div>
  )

  return (
    <>
      <ShadcnTable className="text-xs sm:text-sm">
        <ShadcnTableHeader>
          <ShadcnTableRow>
            <ShadcnTableHead className="w-40 whitespace-normal px-3 text-left text-[0.7rem] leading-tight">
              {t('manage.assessment.liveQuizElement')}
            </ShadcnTableHead>
            <ShadcnTableHead className="w-10 whitespace-normal px-2 text-center text-[0.7rem] leading-tight">
              {t('manage.general.basePointsDescription')}
            </ShadcnTableHead>
            <ShadcnTableHead className="w-10 whitespace-normal px-2 text-center text-[0.7rem] leading-tight">
              {t('manage.general.correctnessPointsDescription')}
            </ShadcnTableHead>
            <ShadcnTableHead className="w-10 whitespace-normal px-2 text-center text-[0.7rem] leading-tight">
              {t('manage.general.bonusPointsDescription')}
            </ShadcnTableHead>
            <ShadcnTableHead className="w-10 whitespace-normal px-2 text-center text-[0.7rem] leading-tight">
              {t('shared.generic.total')}
            </ShadcnTableHead>
            <ShadcnTableHead className="whitespace-normal px-0 text-center text-[0.7rem] leading-tight">
              <span className="sr-only">
                {t('manage.assessment.liveQuizResponse')}
              </span>
            </ShadcnTableHead>
          </ShadcnTableRow>
        </ShadcnTableHeader>
        <ShadcnTableBody>
          {computedBlocks.map(({ block, blockIx, instances, totals }) => {
            return (
              <Fragment key={`block-${block.blockId}`}>
                <ShadcnTableRow className="bg-muted/30 hover:bg-muted/30">
                  <ShadcnTableCell className="py-2 pl-3 font-bold">
                    {t(`shared.generic.blockN`, { number: blockIx + 1 })}
                  </ShadcnTableCell>
                  <ShadcnTableCell className="px-2 py-2 text-center">
                    {renderPointsStack(
                      totals.basePoints,
                      totals.availableBasePoints
                    )}
                  </ShadcnTableCell>
                  <ShadcnTableCell className="px-2 py-2 text-center">
                    {renderPointsStack(
                      totals.correctnessPoints,
                      totals.availableCorrectnessPoints
                    )}
                  </ShadcnTableCell>
                  <ShadcnTableCell className="px-2 py-2 text-center">
                    {renderPointsStack(
                      totals.bonusPoints,
                      totals.availableBonusPoints
                    )}
                  </ShadcnTableCell>
                  <ShadcnTableCell className="px-2 py-2 text-center">
                    {renderPointsStack(
                      totals.totalPoints,
                      totals.totalAvailablePoints
                    )}
                  </ShadcnTableCell>
                  <ShadcnTableCell className="w-0 max-w-0 px-0" />
                </ShadcnTableRow>

                {instances.map((instance, instanceIx) => {
                  const elementData = instance.elementData
                  const correctnessStatus = !!instance.submission
                    ? (instance.correctness ?? 'UNSET')
                    : 'UNSET'
                  const correctnessIcon =
                    CorrectnessIconMap[
                      correctnessStatus as ResponseCorrectness | 'UNSET'
                    ]
                  const elementTypeLabel = t(
                    `shared.${instance.elementType}.typeLabel`
                  )

                  return (
                    <ShadcnTableRow
                      key={`block-${block.blockId}-instance-${instance.id}`}
                      className={twMerge(
                        'hover:bg-muted/50 transition-colors',
                        !instance.submission && 'opacity-70'
                      )}
                    >
                      <ShadcnTableCell className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <FontAwesomeIcon
                              icon={correctnessIcon.icon}
                              className={twMerge(
                                'h-4 w-4',
                                correctnessIcon.className
                              )}
                            />
                            <span className="line-clamp-1 text-sm leading-tight">
                              {elementData.name}
                            </span>
                            {instance.corrections &&
                            instance.corrections.length > 0 ? (
                              <Tooltip
                                className={{ tooltip: 'md:w-105 w-60' }}
                                tooltip={
                                  <div className="flex w-full flex-col gap-3 text-left text-sm">
                                    <div className="text-foreground border-b pb-2 text-sm font-semibold">
                                      {t(
                                        'manage.pointCorrections.responseCorrectionsApplied'
                                      )}
                                    </div>

                                    {instance.corrections.map(
                                      (appliedCorrection, index) => {
                                        const adjustments = [
                                          {
                                            key: `awarded-base-${appliedCorrection.id}`,
                                            amount:
                                              appliedCorrection.awardedBasePoints,
                                            label: t(
                                              'manage.general.basePointsDescription'
                                            ),
                                            variant: 'positive' as const,
                                          },
                                          {
                                            key: `awarded-correctness-${appliedCorrection.id}`,
                                            amount:
                                              appliedCorrection.awardedCorrectnessPoints,
                                            label: t(
                                              'manage.general.correctnessPointsDescription'
                                            ),
                                            variant: 'positive' as const,
                                          },
                                          {
                                            key: `awarded-bonus-${appliedCorrection.id}`,
                                            amount:
                                              appliedCorrection.awardedBonusPoints,
                                            label: t(
                                              'manage.general.bonusPointsDescription'
                                            ),
                                            variant: 'positive' as const,
                                          },
                                          {
                                            key: `deducted-base-${appliedCorrection.id}`,
                                            amount:
                                              appliedCorrection.deductedBasePoints,
                                            label: t(
                                              'manage.general.basePointsDescription'
                                            ),
                                            variant: 'negative' as const,
                                          },
                                          {
                                            key: `deducted-correctness-${appliedCorrection.id}`,
                                            amount:
                                              appliedCorrection.deductedCorrectnessPoints,
                                            label: t(
                                              'manage.general.correctnessPointsDescription'
                                            ),
                                            variant: 'negative' as const,
                                          },
                                          {
                                            key: `deducted-bonus-${appliedCorrection.id}`,
                                            amount:
                                              appliedCorrection.deductedBonusPoints,
                                            label: t(
                                              'manage.general.bonusPointsDescription'
                                            ),
                                            variant: 'negative' as const,
                                          },
                                        ].filter(({ amount }) => amount > 0)

                                        return (
                                          <div
                                            key={appliedCorrection.id}
                                            className={twMerge(
                                              'flex flex-col gap-2',
                                              index > 0 &&
                                                'border-border border-t pt-2'
                                            )}
                                          >
                                            <div className="flex flex-col gap-0.5">
                                              <div className="text-muted-foreground text-[0.65rem] uppercase tracking-wide">
                                                {t(
                                                  'manage.pointCorrections.summaryLecturerReasonLabel'
                                                )}
                                              </div>
                                              <div className="text-foreground text-sm">
                                                {appliedCorrection.pointCorrection.reason.trim()}
                                              </div>
                                            </div>

                                            <div className="flex flex-col gap-0.5">
                                              <div className="text-muted-foreground text-[0.65rem] uppercase tracking-wide">
                                                {t(
                                                  'manage.pointCorrections.summaryAdjustmentsLabel'
                                                )}
                                              </div>
                                              {adjustments.length > 0 ? (
                                                <ul className="flex flex-col gap-1">
                                                  {adjustments.map(
                                                    ({
                                                      key,
                                                      amount,
                                                      label,
                                                      variant,
                                                    }) => (
                                                      <li
                                                        key={key}
                                                        className="flex items-center gap-2"
                                                      >
                                                        <span
                                                          className={twMerge(
                                                            'rounded-sm px-1.5 py-0.5 text-xs font-semibold',
                                                            variant ===
                                                              'positive'
                                                              ? 'bg-emerald-100 text-emerald-700'
                                                              : 'bg-rose-100 text-rose-700'
                                                          )}
                                                        >
                                                          {`${
                                                            variant ===
                                                            'positive'
                                                              ? '+ '
                                                              : '- '
                                                          }${formatPoints(amount)}`}
                                                        </span>
                                                        <span>{label}</span>
                                                      </li>
                                                    )
                                                  )}
                                                </ul>
                                              ) : (
                                                <div>
                                                  {t(
                                                    'manage.pointCorrections.noAdjustmentsApplied'
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      }
                                    )}
                                  </div>
                                }
                              >
                                <FontAwesomeIcon
                                  icon={faTriangleExclamation}
                                  className="ml-1.5 text-orange-500"
                                />
                              </Tooltip>
                            ) : null}
                          </div>
                          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[0.7rem] leading-tight">
                            <span>{elementTypeLabel}</span>
                            <span>•</span>
                            <span>
                              {instance.submission
                                ? t(
                                    'manage.assessment.liveQuizQuestionAnswered'
                                  )
                                : t(
                                    'manage.assessment.liveQuizQuestionNotAnswered'
                                  )}
                            </span>
                          </div>
                        </div>
                      </ShadcnTableCell>
                      <ShadcnTableCell className="px-2 py-3 text-center">
                        {renderPointsStack(
                          instance.basePoints,
                          instance.availableBasePoints
                        )}
                      </ShadcnTableCell>
                      <ShadcnTableCell className="px-2 py-3 text-center">
                        {renderPointsStack(
                          instance.correctnessPoints,
                          instance.availableCorrectnessPoints
                        )}
                      </ShadcnTableCell>
                      <ShadcnTableCell className="px-2 py-3 text-center">
                        {renderPointsStack(
                          instance.bonusPoints,
                          instance.availableBonusPoints
                        )}
                      </ShadcnTableCell>
                      <ShadcnTableCell className="px-2 py-3 text-center">
                        {renderPointsStack(
                          instance.totalPoints,
                          instance.totalAvailablePoints
                        )}
                      </ShadcnTableCell>
                      <ShadcnTableCell className="px-0 py-3">
                        <div className="flex justify-center gap-0">
                          <Tooltip
                            tooltip={
                              !!instance.submission
                                ? t('manage.assessment.liveQuizOpenResponse')
                                : t(
                                    'manage.assessment.liveQuizNoResponseSubmitted'
                                  )
                            }
                          >
                            <Button
                              className={{
                                root: 'h-7 w-7 items-center justify-center',
                              }}
                              disabled={!instance.submission}
                              onClick={() => {
                                if (!instance.submission) return

                                const response = toStudentElementResponse({
                                  instance,
                                  submission: instance.submission,
                                })

                                if (!response) return
                                setSelectedInstance({ instance, response })
                              }}
                              data={{
                                cy: `live-quiz-student-instance-${blockIx}-${instanceIx}-modal`,
                              }}
                              variant="ghost"
                            >
                              <Button.Icon
                                withoutLabel
                                icon={faFileCircleCheck}
                                className={{ root: 'h-3.5 w-3.5' }}
                              />
                            </Button>
                          </Tooltip>
                          <Tooltip
                            tooltip={t(
                              'manage.assessment.liveQuizOpenCorrection'
                            )}
                          >
                            <Button
                              className={{ root: 'h-7 w-7 justify-center p-0' }}
                              onClick={() => {
                                setInstancePointCorrection({
                                  instanceId: String(instance.id),
                                  participantId,
                                })
                              }}
                              data={{
                                cy: `live-quiz-student-instance-${blockIx}-${instanceIx}-correction`,
                              }}
                              variant="ghost"
                            >
                              <Button.Icon
                                withoutLabel
                                icon={faPenToSquare}
                                className={{ root: 'h-3.5 w-3.5' }}
                              />
                            </Button>
                          </Tooltip>
                        </div>
                      </ShadcnTableCell>
                    </ShadcnTableRow>
                  )
                })}
              </Fragment>
            )
          })}
        </ShadcnTableBody>
      </ShadcnTable>

      {!!selectedInstance && (
        <StudentAssessmentResponseModal
          instance={selectedInstance.instance}
          response={selectedInstance.response}
          participantEmail={participantEmail}
          onClose={() => setSelectedInstance(null)}
        />
      )}

      {typeof instancePointCorrection !== 'undefined' && router.query.id ? (
        <PointCorrectionsModal
          courseId={router.query.id as string}
          onClose={() => setInstancePointCorrection(undefined)}
          preselectedLiveQuizId={router.query.quizId as string}
          preselectedInstanceId={instancePointCorrection?.instanceId}
          preselectedParticipantId={instancePointCorrection?.participantId}
        />
      ) : null}
    </>
  )
}

export default LiveQuizSingleStudentResults
