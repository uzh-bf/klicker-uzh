import { useQuery } from '@apollo/client'
import {
  faArrowUpRightFromSquare,
  faCheckSquare,
  faXmarkSquare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityInfo,
  ActivityType,
  GetActivityDetailsDocument,
  GetOutdatedElementInstancesDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Accordion,
  H3,
  Modal,
  RadioGroup,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import StudentElementPreviewActivityDetails from '../../questions/manipulation/StudentElementPreviewActivityDetails'
import ActivityDetailsStack from './ActivityDetailsStack'
import ActivityPointsTable from './ActivityPointsTable'

function ActivityDetailsModal({
  activity,
  onClose,
}: {
  activity: ActivityInfo
  onClose: () => void
}) {
  const t = useTranslations()

  // fetch activity details
  const { data: detailsData, loading } = useQuery(GetActivityDetailsDocument, {
    variables: { activityId: activity.id, activityType: activity.type },
    fetchPolicy: 'cache-and-network',
  })
  const details = detailsData?.activityDetails
  const stacks = detailsData?.activityDetails?.stacks ?? []
  const isLiveQuiz = activity.type === ActivityType.LiveQuiz

  // check which instances are outdated
  const { data } = useQuery(GetOutdatedElementInstancesDocument, {
    variables: {
      instanceIds: stacks.flatMap((stack) =>
        stack.elements.map((element) => element.instance.id)
      ),
    },
    skip: !details,
    fetchPolicy: 'cache-and-network',
  })

  const outdatedInstances = useMemo(
    () =>
      [
        PublicationStatus.Draft,
        PublicationStatus.Scheduled,
        PublicationStatus.Template,
      ].includes(activity.status)
        ? (data?.getOutdatedElementInstances?.map((instance) => instance.id) ??
          [])
        : [],
    [data?.getOutdatedElementInstances]
  )

  // selected instance in stack
  const [selectedInstance, setSelectedInstance] = useState<string>(
    stacks[0]?.elements[0]?.instance.id.toString() ?? ''
  )

  const selected = useMemo(() => {
    const instance = stacks
      .flatMap((s) => s.elements)
      .find((i) => String(i.instance.id) === selectedInstance)

    return instance
  }, [stacks, selectedInstance])

  return (
    <Modal
      open
      loading={loading}
      title={t('manage.activities.activityDetails')}
      onClose={onClose}
      className={{
        content:
          'h-[calc(100%-8rem)]! max-h-[calc(100%-8rem)] xl:overflow-hidden',
      }}
      data={{ cy: 'activity-details-modal' }}
      dataCloseButton={{ cy: 'close-activity-details-modal' }}
    >
      {!!details ? (
        <div className="flex h-auto min-h-0 flex-col gap-4 xl:h-full xl:max-h-full xl:flex-row">
          <div className="flex min-h-0 w-full flex-col gap-2 xl:max-h-[calc(100vh-13rem)] xl:w-2/5 xl:overflow-y-auto xl:pr-10">
            <div className="flex flex-col gap-0.5 text-base">
              <div>
                <span className="font-bold">
                  {t('manage.activityWizard.name')}:
                </span>{' '}
                {details.name}
              </div>
              <div>
                <span className="font-bold">
                  {t('manage.activityWizard.displayName')}:
                </span>{' '}
                {details.displayName}
              </div>
              <div>
                <span className="font-bold">
                  {t('manage.activities.activityType')}:
                </span>{' '}
                {t(`shared.types.${activity.type}`)}
              </div>
            </div>

            {details.arePointsAwarded && (
              <ActivityPointsTable
                isLiveQuiz={isLiveQuiz}
                basePoints={details.totalBasePoints ?? 0}
                correctnessPoints={details.totalCorrectnessPoints ?? 0}
                bonusPoints={details.totalBonusPoints ?? 0}
                totalPoints={details.totalPoints ?? 0}
                type="activity"
              />
            )}

            <Accordion type="multiple" className="w-full">
              <RadioGroup
                value={selectedInstance}
                onValueChange={(val) => setSelectedInstance(val)}
                className="m-0 w-full gap-0 p-0"
              >
                {stacks.map((stack, index) => (
                  <ActivityDetailsStack
                    key={`activity-details-stack-${index}`}
                    stack={stack}
                    stackIx={index}
                    outdatedInstances={outdatedInstances}
                    selectedInstance={selectedInstance}
                    activityStatus={activity.status}
                    isLiveQuiz={isLiveQuiz}
                  />
                ))}
              </RadioGroup>
            </Accordion>
          </div>

          {selected && selected.instance ? (
            <div className="flex h-full min-h-0 w-full flex-col gap-2 xl:max-h-[calc(100vh-13rem)] xl:w-3/5 xl:overflow-y-auto xl:pr-3">
              <div className="flex flex-col gap-0.5 text-base">
                <H3>{selected.instance.elementData.name}</H3>
                <div>
                  <span className="font-bold">{`${t('manage.general.elementTypeDescription')}: `}</span>
                  {t(`shared.${selected.instance.elementType}.typeLabel`)}
                </div>
                <div className="flex flex-row items-center">
                  <span className="mr-2 font-bold">{`${t('manage.general.sampleSolutionDescription')}: `}</span>
                  {selected.hasSampleSolution ? (
                    <FontAwesomeIcon
                      icon={faCheckSquare}
                      className="text-uzh-darkgreen-100"
                      size="lg"
                    />
                  ) : (
                    <FontAwesomeIcon
                      icon={faXmarkSquare}
                      className="text-red-600"
                      size="lg"
                    />
                  )}
                </div>
                {details.arePointsAwarded && (
                  <ActivityPointsTable
                    isLiveQuiz={isLiveQuiz}
                    basePoints={selected.basePoints ?? 0}
                    correctnessPoints={selected.correctnessPoints ?? 0}
                    bonusPoints={selected.bonusPoints ?? 0}
                    totalPoints={selected.totalPoints}
                    pointsMultiplier={
                      selected.instance.options?.pointsMultiplier ?? null
                    }
                    type="instance"
                  />
                )}
              </div>
              <div className="flex flex-col">
                <h4 className="mb-1 font-bold">
                  {t('manage.general.elementPreviewDescription')}:
                </h4>
                <StudentElementPreviewActivityDetails
                  instance={selected.instance}
                />
              </div>
              <div className="flex flex-row items-center justify-center gap-5">
                <Link
                  href={`/instances/${selected.instance.id}`}
                  className="ml-auto text-sm hover:text-slate-700"
                  key={selected.instance.id}
                  legacyBehavior
                  passHref
                >
                  <a
                    data-cy={`open-instance-${selected.instance.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-100 flex flex-row items-center gap-2 text-sm font-normal hover:underline"
                  >
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                    {t('manage.general.elementPreviewRedirect')}
                  </a>
                </Link>
              </div>
            </div>
          ) : (
            <UserNotification
              type="info"
              className={{ root: 'h-max xl:w-3/5' }}
            >
              {t.rich('manage.activities.activityDetailsNoInstanceSelected', {
                b: (content) => <b>{content}</b>,
                ul: (content) => <ul className="list-disc pl-4">{content}</ul>,
                li: (content) => (
                  <li className="mt-0.5 last:hidden">{content}</li>
                ),
              })}
            </UserNotification>
          )}
        </div>
      ) : (
        // TODO: display error message
        <UserNotification type="error" message="TODO" />
      )}
    </Modal>
  )
}

export default ActivityDetailsModal
