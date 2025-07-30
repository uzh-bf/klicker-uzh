import { useQuery } from '@apollo/client'
import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowUpRightFromSquare,
  faBookOpen,
  faCheckCircle,
  faCheckSquare,
  faExclamationTriangle,
  faUserGroup,
  faXmarkSquare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityInfo,
  ActivityInfoElement,
  ActivityType,
  ElementInstance,
  GetActivityDetailsDocument,
  GetOutdatedElementInstancesDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Modal,
  RadioGroup,
  RadioGroupItem,
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCell,
  ShadcnTableFooter,
  ShadcnTableHead,
  ShadcnTableHeader,
  ShadcnTableRow,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import StudentElementPreviewActivityDetails from '../../questions/manipulation/StudentElementPreviewActivityDetails'

// Validate function to ensure numeric values are correctly handled
function validate(obj: any): number {
  return obj !== null && typeof obj === 'number' ? obj : 0
}

function ActivityDetailsModal({
  activity,
  onClose,
}: {
  activity: ActivityInfo
  onClose: () => void
}) {
  const t = useTranslations()

  // fetch activity details
  const { data: activityDetails, loading } = useQuery(
    GetActivityDetailsDocument,
    { variables: { activityId: activity.id, activityType: activity.type } }
  )
  const stacks = activityDetails?.activityDetails?.stacks ?? []

  // check which instances are outdated
  const { data } = useQuery(GetOutdatedElementInstancesDocument, {
    variables: {
      instanceIds: stacks.flatMap((stack) =>
        stack.elements.map((element) => element.instance.id)
      ),
    },
    skip: !activityDetails,
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

  // State for selected radio button per stack
  const [selectedInstance, setSelectedInstance] = useState<string>(
    stacks[0]?.elements[0]?.instance.id.toString() ?? ''
  )

  const selectedInstanceObj = useMemo(() => {
    const instance = stacks
      .flatMap((s) => s.elements)
      .find((i) => String(i.instance.id) === selectedInstance)
    return instance
      ? {
          instance: instance.instance as ElementInstance,
          element: instance as ActivityInfoElement,
        }
      : undefined
  }, [stacks, selectedInstance])

  const metadata = !loading
    ? activityDetails?.activityDetails?.metadata
    : undefined
  const pointMultiplierActivity = validate(metadata?.pointsMultiplier)
  const basePointsActivity = validate(metadata?.totalBasePoints)
  const correctnessPointsActivity = validate(metadata?.totalCorrectnessPoints)
  const bonusPointsActivity = validate(metadata?.totalBonusPoints)
  const totalPointsActivity = validate(metadata?.totalPoints)

  const isLiveQuiz = metadata?.type === ActivityType.LiveQuiz

  return (
    <Modal
      open
      loading={loading}
      title={t('manage.activities.activityDetails')}
      onClose={onClose}
      className={{
        content:
          'w-full! h-[calc(100%-15rem)]! max-h-[calc(100%-15rem)] max-w-[calc(100%-15rem)] xl:overflow-hidden',
      }}
      data={{ cy: 'activity-details-modal' }}
      dataCloseButton={{ cy: 'close-activity-details-modal' }}
    >
      {outdatedInstances.length > 0 && (
        <UserNotification type="warning" className={{ root: 'mb-4' }}>
          {t.rich(
            activity.status === PublicationStatus.Template
              ? 'manage.activities.instanceUpdateTemplate'
              : 'manage.activities.instanceUpdateDraftScheduled',
            {
              b: (content) => <b>{content}</b>,
              ul: (content) => <ul className="list-disc pl-4">{content}</ul>,
              li: (content) => (
                <li className="mt-0.5 last:hidden">{content}</li>
              ),
            }
          )}
        </UserNotification>
      )}
      <div
        className="flex h-auto min-h-0 flex-col gap-4 xl:h-full xl:max-h-full xl:flex-row"
        data-cy="activity-details-modal"
      >
        <div
          className="flex min-h-0 w-full flex-col gap-4 xl:max-h-[calc(100vh-20rem)] xl:w-2/5 xl:overflow-y-auto xl:pr-10"
          data-cy="activity-details-modal"
        >
          <ul>
            <li>
              <span className="font-bold">
                {t('manage.activityWizard.name')}:
              </span>{' '}
              {metadata?.name}
            </li>
            <li>
              <span className="font-bold">
                {t('manage.activityWizard.displayName')}:
              </span>{' '}
              {metadata?.displayName}
            </li>
          </ul>
          <div className="flex flex-col">
            <ShadcnTable className="mb-2">
              <ShadcnTableHeader>
                <ShadcnTableRow>
                  <ShadcnTableHead className="font-bold">
                    {t('manage.general.pointTypeDescription')}
                  </ShadcnTableHead>
                  <ShadcnTableHead className="text-right font-bold">
                    {t('manage.general.pointAmountDescription')}
                  </ShadcnTableHead>
                </ShadcnTableRow>
              </ShadcnTableHeader>
              {isLiveQuiz ? (
                <ShadcnTableBody>
                  <ShadcnTableRow>
                    <ShadcnTableCell>
                      {t('manage.general.basePointsDescription')}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="text-right">
                      {`${basePointsActivity} P.`}
                    </ShadcnTableCell>
                  </ShadcnTableRow>
                  <ShadcnTableRow>
                    <ShadcnTableCell>
                      {`${t('manage.general.correctnessPointsDescription')}${` (${t('manage.general.pointsMultiplierDescription')} ${pointMultiplierActivity}x)`}`}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="text-right">
                      {`${correctnessPointsActivity} P.`}
                    </ShadcnTableCell>
                  </ShadcnTableRow>
                  <ShadcnTableRow>
                    <ShadcnTableCell>
                      {`${t('manage.general.bonusPointsDescription')}${` (${t('manage.general.pointsMultiplierDescription')} ${pointMultiplierActivity}x)`}`}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="text-right">
                      {`${bonusPointsActivity} P.`}
                    </ShadcnTableCell>
                  </ShadcnTableRow>
                </ShadcnTableBody>
              ) : null}
              <ShadcnTableFooter>
                <ShadcnTableRow>
                  <ShadcnTableCell colSpan={1} className="font-bold">
                    {isLiveQuiz ? (
                      t('manage.general.totalPointsSynchronousDescription')
                    ) : (
                      <>
                        {t('manage.general.totalPointsAsynchronousDescription')}
                        <span className="font-normal">
                          {` (${t(
                            'manage.general.pointsMultiplierDescription'
                          )} ${pointMultiplierActivity}x)`}
                        </span>
                      </>
                    )}
                  </ShadcnTableCell>
                  <ShadcnTableCell className="text-uzh-darkgreen-100 text-right font-bold">
                    {`${totalPointsActivity} P.`}
                  </ShadcnTableCell>
                </ShadcnTableRow>
              </ShadcnTableFooter>
            </ShadcnTable>
            <div className="flex justify-end">
              <Link
                href={'https://www.klicker.uzh.ch/gamification/grading_logic/'}
                passHref
                legacyBehavior
              >
                <a
                  className="text-primary-100 flex flex-row items-center gap-2 text-sm font-normal hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FontAwesomeIcon icon={faBookOpen} />
                  {t('manage.general.gradingDescription')}
                </a>
              </Link>
            </div>
          </div>
          <Accordion type="multiple" className="w-full">
            <RadioGroup
              value={selectedInstance}
              onValueChange={(val) => setSelectedInstance(val)}
              className="m-0 w-full gap-0 p-0"
            >
              {stacks.map((stack, index) => (
                <AccordionItem
                  value={String(stack.id)}
                  key={stack.id}
                  className="m-0 w-full space-y-0 border-gray-300 p-2"
                >
                  <div key={stack.id} className="w-full">
                    <AccordionTrigger className="flex w-full flex-row items-center justify-between p-2 hover:no-underline">
                      <span className="flex-1 font-bold hover:underline">
                        {activity.type === ActivityType.LiveQuiz
                          ? t('shared.generic.blockN', {
                              number: index + 1,
                            })
                          : t('shared.generic.stackN', {
                              number: index + 1,
                            })}
                      </span>
                      <div className="flex flex-row items-center justify-end gap-3">
                        {stack.elements.filter((element) =>
                          outdatedInstances.includes(element.instance.id)
                        ).length > 0 ? (
                          <FontAwesomeIcon
                            icon={faExclamationTriangle}
                            className="text-uzh-red-100"
                          />
                        ) : null}
                        {stack.stackPoints !== null ? (
                          <span className="text-uzh-darkgreen-100">
                            {stack.stackPoints} P.
                          </span>
                        ) : null}
                        {stack.timeLimit !== null ? (
                          <div className="flex flex-row items-center gap-1.5 text-orange-500 no-underline">
                            <div>{`${stack.timeLimit}s`}</div>
                            <FontAwesomeIcon icon={faClock} className="w-4" />
                          </div>
                        ) : null}
                        {stack.numOfParticipants !== null ? (
                          <div className="flex flex-row items-center gap-1 no-underline">
                            <div>{stack.numOfParticipants}</div>
                            <FontAwesomeIcon
                              icon={faUserGroup}
                              className="w-4"
                            />
                          </div>
                        ) : null}
                      </div>
                    </AccordionTrigger>

                    <AccordionContent>
                      <div className="float-right text-sm">
                        {t('shared.generic.Nelements', {
                          number: stack.elements?.length,
                        })}
                      </div>
                      {stack.elements.map((element, instanceIx) => {
                        const instance = element.instance
                        const isSelectedInstance =
                          selectedInstance === String(instance.id)
                        return (
                          <label
                            key={instance.id}
                            htmlFor={String(instance.id)}
                            className={twMerge(
                              'border-uzh-grey-40 mb-2 flex w-full cursor-pointer flex-row items-center gap-1 rounded border pb-3 pt-3 transition-colors',
                              'hover:border-uzh-blue-60'
                            )}
                            data-cy={`stack-${index}-instance-${instanceIx}`}
                          >
                            <div className="w-9/10 flex flex-row">
                              <RadioGroupItem
                                value={String(instance.id)}
                                id={String(instance.id)}
                                className="invisible cursor-pointer"
                              />

                              {isSelectedInstance ? (
                                <FontAwesomeIcon
                                  icon={faCheckCircle}
                                  className={twMerge(
                                    'text-uzh-blue-60 text-lg'
                                  )}
                                />
                              ) : null}

                              <span
                                className={twMerge(
                                  'line-clamp-1 font-semibold',
                                  isSelectedInstance ? 'pl-2' : 'pl-6.5'
                                )}
                              >
                                {`${t(`shared.${instance.elementData.type}.short`)}: ${instance.elementData.name}`}
                              </span>
                            </div>
                            {outdatedInstances.includes(instance.id) ? (
                              <FontAwesomeIcon
                                icon={faExclamationTriangle}
                                className={twMerge('text-uzh-red-100')}
                              />
                            ) : null}
                          </label>
                        )
                      })}
                    </AccordionContent>
                  </div>
                </AccordionItem>
              ))}
            </RadioGroup>
          </Accordion>
        </div>
        {selectedInstanceObj &&
        selectedInstanceObj.element &&
        selectedInstanceObj.instance ? (
          <div className="flex h-full min-h-0 w-full flex-col gap-4 xl:max-h-[calc(100vh-20rem)] xl:w-3/5 xl:overflow-y-auto xl:pr-3">
            <div className="flex flex-col gap-2">
              <h3 className="text-2xl font-bold">
                {selectedInstanceObj.element.instance.elementData.name}
              </h3>
              <ul className="font-bold">
                <li>
                  {`${t('manage.general.elementTypeDescription')}: `}
                  <span className="font-normal">
                    {t(
                      `shared.${selectedInstanceObj.element.instance.elementData.type}.typeLabel`
                    )}
                  </span>
                </li>
                <li>
                  {`${t('manage.general.sampleSolutionDescription')}: `}
                  <span className="font-normal">
                    {selectedInstanceObj.element.hasSampleSolution ? (
                      <FontAwesomeIcon
                        icon={faCheckSquare}
                        className="text-uzh-darkgreen-100"
                      />
                    ) : (
                      <FontAwesomeIcon
                        icon={faXmarkSquare}
                        className="text-uzh-red-100"
                      />
                    )}
                  </span>
                </li>
                <li>
                  <ShadcnTable className="font-normal">
                    <ShadcnTableHeader>
                      <ShadcnTableRow>
                        <ShadcnTableHead className="font-bold">
                          {t('manage.general.pointTypeDescription')}
                        </ShadcnTableHead>
                        <ShadcnTableHead className="text-right font-bold">
                          {t('manage.general.pointAmountDescription')}
                        </ShadcnTableHead>
                      </ShadcnTableRow>
                    </ShadcnTableHeader>
                    {isLiveQuiz ? (
                      <ShadcnTableBody>
                        <ShadcnTableRow>
                          <ShadcnTableCell>
                            {t('manage.general.basePointsDescription')}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="text-right">
                            {`${selectedInstanceObj.element.basePoints} P.`}
                          </ShadcnTableCell>
                        </ShadcnTableRow>
                        <ShadcnTableRow>
                          <ShadcnTableCell>
                            {`${t('manage.general.correctnessPointsDescription')}${` (${t('manage.general.pointsMultiplierDescription')} ${validate(selectedInstanceObj.element.instance.elementData.pointsMultiplier)}x)`}`}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="text-right">
                            {`${selectedInstanceObj.element.correctnessPoints} P.`}
                          </ShadcnTableCell>
                        </ShadcnTableRow>
                        <ShadcnTableRow>
                          <ShadcnTableCell>
                            {`${t('manage.general.bonusPointsDescription')}${` (${t('manage.general.pointsMultiplierDescription')} ${validate(selectedInstanceObj.element.instance.elementData.pointsMultiplier)}x)`}`}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="text-right">
                            {`${selectedInstanceObj.element.bonusPoints} P.`}
                          </ShadcnTableCell>
                        </ShadcnTableRow>
                      </ShadcnTableBody>
                    ) : null}

                    <ShadcnTableFooter>
                      <ShadcnTableRow>
                        <ShadcnTableCell colSpan={1} className="font-bold">
                          {isLiveQuiz ? (
                            t(
                              'manage.general.totalPointsSynchronousDescription'
                            )
                          ) : (
                            <>
                              {t(
                                'manage.general.totalPointsAsynchronousDescription'
                              )}
                              <span className="font-normal">
                                {` (${t(
                                  'manage.general.pointsMultiplierDescription'
                                )} ${
                                  selectedInstanceObj.element.instance
                                    .elementData.pointsMultiplier
                                }x)`}
                              </span>
                            </>
                          )}
                        </ShadcnTableCell>
                        <ShadcnTableCell className="text-uzh-darkgreen-100 text-right font-bold">
                          {selectedInstanceObj.element.totalPoints} P.
                        </ShadcnTableCell>
                      </ShadcnTableRow>
                    </ShadcnTableFooter>
                  </ShadcnTable>
                </li>
              </ul>
            </div>
            <div className="flex flex-col">
              <h4 className="mb-1 font-bold">
                {t('manage.general.elementPreviewDescription')}:
              </h4>
              <StudentElementPreviewActivityDetails
                instance={selectedInstanceObj.instance}
              />
            </div>
            <div className="flex flex-row items-center justify-center gap-5">
              <Link
                href={`/instances/${selectedInstanceObj.instance.id}`}
                className="ml-auto text-sm hover:text-slate-700"
                key={selectedInstanceObj.instance.id}
                legacyBehavior
                passHref
              >
                <a
                  data-cy={`open-instance-${selectedInstanceObj.instance.id}`}
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
          <UserNotification type="info" className={{ root: 'h-max xl:w-3/5' }}>
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
    </Modal>
  )
}

export default ActivityDetailsModal
