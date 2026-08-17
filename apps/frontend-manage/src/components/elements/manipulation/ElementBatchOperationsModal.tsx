import { useQuery } from '@apollo/client'
import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  type Element,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { isShallowEqual, omit } from 'remeda'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import { deriveElementBatchEligibility } from './batchOperations/deriveElementBatchEligibility'
import ElementArchiveCard from './batchOperations/ElementArchiveCard'
import ElementBasePointsCard from './batchOperations/ElementBasePointsCard'
import ElementBatchOperationsInfo from './batchOperations/ElementBatchOperationsInfo'
import ElementBatchOperationsResult from './batchOperations/ElementBatchOperationsResult'
import ElementBatchSharingCard from './batchOperations/ElementBatchSharingCard'
import ElementInstanceUpdatesCard from './batchOperations/ElementInstanceUpdatesCard'
import ElementMultiplierCard from './batchOperations/ElementMultiplierCard'
import ElementStatusCard from './batchOperations/ElementStatusCard'
import SelectedElementsList from './batchOperations/SelectedElementsList'
import {
  type ElementBatchExecutionResult,
  type ElementBatchSharingFormValues,
  INITIAL_ELEMENT_BATCH_SHARING,
} from './batchOperations/types'
import useElementBatchExecution from './batchOperations/useElementBatchExecution'
import {
  type ElementBatchOperationActions,
  INITIAL_ELEMENT_BATCH_OPERATIONS,
} from './types'

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
  const [selectionSnapshot] = useState<Element[]>(() => [...selectedElements])
  const [selectedActions, setSelectedActions] =
    useState<ElementBatchOperationActions>(INITIAL_ELEMENT_BATCH_OPERATIONS)
  const [executionResult, setExecutionResult] =
    useState<ElementBatchExecutionResult>()

  const { data: userData } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })
  const updatesConfigured = useMemo(
    () =>
      !isShallowEqual(
        omit(selectedActions, ['updateInstances', 'updateTemplateInstances']),
        omit(INITIAL_ELEMENT_BATCH_OPERATIONS, [
          'updateInstances',
          'updateTemplateInstances',
        ])
      ),
    [selectedActions]
  )

  const affectedElements = useMemo(
    () =>
      deriveElementBatchEligibility({
        elements: selectionSnapshot,
        selectedActions,
        messages: {
          unarchiveOnlyArchived: t(
            'manage.questionPool.batchUnarchiveOnlyArchivedElements'
          ),
          unarchiveOnlyManager: t(
            'manage.questionPool.batchUnarchiveOnlyManagerElements'
          ),
          archiveOnlyUnarchived: t(
            'manage.questionPool.batchArchiveOnlyUnarchivedElements'
          ),
          archiveOnlyManager: t(
            'manage.questionPool.batchArchiveOnlyManagerElements'
          ),
          multiplierOnlySampleSolution: t(
            'manage.questionPool.batchMultiplierOnlySampleSolution'
          ),
          multiplierOnlyEditor: t(
            'manage.questionPool.batchMultiplierOnlyEditorElements'
          ),
          basePointsOnlyQuestions: t(
            'manage.questionPool.batchBasePointsOnlyQuestions'
          ),
          basePointsOnlyEditor: t(
            'manage.questionPool.batchBasePointsOnlyEditorElements'
          ),
          sharingInsufficientPermission: t(
            'manage.questionPool.batchSharingInsufficientPermission'
          ),
        },
      }),
    [selectionSnapshot, selectedActions, t]
  )

  const numOfUpdatedElements = useMemo(
    () => affectedElements.filter((element) => element.actionsApplied).length,
    [affectedElements]
  )
  const numOfSharedElements = useMemo(
    () => affectedElements.filter((element) => element.sharingApplied).length,
    [affectedElements]
  )

  const sharingValidationSchema = useMemo(
    () =>
      Yup.object().shape({
        enabled: Yup.boolean().required(),
        shortnameOrEmail: Yup.string()
          .trim()
          .test(
            'either-shortname-or-group',
            t('manage.sharing.shortnameEmailOrGroupRequired'),
            function (value) {
              if (!this.parent.enabled) return true
              const userGroupId = this.parent.userGroupId
              return (
                (typeof userGroupId === 'string' &&
                  userGroupId.trim() !== '') ||
                (typeof value === 'string' && value.trim() !== '')
              )
            }
          )
          .test(
            'not-self',
            t('manage.sharing.noSelfSharing'),
            function (value) {
              if (!this.parent.enabled || !value || !userData?.userProfile) {
                return true
              }

              const normalizedValue = value.trim().toLowerCase()
              return ![
                userData.userProfile.shortname,
                userData.userProfile.email,
              ]
                .filter(Boolean)
                .some(
                  (identifier) =>
                    identifier?.trim().toLowerCase() === normalizedValue
                )
            }
          ),
        userGroupId: Yup.string()
          .trim()
          .test(
            'either-group-or-shortname',
            t('manage.sharing.shortnameEmailOrGroupRequired'),
            function (value) {
              if (!this.parent.enabled) return true
              return (
                (typeof this.parent.shortnameOrEmail === 'string' &&
                  this.parent.shortnameOrEmail.trim() !== '') ||
                (typeof value === 'string' && value.trim() !== '')
              )
            }
          ),
        permissionLevel: Yup.string().required(),
      }),
    [t, userData?.userProfile]
  )

  const applyConfiguredOperations = useElementBatchExecution({
    selectionSnapshot,
    affectedElements,
    selectedActions,
    updatesConfigured,
    numOfUpdatedElements,
    refetchElements,
    resetSelectedElements,
    onClose,
    setExecutionResult,
  })

  function closeResult() {
    resetSelectedElements()
    onClose()
  }

  return (
    <Formik<ElementBatchSharingFormValues>
      initialValues={INITIAL_ELEMENT_BATCH_SHARING}
      validationSchema={sharingValidationSchema}
      validateOnMount
      onSubmit={async (values) => {
        await applyConfiguredOperations(values)
      }}
    >
      {({
        values: sharingValues,
        isValid: sharingFormValid,
        isSubmitting,
        submitForm,
      }) => (
        <Modal
          open
          onClose={
            isSubmitting
              ? () => undefined
              : executionResult
                ? closeResult
                : onClose
          }
          title={t('manage.questionPool.batchOperationsElements')}
          className={{
            content: 'xl:w-220 h-max w-[calc(100%-2rem)] lg:overflow-hidden',
          }}
          dataCloseButton={{ cy: 'close-batch-operations-modal' }}
        >
          {executionResult ? (
            <div className="flex max-h-[calc(100vh-6rem)] flex-col gap-5 overflow-auto">
              <ElementBatchOperationsResult result={executionResult} />
              <Button
                primary
                onClick={closeResult}
                disabled={isSubmitting}
                className={{ root: 'h-9 self-end' }}
                data={{ cy: 'close-batch-operations-result' }}
              >
                {t('shared.generic.close')}
              </Button>
            </div>
          ) : (
            <div className="flex h-auto min-h-0 flex-col gap-6 md:flex-row md:gap-6 lg:h-full lg:max-h-full">
              <div className="flex h-max max-h-full min-h-0 w-full flex-col gap-4 overflow-auto md:w-1/2 lg:max-h-[calc(100vh-6rem)] lg:w-2/5">
                <div className="text-sm">
                  {t('manage.questionPool.selectedElementsDescription')}
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <SelectedElementsList
                    selectedElements={selectionSnapshot}
                    affectedElements={affectedElements}
                    updatesConfigured={updatesConfigured}
                    sharingEnabled={sharingValues.enabled}
                  />
                </div>
              </div>
              <div className="w-full overflow-auto px-0.5 pb-2 md:w-1/2 lg:max-h-[calc(100vh-6rem)] lg:w-3/5">
                <div className="flex items-center gap-2.5">
                  <div className="font-bold">
                    {t('shared.generic.availableActions')}
                  </div>
                  <ElementBatchOperationsInfo />
                </div>

                <fieldset
                  disabled={isSubmitting}
                  className="mt-2 flex flex-col gap-3"
                  aria-busy={isSubmitting}
                >
                  <ElementArchiveCard
                    selectedActions={selectedActions}
                    setSelectedActions={setSelectedActions}
                  />
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <ElementStatusCard
                      selectedActions={selectedActions}
                      setSelectedActions={setSelectedActions}
                    />
                    <ElementMultiplierCard
                      selectedActions={selectedActions}
                      setSelectedActions={setSelectedActions}
                    />
                    <ElementBasePointsCard
                      selectedActions={selectedActions}
                      setSelectedActions={setSelectedActions}
                    />
                    <ElementInstanceUpdatesCard
                      selectedActions={selectedActions}
                      setSelectedActions={setSelectedActions}
                    />
                  </div>
                  {userData?.userProfile?.privatePreview ? (
                    <ElementBatchSharingCard disabled={isSubmitting} />
                  ) : null}
                  <div className="flex items-end justify-end gap-5">
                    <div className="flex flex-col items-end gap-1">
                      {updatesConfigured ? (
                        <span
                          className={twMerge(
                            'text-sm text-green-700',
                            numOfUpdatedElements === 0 && 'text-red-600'
                          )}
                        >
                          <FontAwesomeIcon
                            icon={numOfUpdatedElements === 0 ? faX : faCheck}
                            className="mr-1.5"
                          />
                          {numOfUpdatedElements === 0
                            ? t('manage.questionPool.noElementsWillBeUpdated')
                            : t('manage.questionPool.nElementsWillBeUpdated', {
                                number:
                                  numOfUpdatedElements ===
                                  selectionSnapshot.length
                                    ? numOfUpdatedElements
                                    : `${numOfUpdatedElements}/${selectionSnapshot.length}`,
                              })}
                        </span>
                      ) : null}
                      {sharingValues.enabled ? (
                        <span
                          className={twMerge(
                            'text-sm text-green-700',
                            numOfSharedElements === 0 && 'text-red-600'
                          )}
                        >
                          <FontAwesomeIcon
                            icon={numOfSharedElements === 0 ? faX : faCheck}
                            className="mr-1.5"
                          />
                          {numOfSharedElements === 0
                            ? t('manage.questionPool.noElementsWillBeShared')
                            : t('manage.questionPool.nElementsWillBeShared', {
                                number:
                                  numOfSharedElements ===
                                  selectionSnapshot.length
                                    ? numOfSharedElements
                                    : `${numOfSharedElements}/${selectionSnapshot.length}`,
                              })}
                        </span>
                      ) : null}
                    </div>
                    <Button
                      primary
                      disabled={
                        isSubmitting ||
                        (sharingValues.enabled && !sharingFormValid) ||
                        !(
                          (updatesConfigured && numOfUpdatedElements > 0) ||
                          (sharingValues.enabled && numOfSharedElements > 0)
                        )
                      }
                      onClick={() => {
                        void submitForm()
                      }}
                      className={{ root: 'h-9' }}
                      data={{ cy: 'apply-batch-operations' }}
                    >
                      {t('shared.generic.apply')}
                    </Button>
                  </div>
                </fieldset>
              </div>
            </div>
          )}
        </Modal>
      )}
    </Formik>
  )
}

export default ElementBatchOperationsModal
