import {
  faArchive,
  faCheck,
  faInbox,
  faQuestionCircle,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Element,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Modal,
  Select,
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCell,
  ShadcnTableRow,
  Switch,
  Tooltip,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { isShallowEqual } from 'remeda'
import { twMerge } from 'tailwind-merge'
import ObjectPermissionLevel from '~/components/sharing/ObjectPermissionLevel'

type BatchOperationActions = {
  archive: boolean
  unarchive: boolean
  status?: ElementStatus
  multiplier?: string
  basePoints?: boolean
}

const INITIAL_FILTERS: BatchOperationActions = {
  archive: false,
  unarchive: false,
  status: undefined,
  multiplier: undefined,
  basePoints: undefined,
}

function ElementBatchOperationsModal({
  selectedElements,
  onClose,
  resetSelectedElements,
  refetchElements,
}: {
  selectedElements: Element[]
  onClose: () => void
  resetSelectedElements: () => void
  refetchElements: () => Promise<void>
}) {
  const t = useTranslations()
  const [affectedElements, setAffectedElements] = useState(
    selectedElements.map((element) => element.id)
  )
  const [selectedActions, setSelectedActions] =
    useState<BatchOperationActions>(INITIAL_FILTERS)

  // check if user has owner / admin permissions on all elements
  const allAdminPermissions = useMemo(
    () => selectedElements.every((element) => element.isManager),
    [selectedElements]
  )

  // whenever the applied filters change, update the affected elements
  useEffect(() => {
    let filtered = [...selectedElements]

    if (selectedActions.unarchive) {
      filtered = filtered.filter(
        (element) => element.isArchived && element.isManager
      )
    } else if (selectedActions.archive) {
      filtered = filtered.filter(
        (element) => !element.isArchived && element.isManager
      )
    }
    if (selectedActions.multiplier) {
      filtered = filtered.filter(
        (element) =>
          element.isEditor &&
          'options' in element &&
          element.options.hasSampleSolution
      )
    }
    if (typeof selectedActions.basePoints !== 'undefined') {
      filtered = filtered.filter(
        (element) =>
          element.isEditor &&
          element.type !== ElementType.Flashcard &&
          element.type !== ElementType.Content
      )
    }

    // return the filtered and mapped elements (unfiltered if no relevant action applied)
    setAffectedElements(filtered.map((element) => element.id))
  }, [selectedActions])

  return (
    <Modal
      open
      onClose={onClose}
      title={t('manage.questionPool.batchOperationsElements')}
      className={{
        content: 'xl:w-220 h-max w-[calc(100%-2rem)] lg:overflow-hidden',
      }}
    >
      <div className="flex h-auto min-h-0 flex-col gap-6 md:flex-row md:gap-6 lg:h-full lg:max-h-full">
        <div className="flex h-max max-h-full min-h-0 w-full flex-col gap-4 overflow-auto md:w-1/2 lg:max-h-[calc(100vh-6rem)] lg:w-2/5">
          <div className="text-sm">
            {t('manage.questionPool.selectedElementsDescription')}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <ShadcnTable className="mt-2">
              <ShadcnTableBody>
                {selectedElements.map((element) => {
                  const isAffected = affectedElements.includes(element.id)

                  return (
                    <ShadcnTableRow
                      key={element.id}
                      data-cy={`element-batch-entry-${element.name}`}
                    >
                      <ShadcnTableCell
                        className={twMerge(
                          'line-clamp-1 h-7 whitespace-normal',
                          !isAffected && 'text-black/30'
                        )}
                      >
                        {element.name}
                      </ShadcnTableCell>
                      {!allAdminPermissions ? (
                        !element.isOwner ? (
                          <ShadcnTableCell className="w-5.5 px-0 text-center">
                            <ObjectPermissionLevel
                              iconOnly
                              objectName={element.name}
                              permissionLevel={element.permissionLevel!}
                            />
                          </ShadcnTableCell>
                        ) : (
                          <ShadcnTableCell className="w-5.5" />
                        )
                      ) : null}
                      <ShadcnTableCell className="w-5.5 px-0 text-center">
                        {isAffected ? (
                          <FontAwesomeIcon
                            icon={faCheck}
                            className="text-green-600"
                            data-cy={`element-batch-check-${element.name}`}
                          />
                        ) : (
                          <FontAwesomeIcon
                            icon={faX}
                            className="text-red-600"
                            data-cy={`element-batch-x-${element.name}`}
                          />
                        )}
                      </ShadcnTableCell>
                    </ShadcnTableRow>
                  )
                })}
              </ShadcnTableBody>
            </ShadcnTable>
          </div>
        </div>
        <div className="w-full overflow-auto px-0.5 pb-2 md:w-1/2 lg:max-h-[calc(100vh-6rem)] lg:w-3/5">
          <div className="flex flex-row items-center gap-2.5">
            <div className="font-bold">
              {t('shared.generic.availableActions')}
            </div>
            <Tooltip
              delay={0}
              tooltip={t.rich('manage.questionPool.batchUpdatesInformation', {
                b: (content) => <b>{content}</b>,
                ul: (content) => <ul className="list-disc pl-4">{content}</ul>,
                li: (content) => <li className="mt-0.5">{content}</li>,
              })}
              className={{ tooltip: 'border-primary-100 text-wrap' }}
            >
              <FontAwesomeIcon
                size="lg"
                icon={faQuestionCircle}
                className="text-uzh-blue-60"
                data-cy="activity-outdated-element-warning"
              />
            </Tooltip>
          </div>

          <div className="mt-2 flex flex-col gap-3">
            <Card
              className={twMerge(
                'gap-1 px-4 py-3',
                (selectedActions.archive || selectedActions.unarchive) &&
                  'ring-primary-100 ring-1'
              )}
            >
              <CardHeader className="px-0">
                <CardTitle className="font-normal">
                  {t('shared.generic.archive')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <div className="flex flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
                  <Button
                    active={selectedActions.archive}
                    onClick={() => {
                      setSelectedActions((prev) => ({
                        ...INITIAL_FILTERS,
                        archive: !prev.archive,
                        unarchive: false,
                      }))
                    }}
                    className={{ root: 'h-8 flex-1 text-sm' }}
                    data={{ cy: 'archive-button' }}
                  >
                    <Button.Icon icon={faArchive} />
                    <Button.Label>
                      {t('manage.questionPool.moveToArchive')}
                    </Button.Label>
                  </Button>
                  <Button
                    active={selectedActions.unarchive}
                    onClick={() => {
                      setSelectedActions((prev) => ({
                        ...INITIAL_FILTERS,
                        unarchive: !prev.unarchive,
                        archive: false,
                      }))
                    }}
                    className={{ root: 'h-8 flex-1 text-sm' }}
                    data={{ cy: 'unarchive-button' }}
                  >
                    <Button.Icon icon={faInbox} />
                    <Button.Label>
                      {t('manage.questionPool.restoreFromArchive')}
                    </Button.Label>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Card
                className={twMerge(
                  'gap-1 px-4 py-3',
                  typeof selectedActions.status !== 'undefined' &&
                    'ring-primary-100 ring-1'
                )}
              >
                <CardHeader className="px-0">
                  <CardTitle className="font-normal">
                    {t('manage.questionPool.modifyStatus')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={typeof selectedActions.status !== 'undefined'}
                      onCheck={() => {
                        setSelectedActions((prev) => ({
                          ...prev,
                          archive: false,
                          unarchive: false,
                          status:
                            typeof selectedActions.status !== 'undefined'
                              ? undefined
                              : ElementStatus.Draft,
                        }))
                      }}
                      data={{ cy: 'status-checkbox' }}
                    />
                    <Select
                      value={selectedActions.status ?? ElementStatus.Draft}
                      items={[
                        ...Object.values(ElementStatus).map((status) => ({
                          value: status,
                          label: t(`shared.${status}.statusLabel`),
                        })),
                      ]}
                      onChange={(value) => {
                        setSelectedActions((prev) => ({
                          ...prev,
                          status: value as ElementStatus,
                        }))
                      }}
                      className={{ root: 'h-8 w-44', trigger: 'h-8' }}
                      data={{ cy: 'element-status-select' }}
                      disabled={typeof selectedActions.status === 'undefined'}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card
                className={twMerge(
                  'gap-1 px-4 py-3',
                  typeof selectedActions.multiplier !== 'undefined' &&
                    'ring-primary-100 ring-1'
                )}
              >
                <CardHeader className="px-0">
                  <CardTitle className="font-normal">
                    {t('manage.questionPool.modifyMultiplier')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={
                        typeof selectedActions.multiplier !== 'undefined'
                      }
                      onCheck={() => {
                        setSelectedActions((prev) => ({
                          ...prev,
                          archive: false,
                          unarchive: false,
                          multiplier:
                            typeof selectedActions.multiplier !== 'undefined'
                              ? undefined
                              : '1',
                        }))
                      }}
                      data={{ cy: 'multiplier-checkbox' }}
                    />
                    <Select
                      value={selectedActions.multiplier ?? '1'}
                      onChange={(value) => {
                        setSelectedActions((prev) => ({
                          ...prev,
                          multiplier: value,
                        }))
                      }}
                      items={[
                        {
                          label: t('manage.activityWizard.multiplier1'),
                          value: '1',
                          data: {
                            cy: `select-multiplier-${t('manage.activityWizard.multiplier1')}`,
                          },
                        },
                        {
                          label: t('manage.activityWizard.multiplier2'),
                          value: '2',
                          data: {
                            cy: `select-multiplier-${t('manage.activityWizard.multiplier2')}`,
                          },
                        },
                        {
                          label: t('manage.activityWizard.multiplier3'),
                          value: '3',
                          data: {
                            cy: `select-multiplier-${t('manage.activityWizard.multiplier3')}`,
                          },
                        },
                        {
                          label: t('manage.activityWizard.multiplier4'),
                          value: '4',
                          data: {
                            cy: `select-multiplier-${t('manage.activityWizard.multiplier4')}`,
                          },
                        },
                      ]}
                      data={{ cy: 'select-multiplier' }}
                      className={{ root: 'h-8 w-44', trigger: 'h-8' }}
                      disabled={
                        typeof selectedActions.multiplier === 'undefined'
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card
                className={twMerge(
                  'gap-1 px-4 py-3 lg:col-span-2',
                  typeof selectedActions.basePoints !== 'undefined' &&
                    'ring-primary-100 ring-1'
                )}
              >
                <CardHeader className="px-0">
                  <CardTitle className="font-normal">
                    {t('manage.questionPool.modifyBasePoints')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={
                        typeof selectedActions.basePoints !== 'undefined'
                      }
                      onCheck={() => {
                        setSelectedActions((prev) => ({
                          ...prev,
                          archive: false,
                          unarchive: false,
                          basePoints:
                            typeof selectedActions.basePoints !== 'undefined'
                              ? undefined
                              : true,
                        }))
                      }}
                      data={{ cy: 'base-points-checkbox' }}
                    />
                    <span className="text-sm text-gray-600">
                      {t('manage.questionPool.grantBasePoints')}
                    </span>
                    <Switch
                      checked={selectedActions.basePoints ?? true}
                      onCheckedChange={(checked) => {
                        setSelectedActions((prev) => ({
                          ...prev,
                          basePoints: checked,
                        }))
                      }}
                      data={{ cy: 'base-points-switch' }}
                      disabled={
                        typeof selectedActions.basePoints === 'undefined'
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="flex flex-row items-center gap-5 self-end">
              <span
                className={twMerge(
                  'text-sm text-green-600',
                  affectedElements.length === 0 && 'text-red-600'
                )}
              >
                <FontAwesomeIcon
                  icon={affectedElements.length === 0 ? faX : faCheck}
                  className="mr-1.5"
                />
                {affectedElements.length === 0
                  ? t('manage.questionPool.noElementsWillBeUpdated')
                  : t('manage.questionPool.nElementsWillBeUpdated', {
                      number: affectedElements.length,
                    })}
              </span>
              <Button
                primary
                disabled={
                  affectedElements.length === 0 ||
                  isShallowEqual(selectedActions, INITIAL_FILTERS)
                }
                className={{ root: 'h-9' }}
              >
                {t('shared.generic.apply')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ElementBatchOperationsModal
