import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  faCheckSquare,
  faInfoCircle,
  faMagnifyingGlass,
  faPencil,
  faXmarkSquare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityDetails,
  ActivityType,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import {
  Button,
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCell,
  ShadcnTableFooter,
  ShadcnTableHead,
  ShadcnTableHeader,
  ShadcnTableRow,
  Tooltip,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import ActivityOutdatedElementWarning from '../ActivityOutdatedElementWarning'

function ActivityOverviewTable({
  details,
  activityType,
  outdatedInstances,
  selectedInstanceId,
  setSelectedInstanceId,
}: {
  details: ActivityDetails
  activityType: ActivityType
  outdatedInstances: number[]
  selectedInstanceId: number | null
  setSelectedInstanceId: Dispatch<SetStateAction<number | null>>
}) {
  const t = useTranslations()
  const router = useRouter()
  const stacks = details.stacks ?? []
  const isLiveQuiz = activityType === ActivityType.LiveQuiz

  if (stacks.length === 0) {
    return (
      <UserNotification
        type="info"
        message={t('manage.activities.activityContainsNoElements', {
          activity: t(`shared.types.${activityType}`),
        })}
        className={{ root: 'mt-2 w-full' }}
      />
    )
  }

  return (
    <ShadcnTable className="mt-2 text-sm">
      <ShadcnTableHeader>
        <ShadcnTableRow>
          <ShadcnTableHead
            className={twMerge(
              'flex-1',
              isLiveQuiz && details.arePointsAwarded ? 'w-2/5 xl:w-1/2' : ''
            )}
          />
          {details.arePointsAwarded && (
            <>
              {isLiveQuiz && (
                <>
                  <ShadcnTableHead className="w-20 whitespace-normal text-center leading-tight">
                    {t('manage.general.basePointsDescription')}
                  </ShadcnTableHead>
                  <ShadcnTableHead className="w-20 whitespace-normal text-center leading-tight">
                    {t('manage.general.correctnessPointsDescription')}
                  </ShadcnTableHead>
                  <ShadcnTableHead className="w-20 whitespace-normal text-center leading-tight">
                    {t('manage.general.bonusPointsDescription')}
                  </ShadcnTableHead>
                </>
              )}
              <ShadcnTableHead className="w-20 text-center font-bold">
                {t('shared.generic.total')}
              </ShadcnTableHead>
            </>
          )}
          <ShadcnTableHead className="w-16" />
        </ShadcnTableRow>
      </ShadcnTableHeader>
      <ShadcnTableBody>
        {stacks.map((stack, stackIx) => (
          <>
            <ShadcnTableRow
              key={`stack-${stack.id}`}
              className="bg-muted/30 hover:bg-muted/30"
              data-cy={`activity-details-stack-header-${stackIx}`}
            >
              <ShadcnTableCell colSpan={isLiveQuiz ? 4 : 1} className="py-1">
                <div className="flex items-center font-bold">
                  <span>
                    {isLiveQuiz
                      ? t('shared.generic.blockN', {
                          number: stackIx + 1,
                        })
                      : t('shared.generic.stackN', {
                          number: stackIx + 1,
                        })}
                  </span>
                  {stack.timeLimit ? (
                    <span className="text-uzh-red-100 ml-5 flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faClock} />
                      {`${stack.timeLimit} s`}
                    </span>
                  ) : null}
                  {stack.stackTitle ? (
                    <span className="font-normal">{`: ${stack.stackTitle}`}</span>
                  ) : null}
                  {stack.stackDescription ? (
                    <Tooltip
                      tooltip={
                        <div>
                          <div className="font-bold">
                            {t('manage.activityWizard.stackDescription')}:
                          </div>
                          <Markdown content={stack.stackDescription} />
                        </div>
                      }
                    >
                      <FontAwesomeIcon
                        icon={faInfoCircle}
                        className="text-primary-100 ml-3"
                      />
                    </Tooltip>
                  ) : null}
                </div>
              </ShadcnTableCell>
              {details.arePointsAwarded && stack.stackPoints !== null ? (
                <>
                  <ShadcnTableCell className="py-1 text-center font-bold">
                    {`${stack.stackPoints} P.`}
                  </ShadcnTableCell>
                  <ShadcnTableCell />
                </>
              ) : null}
            </ShadcnTableRow>

            {stack.elements.map((element, instanceIx) => {
              const instanceId = String(element.instance.id)
              const isOutdated = outdatedInstances.includes(element.instance.id)
              const isInstanceQuestion = [
                ElementType.Sc,
                ElementType.Mc,
                ElementType.Kprim,
                ElementType.Numerical,
                ElementType.FreeText,
                ElementType.Selection,
                ElementType.CaseStudy,
              ].includes(element.instance.elementType)

              return (
                <ShadcnTableRow
                  key={instanceId}
                  className={twMerge(
                    'hover:bg-muted/50',
                    isOutdated && 'bg-uzh-red-20/50 hover:bg-uzh-red-20 py-1',
                    selectedInstanceId === element.instance.id &&
                      'bg-uzh-blue-20/60 hover:bg-uzh-blue-20/80'
                  )}
                  data-cy={`stack-${stackIx}-instance-${instanceIx}`}
                >
                  <ShadcnTableCell className="whitespace-normal py-2">
                    <div className="flex items-center gap-2">
                      <div className="line-clamp-1 text-sm font-bold">
                        {element.instance.elementData.name}
                      </div>
                      {isOutdated && (
                        <ActivityOutdatedElementWarning
                          status={details.status}
                        />
                      )}
                    </div>
                    <div className="text-muted-foreground flex flex-row items-center gap-3 text-xs">
                      <span>
                        {t(`shared.${element.instance.elementType}.typeLabel`)}
                      </span>
                      {isInstanceQuestion && (
                        <span className="flex flex-row items-center gap-1.5">
                          {`${t('manage.general.sampleSolutionDescription')}: `}
                          {element.hasSampleSolution ? (
                            <FontAwesomeIcon
                              icon={faCheckSquare}
                              className="text-uzh-darkgreen-100"
                              size="1x"
                            />
                          ) : (
                            <FontAwesomeIcon
                              icon={faXmarkSquare}
                              className="text-red-600"
                              size="1x"
                            />
                          )}
                        </span>
                      )}
                    </div>
                  </ShadcnTableCell>
                  {details.arePointsAwarded && (
                    <>
                      {isLiveQuiz && (
                        <>
                          <ShadcnTableCell
                            className="text-center align-middle"
                            data-cy={`base-points-stack-${stackIx}-instance-${instanceIx}`}
                          >
                            {`${element.basePoints ?? 0} P.`}
                          </ShadcnTableCell>
                          <ShadcnTableCell
                            className="text-center align-middle"
                            data-cy={`correctness-points-stack-${stackIx}-instance-${instanceIx}`}
                          >
                            {`${element.correctnessPoints ?? 0} P.`}
                          </ShadcnTableCell>
                          <ShadcnTableCell
                            className="text-center align-middle"
                            data-cy={`bonus-points-stack-${stackIx}-instance-${instanceIx}`}
                          >
                            {`${element.bonusPoints ?? 0} P.`}
                          </ShadcnTableCell>
                        </>
                      )}
                      <ShadcnTableCell
                        className="text-uzh-darkgreen-100 text-center align-middle"
                        data-cy={`total-points-stack-${stackIx}-instance-${instanceIx}`}
                      >
                        {`${element.totalPoints} P.`}
                      </ShadcnTableCell>
                    </>
                  )}
                  <ShadcnTableCell className="text-center align-middle">
                    <Tooltip tooltip={t('manage.activities.previewElement')}>
                      <Button
                        basic
                        size="icon"
                        className={{ root: 'h-8 w-8' }}
                        onClick={() => {
                          setSelectedInstanceId(element.instance.id)
                        }}
                        data-cy={`preview-instance-${element.instance.elementData.name}`}
                      >
                        <FontAwesomeIcon icon={faMagnifyingGlass} size="sm" />
                      </Button>
                    </Tooltip>
                    <Tooltip
                      tooltip={
                        element.isEditor && !element.isDeleted
                          ? t('manage.activities.editElement')
                          : element.isDeleted
                            ? t('manage.activities.deletedElement')
                            : t('manage.activities.noElementEditPermissions')
                      }
                    >
                      <Button
                        basic
                        size="icon"
                        className={{ root: 'h-8 w-8' }}
                        disabled={!element.isEditor || element.isDeleted}
                        onClick={() => {
                          router.push({
                            pathname: '/',
                            query: {
                              editElementId:
                                element.instance.elementData.elementId,
                              contextActivityId: details.id,
                              contextActivityType: activityType,
                            },
                          })
                        }}
                        data-cy={`open-element-${element.instance.elementData.name}`}
                      >
                        <FontAwesomeIcon icon={faPencil} size="sm" />
                      </Button>
                    </Tooltip>
                  </ShadcnTableCell>
                </ShadcnTableRow>
              )
            })}

            {stackIx < stacks.length - 1 && (
              <ShadcnTableRow className="h-4">
                <ShadcnTableCell
                  colSpan={details.arePointsAwarded ? 6 : 2}
                  className="border-0 p-0"
                />
              </ShadcnTableRow>
            )}
          </>
        ))}
      </ShadcnTableBody>
      {details.arePointsAwarded && (
        <ShadcnTableFooter>
          <ShadcnTableRow className="py-2.5 font-bold">
            <ShadcnTableCell>{`${t('shared.generic.total')}`}</ShadcnTableCell>
            {isLiveQuiz && (
              <>
                <ShadcnTableCell
                  className="text-center"
                  data-cy="base-points-activity"
                >
                  {details?.totalBasePoints ?? 0} P.
                </ShadcnTableCell>
                <ShadcnTableCell
                  className="text-center"
                  data-cy="correctness-points-activity"
                >
                  {details?.totalCorrectnessPoints ?? 0} P.
                </ShadcnTableCell>
                <ShadcnTableCell
                  className="text-center"
                  data-cy="bonus-points-activity"
                >
                  {details?.totalBonusPoints ?? 0} P.
                </ShadcnTableCell>
              </>
            )}
            <ShadcnTableCell
              className="text-uzh-darkgreen-100 text-center"
              data-cy="total-points-activity"
            >
              {details?.totalPoints ?? 0} P.
            </ShadcnTableCell>
            <ShadcnTableCell />
          </ShadcnTableRow>
        </ShadcnTableFooter>
      )}
    </ShadcnTable>
  )
}

export default ActivityOverviewTable
