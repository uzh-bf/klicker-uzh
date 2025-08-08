import {
  faCheckSquare,
  faEye,
  faPencil,
  faXmarkSquare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityDetails,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
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
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import ActivityOutdatedElementWarning from './ActivityOutdatedElementWarning'

function ActivityOverviewTable({
  details,
  activityStatus,
  isLiveQuiz,
  outdatedInstances,
  setSelectedInstanceId,
}: {
  details: ActivityDetails
  activityStatus: PublicationStatus
  isLiveQuiz: boolean
  outdatedInstances: number[]
  setSelectedInstanceId: Dispatch<SetStateAction<number | null>>
}) {
  const t = useTranslations()
  const router = useRouter()
  const stacks = details.stacks ?? []

  return (
    <ShadcnTable className="text-sm">
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
            >
              <ShadcnTableCell colSpan={isLiveQuiz ? 4 : 1} className="py-1">
                <div className="flex items-center font-bold">
                  {isLiveQuiz
                    ? t('shared.generic.blockN', {
                        number: stackIx + 1,
                      })
                    : t('shared.generic.stackN', {
                        number: stackIx + 1,
                      })}
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

            {stack.elements.map((element) => {
              const instanceId = String(element.instance.id)
              const isOutdated = outdatedInstances.includes(element.instance.id)

              return (
                <ShadcnTableRow
                  key={instanceId}
                  className={twMerge(
                    'hover:bg-muted/50',
                    isOutdated && 'bg-uzh-red-20/50 hover:bg-uzh-red-20 py-1'
                  )}
                  data-cy={`activity-instance-row-${element.instance.elementData.name}`}
                >
                  <ShadcnTableCell className="whitespace-normal py-2">
                    <div className="flex items-center gap-2">
                      <div className="line-clamp-1 text-sm font-bold">
                        {element.instance.elementData.name}
                      </div>
                      {isOutdated && (
                        <ActivityOutdatedElementWarning
                          status={activityStatus}
                        />
                      )}
                    </div>
                    <div className="text-muted-foreground flex flex-row items-center gap-3 text-xs">
                      <span>
                        {t(`shared.${element.instance.elementType}.typeLabel`)}
                      </span>
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
                    </div>
                  </ShadcnTableCell>
                  {details.arePointsAwarded && (
                    <>
                      {isLiveQuiz && (
                        <>
                          <ShadcnTableCell className="text-center align-middle">
                            {`${element.basePoints ?? 0} P.`}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="text-center align-middle">
                            {`${element.correctnessPoints ?? 0} P.`}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="text-center align-middle">
                            {`${element.bonusPoints ?? 0} P.`}
                          </ShadcnTableCell>
                        </>
                      )}
                      <ShadcnTableCell className="text-uzh-darkgreen-100 text-center align-middle">
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
                        <FontAwesomeIcon icon={faEye} size="sm" />
                      </Button>
                    </Tooltip>
                    <Tooltip
                      tooltip={
                        element.isEditor
                          ? t('manage.activities.editElement')
                          : t('manage.activities.noElementEditPermissions')
                      }
                    >
                      <Button
                        basic
                        size="icon"
                        className={{ root: 'h-8 w-8' }}
                        disabled={!element.isEditor}
                        onClick={() => {
                          router.push({
                            pathname: '/',
                            query: {
                              editElementId:
                                element.instance.elementData.elementId,
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

            {/* Add spacing between stacks */}
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
            <ShadcnTableCell>{t('shared.generic.total')}</ShadcnTableCell>
            {isLiveQuiz && (
              <>
                <ShadcnTableCell className="text-center">
                  {details?.totalBasePoints ?? 0} P.
                </ShadcnTableCell>
                <ShadcnTableCell className="text-center">
                  {details?.totalCorrectnessPoints ?? 0} P.
                </ShadcnTableCell>
                <ShadcnTableCell className="text-center">
                  {details?.totalBonusPoints ?? 0} P.
                </ShadcnTableCell>
              </>
            )}
            <ShadcnTableCell className="text-uzh-darkgreen-100 text-center">
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
