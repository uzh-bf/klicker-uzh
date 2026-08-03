import {
  NetworkStatus,
  useLazyQuery,
  useMutation,
  useQuery,
} from '@apollo/client'
import { faLink, faRotate } from '@fortawesome/free-solid-svg-icons'
import {
  AdaptivePracticeQuizSetupPreviewDocument,
  AdaptivePracticeQuizSetupPreviewQuery,
  CompetenceTreeCatalogDocument,
  CompetenceTreeCatalogOwnership,
  CompetenceTreeDocument,
  CourseCompetenceTreeCatalogDocument,
  LinkCompetenceTreeToCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  Select,
  TextField,
  UserNotification,
  toast,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useMemo, useState } from 'react'
import CreationFormValidator from '../CreationFormValidator'
import { AdaptivePracticeQuizConfigFormValues } from '../WizardLayout'
import WizardNavigation from '../WizardNavigation'
import AdaptiveAssignmentPreview from './AdaptiveAssignmentPreview'
import AdaptiveHierarchyOverrides from './AdaptiveHierarchyOverrides'
import AdaptiveReadinessPanel from './AdaptiveReadinessPanel'
import AdaptiveScaleReadinessSummary from './AdaptiveScaleReadinessSummary'
import { PracticeQuizWizardStepProps } from './PracticeQuizWizard'
import {
  mapAdaptivePracticeQuizPreviewToForm,
  serializeAdaptivePracticeQuizConfig,
} from './adaptivePracticeQuizForm'
import {
  asAdaptiveTranslator,
  formatAdaptiveApolloError,
} from './adaptiveReadinessIssue'

type AdaptiveSetupPreviewData = Pick<
  NonNullable<
    AdaptivePracticeQuizSetupPreviewQuery['adaptivePracticeQuizSetupPreview']
  >,
  'nodes' | 'assignments' | 'readiness'
>

function AdaptivePracticeQuizSetupStep({
  editMode,
  formRef,
  formData,
  continueDisabled,
  activeStep,
  stepValidity,
  validationSchema,
  setStepValidity,
  onSubmit,
  onPrevStep,
  closeWizard,
  adaptiveInitialPreview,
}: PracticeQuizWizardStepProps) {
  const t = useTranslations()
  const treeSearchId = useId()
  const treeSelectId = useId()
  const courseId = formData.courseId
  const [treeSearch, setTreeSearch] = useState('')
  const [debouncedTreeSearch, setDebouncedTreeSearch] = useState('')
  const [selectedTreeId, setSelectedTreeId] = useState(
    formData.adaptiveConfig.competenceTreeId
  )
  const [preview, setPreview] = useState<AdaptiveSetupPreviewData | null>(
    adaptiveInitialPreview ?? null
  )
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [lastPreviewFingerprint, setLastPreviewFingerprint] = useState<
    string | null
  >(() =>
    adaptiveInitialPreview
      ? getPreviewFingerprint({
          courseId: formData.courseId,
          adaptiveConfig: mapAdaptivePracticeQuizPreviewToForm(
            adaptiveInitialPreview
          ),
        })
      : null
  )

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedTreeSearch(treeSearch),
      250
    )
    return () => window.clearTimeout(timeout)
  }, [treeSearch])

  const {
    data: linkedTreeData,
    loading: linkedTreesLoading,
    error: linkedTreesError,
    refetch: refetchLinkedTrees,
    fetchMore: fetchMoreLinkedTrees,
    networkStatus: linkedTreeNetworkStatus,
  } = useQuery(CourseCompetenceTreeCatalogDocument, {
    variables: {
      courseId: courseId!,
      search: debouncedTreeSearch.trim() || undefined,
      limit: 25,
    },
    skip: !courseId,
    notifyOnNetworkStatusChange: true,
  })
  const {
    data: ownedTreeData,
    loading: ownedTreesLoading,
    error: ownedTreesError,
    refetch: refetchOwnedTrees,
    fetchMore: fetchMoreOwnedTrees,
    networkStatus: ownedTreeNetworkStatus,
  } = useQuery(CompetenceTreeCatalogDocument, {
    variables: {
      search: debouncedTreeSearch.trim() || undefined,
      ownership: CompetenceTreeCatalogOwnership.Owned,
      excludeCourseId: courseId,
      limit: 25,
    },
    skip: !courseId,
    notifyOnNetworkStatusChange: true,
  })
  const [linkTree, { loading: linkingTree }] = useMutation(
    LinkCompetenceTreeToCourseDocument
  )
  const [loadSetupPreview] = useLazyQuery(
    AdaptivePracticeQuizSetupPreviewDocument,
    { fetchPolicy: 'no-cache' }
  )

  const linkedTrees = useMemo(
    () => linkedTreeData?.courseCompetenceTreeCatalog.items ?? [],
    [linkedTreeData?.courseCompetenceTreeCatalog.items]
  )
  const linkedTreeIds = useMemo(
    () => new Set(linkedTrees.map((tree) => tree.id)),
    [linkedTrees]
  )
  const ownedUnlinkedTrees = (
    ownedTreeData?.competenceTreeCatalog.items ?? []
  ).filter((tree) => !linkedTreeIds.has(tree.id))
  const { data: selectedTreeData, loading: selectedTreeLoading } = useQuery(
    CompetenceTreeDocument,
    {
      variables: { id: selectedTreeId! },
      skip: !selectedTreeId,
    }
  )
  const selectedTree = selectedTreeData?.competenceTree
  const selectedTreeLinked = selectedTreeId
    ? linkedTreeIds.has(selectedTreeId) ||
      Boolean(
        selectedTree?.courseLinks.some((link) => link.courseId === courseId)
      )
    : false
  const linkedTreeOptions =
    selectedTree && selectedTreeLinked && !linkedTreeIds.has(selectedTree.id)
      ? [selectedTree, ...linkedTrees]
      : linkedTrees
  const ownedTreeOptions =
    selectedTree &&
    selectedTree.isOwner &&
    !selectedTreeLinked &&
    !ownedUnlinkedTrees.some((tree) => tree.id === selectedTree.id)
      ? [selectedTree, ...ownedUnlinkedTrees]
      : ownedUnlinkedTrees
  const selectedTreeSummary = [...linkedTreeOptions, ...ownedTreeOptions].find(
    (tree) => tree.id === selectedTreeId
  )

  return (
    <Formik
      validateOnMount
      initialValues={formData}
      onSubmit={onSubmit!}
      innerRef={formRef}
      validationSchema={validationSchema}
    >
      {({ values, isValid, isSubmitting, setFieldValue }) => {
        const fingerprint = getPreviewFingerprint(values)
        const previewStale =
          lastPreviewFingerprint !== null &&
          lastPreviewFingerprint !== fingerprint
        const rootNames = new Map(
          selectedTree?.nodes
            .filter((node) => (node.parentId ?? null) === null)
            .map((node) => [node.id, node.name]) ?? []
        )
        const updateConfig = (config: AdaptivePracticeQuizConfigFormValues) => {
          void setFieldValue('adaptiveConfig', config, true)
        }

        const refreshPreview = async () => {
          const input = serializeAdaptivePracticeQuizConfig(
            values.adaptiveConfig
          )
          if (!courseId || !input) return

          setPreviewLoading(true)
          setPreviewError(null)
          try {
            const result = await loadSetupPreview({
              variables: { courseId, input },
            })
            const nextPreview = result.data?.adaptivePracticeQuizSetupPreview
            if (!nextPreview) {
              throw new Error(
                t('manage.activityWizard.adaptive.preview.emptyResponse')
              )
            }
            setPreview(nextPreview)
            setLastPreviewFingerprint(fingerprint)
          } catch (error) {
            setPreviewError(
              formatAdaptiveApolloError(asAdaptiveTranslator(t), error)
            )
          } finally {
            setPreviewLoading(false)
          }
        }

        return (
          <Form className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col">
            <CreationFormValidator
              isValid={isValid}
              activeStep={activeStep}
              setStepValidity={setStepValidity}
            />
            <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-3 overflow-y-auto pr-1">
              <section
                className="min-w-0 max-w-full space-y-3"
                data-cy="adaptive-tree-selection"
              >
                <TextField
                  id={treeSearchId}
                  label={t('manage.activityWizard.adaptive.setup.searchTrees')}
                  value={treeSearch}
                  onChange={setTreeSearch}
                  placeholder={t('manage.competenceTree.searchPlaceholder')}
                  disabled={!courseId}
                  data={{ cy: 'adaptive-tree-search' }}
                />
                <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(14rem,1fr)_auto] md:items-end">
                  <div className="min-w-0">
                    <label
                      htmlFor={treeSelectId}
                      className="mb-1 block text-sm font-bold"
                    >
                      {t('manage.activityWizard.adaptive.setup.tree')}
                    </label>
                    <Select
                      id={treeSelectId}
                      value={values.adaptiveConfig.competenceTreeId}
                      onChange={(treeId) => {
                        setSelectedTreeId(treeId)
                        updateConfig({
                          ...values.adaptiveConfig,
                          competenceTreeId: treeId,
                          scaleVersionId: undefined,
                          nodeOverrides: [],
                          elementOverrides: [],
                        })
                        setPreview(null)
                        setLastPreviewFingerprint(null)
                      }}
                      placeholder={t(
                        'manage.activityWizard.adaptive.setup.selectTree'
                      )}
                      disabled={
                        !courseId || linkedTreesLoading || ownedTreesLoading
                      }
                      groups={[
                        {
                          label: t(
                            'manage.activityWizard.adaptive.setup.linkedTrees'
                          ),
                          items: linkedTreeOptions.map((tree) => ({
                            value: tree.id,
                            label: tree.displayName,
                            data: { cy: `adaptive-tree-linked-${tree.id}` },
                          })),
                        },
                        {
                          label: t(
                            'manage.activityWizard.adaptive.setup.ownedUnlinkedTrees'
                          ),
                          items: ownedTreeOptions.map((tree) => ({
                            value: tree.id,
                            label: tree.displayName,
                            data: { cy: `adaptive-tree-unlinked-${tree.id}` },
                          })),
                        },
                      ]}
                      data={{ cy: 'adaptive-tree-select' }}
                      className={{ root: 'w-full min-w-0', trigger: 'w-full' }}
                    />
                  </div>
                  {selectedTreeSummary && !selectedTreeLinked ? (
                    <Button
                      primary
                      type="button"
                      loading={linkingTree}
                      onClick={async () => {
                        try {
                          await linkTree({
                            variables: {
                              treeId: selectedTreeSummary.id,
                              courseId: courseId!,
                            },
                          })
                          await Promise.all([
                            refetchLinkedTrees(),
                            refetchOwnedTrees(),
                          ])
                          toast({
                            type: 'success',
                            message: t(
                              'manage.activityWizard.adaptive.setup.linkSuccess'
                            ),
                          })
                        } catch (error) {
                          toast({
                            type: 'error',
                            message:
                              error instanceof Error
                                ? error.message
                                : t(
                                    'manage.activityWizard.adaptive.setup.linkFailed'
                                  ),
                          })
                        }
                      }}
                      data={{ cy: 'adaptive-link-tree-to-course' }}
                    >
                      <Button.Icon icon={faLink} loading={linkingTree} />
                      <Button.Label>
                        {t('manage.activityWizard.adaptive.setup.linkTree')}
                      </Button.Label>
                    </Button>
                  ) : null}
                </div>
                {linkedTreesError || ownedTreesError ? (
                  <UserNotification
                    type="error"
                    message={
                      linkedTreesError?.message ??
                      ownedTreesError?.message ??
                      ''
                    }
                    data={{ cy: 'adaptive-tree-catalog-error' }}
                  />
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  {linkedTreeData?.courseCompetenceTreeCatalog.nextCursor ? (
                    <Button
                      type="button"
                      onClick={() =>
                        void fetchMoreLinkedTrees({
                          variables: {
                            courseId: courseId!,
                            search: debouncedTreeSearch.trim() || undefined,
                            limit: 25,
                            cursor:
                              linkedTreeData.courseCompetenceTreeCatalog
                                .nextCursor,
                          },
                          updateQuery: (previous, { fetchMoreResult }) => ({
                            ...previous,
                            courseCompetenceTreeCatalog: {
                              ...fetchMoreResult.courseCompetenceTreeCatalog,
                              items: [
                                ...previous.courseCompetenceTreeCatalog.items,
                                ...fetchMoreResult.courseCompetenceTreeCatalog.items.filter(
                                  (tree) =>
                                    !previous.courseCompetenceTreeCatalog.items.some(
                                      (existing) => existing.id === tree.id
                                    )
                                ),
                              ],
                            },
                          }),
                        })
                      }
                      loading={
                        linkedTreeNetworkStatus === NetworkStatus.fetchMore
                      }
                      data={{ cy: 'adaptive-tree-load-more-linked' }}
                    >
                      {t('manage.activityWizard.adaptive.setup.loadMoreLinked')}
                    </Button>
                  ) : null}
                  {ownedTreeData?.competenceTreeCatalog.nextCursor ? (
                    <Button
                      type="button"
                      onClick={() =>
                        void fetchMoreOwnedTrees({
                          variables: {
                            search: debouncedTreeSearch.trim() || undefined,
                            ownership: CompetenceTreeCatalogOwnership.Owned,
                            excludeCourseId: courseId,
                            limit: 25,
                            cursor:
                              ownedTreeData.competenceTreeCatalog.nextCursor,
                          },
                          updateQuery: (previous, { fetchMoreResult }) => ({
                            ...previous,
                            competenceTreeCatalog: {
                              ...fetchMoreResult.competenceTreeCatalog,
                              items: [
                                ...previous.competenceTreeCatalog.items,
                                ...fetchMoreResult.competenceTreeCatalog.items.filter(
                                  (tree) =>
                                    !previous.competenceTreeCatalog.items.some(
                                      (existing) => existing.id === tree.id
                                    )
                                ),
                              ],
                            },
                          }),
                        })
                      }
                      loading={
                        ownedTreeNetworkStatus === NetworkStatus.fetchMore
                      }
                      data={{ cy: 'adaptive-tree-load-more-owned' }}
                    >
                      {t('manage.activityWizard.adaptive.setup.loadMoreOwned')}
                    </Button>
                  ) : null}
                </div>
              </section>

              {!courseId ? (
                <UserNotification
                  type="warning"
                  message={t(
                    'manage.activityWizard.adaptive.setup.courseRequired'
                  )}
                  data={{ cy: 'adaptive-setup-course-required' }}
                />
              ) : null}
              {selectedTreeId && !selectedTreeLinked && !linkedTreesLoading ? (
                <UserNotification
                  type="warning"
                  message={t(
                    'manage.activityWizard.adaptive.setup.linkRequired'
                  )}
                  data={{ cy: 'adaptive-setup-link-required' }}
                />
              ) : null}
              {selectedTreeLoading ? <Loader /> : null}
              {selectedTree && selectedTreeLinked ? (
                <>
                  <AdaptiveScaleReadinessSummary
                    treeId={selectedTree.id}
                    selectedScaleVersionId={
                      values.adaptiveConfig.scaleVersionId
                    }
                    autoSelectActiveScale={!editMode}
                    onScaleVersionChange={(scaleVersionId) =>
                      updateConfig({
                        ...values.adaptiveConfig,
                        scaleVersionId,
                      })
                    }
                  />
                  <AdaptiveHierarchyOverrides
                    nodes={selectedTree.nodes}
                    assignments={selectedTree.elementAssignments}
                    config={values.adaptiveConfig}
                    effectiveNodes={preview?.nodes}
                    effectiveStateStale={previewStale}
                    onChange={updateConfig}
                  />
                  <AdaptiveAssignmentPreview
                    assignments={selectedTree.elementAssignments}
                    levels={selectedTree.levels}
                    nodes={selectedTree.nodes}
                    coverages={selectedTree.levelCoverages}
                    coverageReadiness={preview?.readiness.coverages}
                    effectiveAssignments={preview?.assignments}
                    effectiveStateStale={previewStale}
                    config={values.adaptiveConfig}
                    onChange={updateConfig}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => void refreshPreview()}
                      loading={previewLoading}
                      data={{ cy: 'adaptive-refresh-preview' }}
                    >
                      <Button.Icon icon={faRotate} loading={previewLoading} />
                      <Button.Label>
                        {t(
                          previewError
                            ? 'shared.generic.tryAgain'
                            : 'manage.activityWizard.adaptive.preview.refresh'
                        )}
                      </Button.Label>
                    </Button>
                  </div>
                  {previewError ? (
                    <UserNotification
                      type="error"
                      message={previewError}
                      data={{ cy: 'adaptive-preview-error' }}
                    />
                  ) : null}
                  <AdaptiveReadinessPanel
                    readiness={preview?.readiness}
                    stale={previewStale}
                    rootNames={rootNames}
                  />
                </>
              ) : null}
            </div>
            <WizardNavigation
              editMode={editMode}
              isSubmitting={isSubmitting}
              stepValidity={stepValidity}
              activeStep={activeStep}
              lastStep
              continueDisabled={
                continueDisabled ||
                Boolean(selectedTreeId && !selectedTreeLinked)
              }
              onPrevStep={() => onPrevStep!(values)}
              onCloseWizard={closeWizard}
            />
          </Form>
        )
      }}
    </Formik>
  )
}

function getPreviewFingerprint(values: {
  courseId?: string
  adaptiveConfig: AdaptivePracticeQuizConfigFormValues
}) {
  return JSON.stringify({
    courseId: values.courseId,
    config: serializeAdaptivePracticeQuizConfig(values.adaptiveConfig),
  })
}

export default AdaptivePracticeQuizSetupStep
