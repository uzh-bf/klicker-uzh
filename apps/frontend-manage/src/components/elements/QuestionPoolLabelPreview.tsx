import {
  ElementType,
  type RequestQuestionPoolLabelPreviewMutation,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, Select, Switch, UserNotification } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'

export interface QuestionPoolLabelPreviewCourse {
  id: string
  name: string
}

export interface QuestionPoolLabelPreviewSelection {
  elementId: number
  elementName: string
  elementVersion: number
  courseId: string
  courseName: string
}

type QuestionPoolLabelPreviewData =
  RequestQuestionPoolLabelPreviewMutation['requestQuestionPoolLabelPreview']

export type QuestionPoolLabelPreviewState =
  | {
      status: 'loading'
      selection: QuestionPoolLabelPreviewSelection
    }
  | {
      status: 'success'
      selection: QuestionPoolLabelPreviewSelection
      data: QuestionPoolLabelPreviewData
    }
  | {
      status: 'error'
      selection: QuestionPoolLabelPreviewSelection
    }

export function isQuestionPoolLabelPreviewSupported(type: ElementType) {
  return type === ElementType.Sc || type === ElementType.Kprim
}

export function QuestionPoolLabelPreviewControls({
  enabled,
  courseId,
  courses,
  coursesLoading,
  coursesError,
  onEnabledChange,
  onCourseChange,
}: {
  enabled: boolean
  courseId?: string
  courses: QuestionPoolLabelPreviewCourse[]
  coursesLoading: boolean
  coursesError: boolean
  onEnabledChange: (enabled: boolean) => void
  onCourseChange: (courseId: string) => void
}) {
  const t = useTranslations()

  return (
    <section
      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3"
      data-cy="question-pool-label-preview-controls"
    >
      <Switch
        id="question-pool-label-preview-enabled"
        size="sm"
        label={t('manage.questionPool.labelPreviewEnable')}
        checked={enabled}
        onCheckedChange={onEnabledChange}
        className={{ label: 'font-normal' }}
        data={{ cy: 'question-pool-label-preview-switch' }}
      />
      <p className="mt-1 text-xs leading-snug text-slate-600">
        {t('manage.questionPool.labelPreviewDescription')}
      </p>

      {enabled ? (
        <div className="mt-3">
          <label
            htmlFor="question-pool-label-preview-course"
            className="mb-1 block text-xs font-semibold text-slate-700"
          >
            {t('manage.questionPool.labelPreviewCourse')}
          </label>
          <Select
            id="question-pool-label-preview-course"
            value={courseId ?? ''}
            onChange={onCourseChange}
            disabled={coursesLoading || courses.length === 0}
            placeholder={
              coursesLoading
                ? t('manage.questionPool.labelPreviewCoursesLoading')
                : t('manage.questionPool.labelPreviewSelectCourse')
            }
            items={courses.map((course) => ({
              value: course.id,
              label: course.name,
              data: { cy: 'question-pool-label-preview-course-option' },
            }))}
            contentPosition="popper"
            className={{ root: 'w-full', trigger: 'h-9 text-sm' }}
            data={{ cy: 'question-pool-label-preview-course' }}
          />
          {coursesError ? (
            <p className="mt-1 text-xs text-red-700">
              {t('manage.questionPool.labelPreviewCoursesLoadError')}
            </p>
          ) : courses.length === 0 && !coursesLoading ? (
            <p className="mt-1 text-xs text-slate-600">
              {t('manage.questionPool.labelPreviewNoCourses')}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-slate-900">
        {value}
      </div>
    </div>
  )
}

export function QuestionPoolLabelPreviewModal({
  state,
  onClose,
}: {
  state: QuestionPoolLabelPreviewState
  onClose: () => void
}) {
  const t = useTranslations()
  const formatter = useFormatter()
  const formatRate = (rate: number) =>
    formatter.number(rate, { style: 'percent', maximumFractionDigits: 1 })
  const formatBand = (band: number) =>
    t('manage.questionPool.labelPreviewBandValue', { band })

  return (
    <Modal
      open
      loading={state.status === 'loading'}
      onClose={onClose}
      title={t('manage.questionPool.labelPreviewTitle')}
      primaryLabel={t('shared.generic.close')}
      onPrimaryAction={onClose}
      className={{ content: 'max-w-3xl pb-2' }}
      data={{ cy: 'question-pool-label-preview-modal' }}
      dataCloseButton={{ cy: 'close-question-pool-label-preview' }}
      dataPrimaryAction={{ cy: 'close-question-pool-label-preview-primary' }}
    >
      <div className="flex flex-col gap-4 text-sm">
        <div className="text-slate-600">
          {t('manage.questionPool.labelPreviewContext', {
            element: state.selection.elementName,
            course: state.selection.courseName,
          })}
        </div>

        {state.status === 'error' ? (
          <UserNotification
            type="error"
            message={t('manage.questionPool.labelPreviewError')}
          />
        ) : null}

        {state.status === 'success' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">
                {t('manage.questionPool.labelPreviewObserved')}
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                {t('manage.questionPool.labelPreviewObservedDescription')}
              </p>
              {state.data.observed ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <PreviewMetric
                    label={t('manage.questionPool.labelPreviewFullCredit')}
                    value={`${state.data.observed.fullCreditCount} / ${state.data.observed.denominator}`}
                  />
                  <PreviewMetric
                    label={t('manage.questionPool.labelPreviewRate')}
                    value={formatRate(state.data.observed.rate)}
                  />
                  <PreviewMetric
                    label={t('manage.questionPool.labelPreviewBand')}
                    value={formatBand(state.data.observed.band)}
                  />
                </div>
              ) : (
                <UserNotification
                  type="info"
                  message={t(
                    'manage.questionPool.labelPreviewObservedUnavailable'
                  )}
                  className={{ root: 'mt-3 text-xs' }}
                />
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">
                {t('manage.questionPool.labelPreviewAi')}
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                {t('manage.questionPool.labelPreviewAiDescription')}
              </p>
              {state.data.ai ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <PreviewMetric
                    label={t('manage.questionPool.labelPreviewRaw')}
                    value={`${formatRate(state.data.ai.rawRate)} · ${formatBand(state.data.ai.rawBand)}`}
                  />
                  {state.data.ai.calibratedRate != null &&
                  state.data.ai.calibratedBand != null ? (
                    <PreviewMetric
                      label={t('manage.questionPool.labelPreviewCalibrated')}
                      value={`${formatRate(state.data.ai.calibratedRate)} · ${formatBand(state.data.ai.calibratedBand)}`}
                    />
                  ) : null}
                  <PreviewMetric
                    label={t('manage.questionPool.labelPreviewBloom')}
                    value={state.data.ai.bloom}
                  />
                </div>
              ) : (
                <UserNotification
                  type="info"
                  message={t('manage.questionPool.labelPreviewAiUnavailable')}
                  className={{ root: 'mt-3 text-xs' }}
                />
              )}
            </section>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
