import { useQuery } from '@apollo/client'
import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowUpRightFromSquare,
  faBookOpen,
  faCheckCircle,
  faExclamationTriangle,
  faUserGroup,
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
import StudentElementPreviewActivityDetails from '~/components/questions/manipulation/StudentElementPreviewActivityDetails'

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
        stack.elements.map((instance) => instance.id)
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
    stacks[0]?.elements[0]?.id.toString() ?? ''
  )

  const selectedInstanceObj = useMemo(() => {
    let foundInstance
    let foundElement
    let foundStackIndex = -1
    stacks.some((stack, stackIndex) => {
      const instance = stack.elements.find(
        (instance) => String(instance.id) === selectedInstance
      )
      if (instance) {
        foundInstance = instance.instance
        foundElement = instance
        foundStackIndex = stackIndex
        return true // stop searching
      }
      return false
    })
    return foundInstance && foundElement
      ? {
          instance: foundInstance as ElementInstance,
          stackIndex: foundStackIndex,
          element: foundElement as ActivityInfoElement,
        }
      : undefined
  }, [stacks, selectedInstance])

  return (
    <Modal
      open
      loading={loading}
      title={t('manage.activities.activityDetails')}
      onClose={onClose}
      className={{ content: 'w-256 min-w-256 max-w-256' }}
      data={{ cy: 'activity-details-modal' }}
      dataCloseButton={{ cy: 'close-activity-details-modal' }}
    >
      {outdatedInstances.length > 0 && (
        <UserNotification type="warning" className={{ root: 'mb-2' }}>
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
      <div className="w-228 h-128 flex flex-row gap-4">
        <div
          className="h-vh flex w-2/5 flex-col gap-4 overflow-x-auto overflow-y-auto pr-10"
          data-cy="activity-details-modal"
        >
          <ul className="">
            <li>
              <span className="font-bold">
                {t('manage.activityWizard.name')}:
              </span>{' '}
              {activityDetails?.activityDetails?.metadata.name}
            </li>
            <li>
              <span className="font-bold">
                {t('manage.activityWizard.displayName')}:
              </span>{' '}
              {activityDetails?.activityDetails?.metadata.displayName}
            </li>
            <li>
              <h3 className="font-bold">
                {t('manage.general.pointsOverviewDescription')}:
              </h3>
              <ShadcnTable>
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
                <ShadcnTableBody>
                  <ShadcnTableRow>
                    <ShadcnTableCell>
                      {t('manage.general.basePointsDescription')}{' '}
                      {activityDetails?.activityDetails?.metadata.type !==
                      ActivityType.LiveQuiz
                        ? `(${t('manage.general.pointsMultiplierDescription')} ${activityDetails?.activityDetails?.metadata.pointsMultiplier}x)`
                        : null}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="text-right">
                      {
                        activityDetails?.activityDetails?.metadata
                          .totalBasePoints
                      }{' '}
                      P.
                    </ShadcnTableCell>
                  </ShadcnTableRow>
                  {activityDetails?.activityDetails?.metadata
                    .totalCorrectnessPoints &&
                  activityDetails?.activityDetails?.metadata
                    .pointsMultiplier ? (
                    <ShadcnTableRow>
                      <ShadcnTableCell>
                        {t('manage.general.correctnessPointsDescription')} (
                        {t('manage.general.pointsMultiplierDescription')}{' '}
                        {
                          activityDetails?.activityDetails?.metadata
                            .pointsMultiplier
                        }
                        x)
                      </ShadcnTableCell>
                      <ShadcnTableCell className="text-right">
                        {
                          activityDetails?.activityDetails?.metadata
                            .totalCorrectnessPoints
                        }{' '}
                        P.
                      </ShadcnTableCell>
                    </ShadcnTableRow>
                  ) : null}
                  {activityDetails?.activityDetails?.metadata
                    .totalBonusPoints &&
                  activityDetails?.activityDetails?.metadata
                    .pointsMultiplier ? (
                    <ShadcnTableRow>
                      <ShadcnTableCell>
                        {t('manage.general.bonusPointsDescription')} (
                        {t('manage.general.pointsMultiplierDescription')}{' '}
                        {
                          activityDetails?.activityDetails?.metadata
                            .pointsMultiplier
                        }
                        x)
                      </ShadcnTableCell>
                      <ShadcnTableCell className="text-right">
                        {
                          activityDetails?.activityDetails?.metadata
                            .totalBonusPoints
                        }{' '}
                        P.
                      </ShadcnTableCell>
                    </ShadcnTableRow>
                  ) : null}
                </ShadcnTableBody>
                <ShadcnTableFooter>
                  <ShadcnTableRow>
                    <ShadcnTableCell colSpan={1}>
                      {t('manage.general.totalPointsDescription')}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="text-right text-violet-500">
                      {activityDetails?.activityDetails?.metadata.totalPoints}{' '}
                      P.
                    </ShadcnTableCell>
                  </ShadcnTableRow>
                </ShadcnTableFooter>
              </ShadcnTable>
            </li>
          </ul>
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
                    <AccordionTrigger className="flex w-full flex-row items-center justify-between p-2">
                      <span className="flex-1 font-bold">
                        {activity.type === ActivityType.LiveQuiz
                          ? t('shared.generic.blockN', {
                              number: index + 1,
                            })
                          : t('shared.generic.stackN', {
                              number: index + 1,
                            })}
                      </span>
                      <div className="flex flex-row justify-end gap-3">
                        {stack.stackPoints !== null ? (
                          <span className="text-violet-500">
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
                      {stack.elements.map((instance, instanceIx) => (
                        <label
                          key={instance.id}
                          htmlFor={String(instance.id)}
                          className={twMerge(
                            'group relative mb-2 flex w-full cursor-pointer flex-row items-center gap-2 rounded border border-gray-300 bg-white px-4 py-3 transition-colors',
                            'hover:border-blue-400'
                          )}
                        >
                          <span className="relative mr-2 flex h-5 w-5 items-center justify-center">
                            <RadioGroupItem
                              value={String(instance.id)}
                              id={String(instance.id)}
                              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                            />
                            {/* Checkmark icon, only visible when checked */}
                            <span className="pointer-events-none">
                              <FontAwesomeIcon
                                icon={faCheckCircle}
                                className={twMerge(
                                  'text-lg text-blue-500 transition-opacity duration-150',
                                  selectedInstance === String(instance.id)
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                              />
                            </span>
                          </span>
                          <span className="flex flex-col">
                            <span className="font-semibold">
                              {instance.name} (
                              {t(`shared.${instance.type}.short`)})
                            </span>
                            <span className="justify-left flex flex-row align-middle text-xs text-gray-500">
                              <span className="text-violet-500">
                                {instance.totalPoints} P.
                              </span>
                            </span>
                          </span>
                          {outdatedInstances.includes(instance.id) ? (
                            <FontAwesomeIcon
                              icon={faExclamationTriangle}
                              className="text-uzh-red-100 mr-1"
                            />
                          ) : null}
                        </label>
                      ))}
                    </AccordionContent>
                  </div>
                </AccordionItem>
              ))}
            </RadioGroup>
          </Accordion>
        </div>
        {selectedInstanceObj && (
          <div className="flex w-3/5 flex-col gap-4 overflow-y-auto pr-3">
            <div>
              <h3 className="text-2xl font-bold">
                {selectedInstanceObj.element.name}
              </h3>
              <ul className="font-bold">
                <li>
                  Typ:{' '}
                  <span className="font-normal">
                    {t(`shared.${selectedInstanceObj.element.type}.typeLabel`)}
                  </span>
                </li>
                <li>
                  {t('manage.general.pointsOverviewDescription')}:
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
                    <ShadcnTableBody>
                      <ShadcnTableRow>
                        <ShadcnTableCell>
                          {t('manage.general.basePointsDescription')}{' '}
                          {activityDetails?.activityDetails?.metadata.type !==
                          ActivityType.LiveQuiz
                            ? `(${t('manage.general.pointsMultiplierDescription')} ${selectedInstanceObj.element.pointsMultiplier}x)`
                            : null}
                        </ShadcnTableCell>
                        <ShadcnTableCell className="text-right">
                          {selectedInstanceObj &&
                            selectedInstanceObj.element &&
                            selectedInstanceObj.element.basePoints}{' '}
                          P.
                        </ShadcnTableCell>
                      </ShadcnTableRow>
                      <ShadcnTableRow>
                        <ShadcnTableCell>
                          {t('manage.general.correctnessPointsDescription')} (
                          {t('manage.general.pointsMultiplierDescription')}{' '}
                          {selectedInstanceObj.element.pointsMultiplier}
                          x)
                        </ShadcnTableCell>
                        <ShadcnTableCell className="text-right">
                          {selectedInstanceObj &&
                            selectedInstanceObj.element &&
                            (selectedInstanceObj.element.correctnessPoints ??
                              0)}{' '}
                          P.
                        </ShadcnTableCell>
                      </ShadcnTableRow>
                      <ShadcnTableRow>
                        <ShadcnTableCell>
                          {t('manage.general.bonusPointsDescription')} (
                          {t('manage.general.pointsMultiplierDescription')}{' '}
                          {selectedInstanceObj.element.pointsMultiplier}
                          x)
                        </ShadcnTableCell>
                        <ShadcnTableCell className="text-right">
                          {selectedInstanceObj &&
                            selectedInstanceObj.element &&
                            (selectedInstanceObj.element.bonusPoints ?? 0)}{' '}
                          P.
                        </ShadcnTableCell>
                      </ShadcnTableRow>
                    </ShadcnTableBody>
                    <ShadcnTableFooter>
                      <ShadcnTableRow>
                        <ShadcnTableCell colSpan={1}>
                          {t('manage.general.totalPointsDescription')}
                        </ShadcnTableCell>
                        <ShadcnTableCell className="text-right text-violet-500">
                          {selectedInstanceObj &&
                            selectedInstanceObj.element &&
                            selectedInstanceObj.element.totalPoints}{' '}
                          P.
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
                  <div
                    className={twMerge(
                      'hover:text-primary-100 flex flex-row items-center justify-between gap-1.5 text-sm',
                      outdatedInstances.includes(
                        selectedInstanceObj.instance.id
                      )
                        ? 'bg-uzh-red-20'
                        : ''
                    )}
                    data-cy={`stack-${selectedInstanceObj.stackIndex}-instance-${selectedInstanceObj.instance.id}`}
                  >
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                    <span className="italic">
                      {t('manage.general.elementPreviewRedirect')}
                    </span>
                  </div>
                </a>
              </Link>

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
                  {t('manage.elements.scoringDocumentation')}
                </a>
              </Link>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ActivityDetailsModal
