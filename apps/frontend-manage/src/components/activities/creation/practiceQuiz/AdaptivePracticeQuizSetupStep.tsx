import { useLazyQuery, useMutation, useQuery } from '@apollo/client'
import { faLink, faRotate } from '@fortawesome/free-solid-svg-icons'
import {
  AdaptivePracticeQuizSetupPreviewDocument,
  AdaptivePracticeQuizSetupPreviewQuery,
  CompetenceTreeDocument,
  CompetenceTreesDocument,
  CourseCompetenceTreesDocument,
  LinkCompetenceTreeToCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Select, UserNotification, toast } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import CreationFormValidator from '../CreationFormValidator'
import { AdaptivePracticeQuizConfigFormValues } from '../WizardLayout'
import WizardNavigation from '../WizardNavigation'
import AdaptiveAssignmentPreview from './AdaptiveAssignmentPreview'
import AdaptiveHierarchyOverrides from './AdaptiveHierarchyOverrides'
import AdaptiveReadinessPanel from './AdaptiveReadinessPanel'
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
  const courseId = formData.courseId
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

  const {
    data: linkedTreeData,
    loading: linkedTreesLoading,
    refetch: refetchLinkedTrees,
  } = useQuery(CourseCompetenceTreesDocument, {
    variables: { courseId: courseId! },
    skip: !courseId,
  })
  const { data: allTreeData, loading: allTreesLoading } = useQuery(
    CompetenceTreesDocument,
    { skip: !courseId }
  )
  const [linkTree, { loading: linkingTree }] = useMutation(
    LinkCompetenceTreeToCourseDocument
  )
  const [loadSetupPreview] = useLazyQuery(
    AdaptivePracticeQuizSetupPreviewDocument,
    { fetchPolicy: 'no-cache' }
  )

  const linkedTrees = useMemo(
    () => linkedTreeData?.courseCompetenceTrees ?? [],
    [linkedTreeData?.courseCompetenceTrees]
  )
  const linkedTreeIds = useMemo(
    () => new Set(linkedTrees.map((tree) => tree.id)),
    [linkedTrees]
  )
  const ownedUnlinkedTrees =
    allTreeData?.competenceTrees.filter(
      (tree) => tree.isOwner && !linkedTreeIds.has(tree.id)
    ) ?? []
  const availableTrees = [...linkedTrees, ...ownedUnlinkedTrees]
  const selectedTreeSummary = availableTrees.find(
    (tree) => tree.id === selectedTreeId
  )
  const selectedTreeLinked = selectedTreeId
    ? linkedTreeIds.has(selectedTreeId)
    : false
  const { data: selectedTreeData, loading: selectedTreeLoading } = useQuery(
    CompetenceTreeDocument,
    {
      variables: { id: selectedTreeId! },
      skip: !selectedTreeId,
    }
  )
  const selectedTree = selectedTreeData?.competenceTree

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
          <Form className="flex h-full min-h-0 w-full flex-col">
            <CreationFormValidator
              isValid={isValid}
              activeStep={activeStep}
              setStepValidity={setStepValidity}
            />
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
              <section
                className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_auto] md:items-end"
                data-cy="adaptive-tree-selection"
              >
                <div>
                  <div className="mb-1 text-sm font-bold">
                    {t('manage.activityWizard.adaptive.setup.tree')}
                  </div>
                  <Select
                    value={values.adaptiveConfig.competenceTreeId}
                    onChange={(treeId) => {
                      setSelectedTreeId(treeId)
                      updateConfig({
                        ...values.adaptiveConfig,
                        competenceTreeId: treeId,
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
                      !courseId || linkedTreesLoading || allTreesLoading
                    }
                    groups={[
                      {
                        label: t(
                          'manage.activityWizard.adaptive.setup.linkedTrees'
                        ),
                        items: linkedTrees.map((tree) => ({
                          value: tree.id,
                          label: tree.displayName,
                          data: { cy: `adaptive-tree-linked-${tree.id}` },
                        })),
                      },
                      {
                        label: t(
                          'manage.activityWizard.adaptive.setup.ownedUnlinkedTrees'
                        ),
                        items: ownedUnlinkedTrees.map((tree) => ({
                          value: tree.id,
                          label: tree.displayName,
                          data: { cy: `adaptive-tree-unlinked-${tree.id}` },
                        })),
                      },
                    ]}
                    data={{ cy: 'adaptive-tree-select' }}
                    className={{ root: 'w-full', trigger: 'w-full' }}
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
                        await refetchLinkedTrees()
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
                        {t('manage.activityWizard.adaptive.preview.refresh')}
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
