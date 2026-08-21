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

function BatchOperationSummary({
  updatesConfigured,
  updatedCount,
  sharedCount,
  sharingEnabled,
  totalCount,
}: {
  updatesConfigured: boolean
  updatedCount: number
  sharedCount: number
  sharingEnabled: boolean
  totalCount: number
}) {
  const t = useTranslations()

  return (
    <div className="flex flex-col items-end gap-1">
      {updatesConfigured ? (
        <span
          className={twMerge(
            'text-sm text-green-700',
            updatedCount === 0 && 'text-red-600'
          )}
        >
          <FontAwesomeIcon
            icon={updatedCount === 0 ? faX : faCheck}
            className="mr-1.5"
          />
          {updatedCount === 0
            ? t('manage.questionPool.noElementsWillBeUpdated')
            : t('manage.questionPool.nElementsWillBeUpdated', {
                number:
                  updatedCount === totalCount
                    ? updatedCount
                    : `${updatedCount}/${totalCount}`,
              })}
        </span>
      ) : null}
      {sharingEnabled ? (
        <span
          className={twMerge(
            'text-sm text-green-700',
            sharedCount === 0 && 'text-red-600'
          )}
        >
          <FontAwesomeIcon
            icon={sharedCount === 0 ? faX : faCheck}
            className="mr-1.5"
          />
          {sharedCount === 0
            ? t('manage.questionPool.noElementsWillBeShared')
            : t('manage.questionPool.nElementsWillBeShared', {
                number:
                  sharedCount === totalCount
                    ? sharedCount
                    : `${sharedCount}/${totalCount}`,
              })}
        </span>
      ) : null}
    </div>
  )
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

  const updateElementIds = useMemo(
    () =>
      affectedElements
        .filter((element) => element.actionsApplied)
        .map((element) => element.id),
    [affectedElements]
  )
  const numOfUpdatedElements = updateElementIds.length
  const numOfSharedElements = useMemo(
    () => affectedElements.filter((element) => element.sharingApplied).length,
    [affectedElements]
  )

  const sharingValidationSchema = useMemo(
    () =>
      Yup.object({
        enabled: Yup.boolean().required(),
        shortnameOrEmail: Yup.string()
          .trim()
          .test(
            'not-self',
            t('manage.sharing.noSelfSharing'),
            (value, validationContext) => {
              const values =
                validationContext.parent as ElementBatchSharingFormValues
              if (!values.enabled || !value || !userData?.userProfile) {
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
        userGroupId: Yup.string().trim(),
        permissionLevel: Yup.string().required(),
      }).test(
        'recipient-required',
        t('manage.sharing.shortnameEmailOrGroupRequired'),
        (values, validationContext) => {
          if (
            !values?.enabled ||
            values.shortnameOrEmail?.trim() ||
            values.userGroupId?.trim()
          ) {
            return true
          }
          return validationContext.createError({ path: 'shortnameOrEmail' })
        }
      ),
    [t, userData?.userProfile]
  )

  const applyConfiguredOperations = useElementBatchExecution({
    selectionSnapshot,
    updateElementIds,
    selectedActions,
    updatesConfigured,
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
                    <BatchOperationSummary
                      updatesConfigured={updatesConfigured}
                      updatedCount={numOfUpdatedElements}
                      sharedCount={numOfSharedElements}
                      sharingEnabled={sharingValues.enabled}
                      totalCount={selectionSnapshot.length}
                    />
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
