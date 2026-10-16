import { useMutation, useQuery } from '@apollo/client'
import {
  faArrowUpRightFromSquare,
  faDownload,
  faPlus,
} from '@fortawesome/free-solid-svg-icons'
import {
  ActivateCompetenceTreeScaleVersionDocument,
  AdaptiveCalibrationExportRequestDocument,
  AdaptiveScaleVersionStatus,
  CompetenceTreeCalibrationDocument,
  CompetenceTreeDataFragment,
  CreateCompetenceTreeScaleVersionDocument,
  ImportAdaptiveItemCalibrationsDocument,
  RequestAdaptiveCalibrationExportDocument,
  SubmitCompetenceTreeScaleForReviewDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  Select,
  TextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import ItemBankMap from './ItemBankMap'
import {
  ArtifactAction,
  DraftScaleForm,
  ReadOnlyScaleReadiness,
  ScaleReadiness,
  createDraftScale,
  formatError,
  parseDraftScale,
  type DraftScale,
} from './ScaleVersionPanelSections'
import type {
  ItemBankCalibration,
  ItemBankScaleLevel,
} from './itemBankMapModel'

type TreeLevel = CompetenceTreeDataFragment['levels'][number]
type TreeAssignment = CompetenceTreeDataFragment['elementAssignments'][number]
function ScaleVersionPanel({
  treeId,
  treeLevels,
  assignments,
}: {
  treeId: string
  treeLevels: TreeLevel[]
  assignments: TreeAssignment[]
}) {
  const t = useTranslations()
  const calibrationImportRef = useRef<HTMLInputElement>(null)
  const standardSettingRef = useRef<HTMLInputElement>(null)
  const [selectedScaleId, setSelectedScaleId] = useState('')
  const [showDraftForm, setShowDraftForm] = useState(false)
  const [draft, setDraft] = useState<DraftScale>(() =>
    createDraftScale(null, treeLevels)
  )
  const [datasetVersion, setDatasetVersion] = useState('')
  const [exportRequestId, setExportRequestId] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { data, loading, error, refetch } = useQuery(
    CompetenceTreeCalibrationDocument,
    {
      variables: { treeId },
      fetchPolicy: 'cache-and-network',
    }
  )
  const calibration = data?.competenceTreeCalibration
  const scales = useMemo(() => calibration?.scales ?? [], [calibration?.scales])
  const activeScale = scales.find(
    (scale) => scale.status === AdaptiveScaleVersionStatus.Active
  )
  const selectedScale =
    scales.find((scale) => scale.id === selectedScaleId) ??
    activeScale ??
    scales[0]
  const canManage = calibration?.canManage === true

  const [createScale, { loading: creatingScale }] = useMutation(
    CreateCompetenceTreeScaleVersionDocument
  )
  const [submitScale, { loading: submittingScale }] = useMutation(
    SubmitCompetenceTreeScaleForReviewDocument
  )
  const [activateScale, { loading: activatingScale }] = useMutation(
    ActivateCompetenceTreeScaleVersionDocument
  )
  const [importCalibrations, { loading: importingCalibrations }] = useMutation(
    ImportAdaptiveItemCalibrationsDocument
  )
  const [requestExport, { loading: requestingExport }] = useMutation(
    RequestAdaptiveCalibrationExportDocument
  )
  const { data: exportData } = useQuery(
    AdaptiveCalibrationExportRequestDocument,
    {
      variables: { requestId: exportRequestId ?? '' },
      skip: !exportRequestId,
      fetchPolicy: 'network-only',
      pollInterval: exportRequestId ? 3000 : 0,
    }
  )
  const exportRequest = exportData?.adaptiveCalibrationExportRequest

  useEffect(() => {
    if (selectedScaleId || scales.length === 0) return
    setSelectedScaleId((activeScale ?? scales[0]).id)
  }, [activeScale, scales, selectedScaleId])

  const itemBankAssignments = useMemo(
    () =>
      assignments.map((assignment) => ({
        id: assignment.id,
        elementId: assignment.elementId,
        elementName: assignment.elementName,
        elementType: assignment.elementType,
        elementVersion: assignment.elementVersion,
        levelId: assignment.levelId,
        enabled: assignment.enabled,
      })),
    [assignments]
  )

  const beginDraft = () => {
    setDraft(createDraftScale(activeScale ?? null, treeLevels))
    setRequestError(null)
    setSuccessMessage(null)
    setShowDraftForm(true)
  }

  const handleCreateDraft = async () => {
    setRequestError(null)
    setSuccessMessage(null)
    try {
      const input = parseDraftScale(draft)
      const result = await createScale({
        variables: {
          treeId,
          supersedesVersionId: activeScale?.id,
          ...input,
        },
      })
      const created = result.data?.createCompetenceTreeScaleVersion
      if (!created) throw new Error(t('manage.competenceTree.scale.empty'))
      await refetch()
      setSelectedScaleId(created.id)
      setShowDraftForm(false)
      setSuccessMessage(t('manage.competenceTree.scale.created'))
    } catch (createError) {
      setRequestError(formatError(createError))
    }
  }

  const handleArtifact = async (
    file: File | undefined,
    kind: 'STANDARD_SETTING' | 'CALIBRATION'
  ) => {
    if (!file) return
    setRequestError(null)
    setSuccessMessage(null)
    try {
      const artifact = JSON.parse(await file.text())
      if (kind === 'STANDARD_SETTING') {
        await submitScale({ variables: { artifact } })
        setSuccessMessage(t('manage.competenceTree.scale.reviewSubmitted'))
      } else {
        const result = await importCalibrations({ variables: { artifact } })
        setSuccessMessage(
          t('manage.competenceTree.calibration.imported', {
            count:
              result.data?.importAdaptiveItemCalibrations.importedCount ?? 0,
          })
        )
      }
      await refetch()
    } catch (artifactError) {
      setRequestError(
        artifactError instanceof SyntaxError
          ? t('manage.competenceTree.calibration.invalidJson')
          : formatError(artifactError)
      )
    }
  }

  const handleActivate = async () => {
    if (!selectedScale) return
    setRequestError(null)
    setSuccessMessage(null)
    try {
      await activateScale({ variables: { scaleVersionId: selectedScale.id } })
      await refetch()
      setSuccessMessage(t('manage.competenceTree.scale.activated'))
    } catch (activationError) {
      setRequestError(formatError(activationError))
    }
  }

  const handleExport = async () => {
    if (!selectedScale || !datasetVersion.trim()) return
    setRequestError(null)
    setSuccessMessage(null)
    try {
      const result = await requestExport({
        variables: {
          treeId,
          scaleVersionId: selectedScale.id,
          datasetVersion: datasetVersion.trim(),
        },
      })
      const request = result.data?.requestAdaptiveCalibrationExport
      if (!request) throw new Error(t('manage.competenceTree.scale.empty'))
      setExportRequestId(request.id)
      setSuccessMessage(t('manage.competenceTree.calibration.exportQueued'))
    } catch (exportError) {
      setRequestError(formatError(exportError))
    }
  }

  if (loading && !data) return <Loader />

  if (error || !calibration) {
    return (
      <UserNotification
        type="error"
        message={error?.message ?? t('manage.competenceTree.scale.loadFailed')}
        data={{ cy: 'adaptive-scale-load-error' }}
      />
    )
  }

  return (
    <section
      id="competence-tree-section-scale"
      tabIndex={-1}
      className="focus:outline-primary-80 scroll-mt-4 border-t border-slate-300 py-5 focus:outline focus:outline-2"
      data-cy="adaptive-scale-panel"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {t('manage.competenceTree.scale.title')}
          </h2>
          <p className="text-sm text-slate-600">
            {t('manage.competenceTree.scale.description')}
          </p>
        </div>
        {canManage ? (
          <Button
            onClick={beginDraft}
            disabled={showDraftForm}
            data={{ cy: 'adaptive-scale-create-draft' }}
          >
            <Button.Icon icon={faPlus} />
            <Button.Label>
              {t('manage.competenceTree.scale.createDraft')}
            </Button.Label>
          </Button>
        ) : null}
      </div>

      {!canManage ? (
        <UserNotification
          type="info"
          message={t('manage.competenceTree.scale.readOnly')}
          data={{ cy: 'adaptive-scale-read-only' }}
          className={{ root: 'mb-4' }}
        />
      ) : null}
      {calibration.readiness.detailsRedacted ? (
        <ReadOnlyScaleReadiness readiness={calibration.readiness} />
      ) : null}
      {requestError ? (
        <UserNotification
          type="error"
          message={requestError}
          dismissible
          onDismiss={() => setRequestError(null)}
          data={{ cy: 'adaptive-scale-error' }}
          className={{ root: 'mb-4' }}
        />
      ) : null}
      {successMessage ? (
        <UserNotification
          type="success"
          message={successMessage}
          dismissible
          onDismiss={() => setSuccessMessage(null)}
          data={{ cy: 'adaptive-scale-success' }}
          className={{ root: 'mb-4' }}
        />
      ) : null}

      {calibration.readiness.detailsRedacted ? null : scales.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-[minmax(16rem,22rem)_1fr]">
          <div>
            <label
              className="mb-1 block text-sm font-medium"
              htmlFor="adaptive-scale-selector"
            >
              {t('manage.competenceTree.scale.version')}
            </label>
            <Select
              id="adaptive-scale-selector"
              value={selectedScale?.id ?? ''}
              onChange={setSelectedScaleId}
              items={scales.map((scale) => ({
                value: scale.id,
                label: t('manage.competenceTree.scale.versionLabel', {
                  version: scale.version,
                  status: t(
                    `manage.competenceTree.scale.status.${scale.status}`
                  ),
                }),
              }))}
              data={{ cy: 'adaptive-scale-selector' }}
              className={{ root: 'w-full', trigger: 'w-full' }}
            />
          </div>
          {activeScale ? (
            <div className="self-end text-sm">
              <span className="font-medium">
                {t('manage.competenceTree.scale.active')}:
              </span>{' '}
              {t('manage.competenceTree.scale.versionNumber', {
                version: activeScale.version,
              })}
            </div>
          ) : (
            <UserNotification
              type="warning"
              message={t('manage.competenceTree.scale.noActive')}
              data={{ cy: 'adaptive-scale-no-active' }}
            />
          )}
        </div>
      ) : (
        <UserNotification
          type="warning"
          message={t('manage.competenceTree.scale.emptyState')}
          data={{ cy: 'adaptive-scale-empty' }}
        />
      )}

      {showDraftForm ? (
        <DraftScaleForm
          draft={draft}
          onChange={setDraft}
          onCancel={() => setShowDraftForm(false)}
          onCreate={() => void handleCreateDraft()}
          loading={creatingScale}
        />
      ) : null}

      {selectedScale ? (
        <>
          <ScaleReadiness scale={selectedScale} />
          {canManage ? (
            <div className="mt-5 grid gap-4 border-t border-slate-300 pt-5 lg:grid-cols-3">
              <ArtifactAction
                title={t('manage.competenceTree.scale.standardSetting')}
                description={t(
                  'manage.competenceTree.scale.standardSettingDescription'
                )}
                inputRef={standardSettingRef}
                inputCy="adaptive-standard-setting-file"
                buttonCy="adaptive-standard-setting-submit"
                buttonLabel={t('manage.competenceTree.scale.submitForReview')}
                loading={submittingScale}
                disabled={
                  selectedScale.status !== AdaptiveScaleVersionStatus.Draft
                }
                onFile={(file) => void handleArtifact(file, 'STANDARD_SETTING')}
              />
              <ArtifactAction
                title={t('manage.competenceTree.calibration.importTitle')}
                description={t(
                  'manage.competenceTree.calibration.importDescription'
                )}
                inputRef={calibrationImportRef}
                inputCy="adaptive-calibration-import-file"
                buttonCy="adaptive-calibration-import"
                buttonLabel={t('manage.competenceTree.calibration.import')}
                loading={importingCalibrations}
                disabled={false}
                onFile={(file) => void handleArtifact(file, 'CALIBRATION')}
              />
              <div>
                <h3 className="font-semibold">
                  {t('manage.competenceTree.calibration.exportTitle')}
                </h3>
                <p className="mb-3 text-sm text-slate-600">
                  {t('manage.competenceTree.calibration.exportDescription')}
                </p>
                <TextField
                  id="adaptive-calibration-dataset-version"
                  value={datasetVersion}
                  onChange={setDatasetVersion}
                  label={t('manage.competenceTree.calibration.datasetVersion')}
                  data={{ cy: 'adaptive-calibration-dataset-version' }}
                />
                <Button
                  className={{ root: 'mt-2' }}
                  onClick={() => void handleExport()}
                  disabled={
                    !datasetVersion.trim() ||
                    ![
                      AdaptiveScaleVersionStatus.Approved,
                      AdaptiveScaleVersionStatus.Active,
                    ].includes(selectedScale.status)
                  }
                  loading={requestingExport}
                  data={{ cy: 'adaptive-calibration-export' }}
                >
                  <Button.Icon icon={faDownload} loading={requestingExport} />
                  <Button.Label>
                    {t('manage.competenceTree.calibration.export')}
                  </Button.Label>
                </Button>
                {exportRequest ? (
                  <div
                    className="mt-2 text-sm"
                    data-cy="adaptive-export-status"
                  >
                    {t('manage.competenceTree.calibration.exportStatus', {
                      status: exportRequest.status,
                    })}
                    {exportRequest.downloadUrl ? (
                      <Button
                        basic
                        onClick={() =>
                          window.location.assign(exportRequest.downloadUrl!)
                        }
                        data={{ cy: 'adaptive-calibration-download' }}
                        className={{ root: 'ml-1 px-1' }}
                      >
                        <Button.Icon icon={faArrowUpRightFromSquare} />
                        <Button.Label>
                          {t('manage.competenceTree.calibration.download')}
                        </Button.Label>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {canManage &&
          selectedScale.status === AdaptiveScaleVersionStatus.Approved ? (
            <div className="mt-4 flex justify-end">
              <Button
                primary
                onClick={() => void handleActivate()}
                loading={activatingScale}
                data={{ cy: 'adaptive-scale-activate' }}
              >
                <Button.Label>
                  {t('manage.competenceTree.scale.activate')}
                </Button.Label>
              </Button>
            </div>
          ) : null}

          <ItemBankMap
            assignments={itemBankAssignments}
            calibrations={selectedScale.calibrations.map((calibration) => ({
              assignmentId: calibration.assignmentId,
              elementVersion: calibration.elementVersion,
              version: calibration.version,
              status: calibration.status as ItemBankCalibration['status'],
              discrimination: calibration.discrimination,
              difficulty: calibration.difficulty,
              guessing: calibration.guessing,
            }))}
            levels={selectedScale.levels as ItemBankScaleLevel[]}
            gridMin={selectedScale.gridMin}
            gridMax={selectedScale.gridMax}
            gridStep={selectedScale.gridStep}
          />
        </>
      ) : null}
    </section>
  )
}

export default ScaleVersionPanel
