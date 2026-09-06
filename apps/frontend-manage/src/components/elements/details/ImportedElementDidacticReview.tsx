import { ElementStatus, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Badge, Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { ElementFormTypes } from '../manipulation/types'

type AnswerCollectionEntry = {
  id: number
  value: string
}

const ANSWER_POOL_PAGE_SIZE = 100

function ReviewField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 rounded border border-solid bg-slate-50 px-2 py-1.5">
      <dt className="text-xs font-bold text-slate-600">{label}</dt>
      <dd className="m-0 break-words text-sm">{children}</dd>
    </div>
  )
}

function TextBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <h5 className="mb-1 text-sm font-bold">{label}</h5>
      <div className="whitespace-pre-wrap break-words rounded border border-solid bg-slate-50 p-2 text-sm">
        {value || '–'}
      </div>
    </div>
  )
}

function NoSampleSolutionNotice() {
  const t = useTranslations()

  return (
    <div data-cy="element-import-no-sample-solution">
      <Badge className="bg-slate-600 text-white hover:bg-slate-700">
        {t('manage.elements.elementImportNoSampleSolution')}
      </Badge>
    </div>
  )
}

function AnswerPool({
  entries,
}: {
  entries: readonly AnswerCollectionEntry[]
}) {
  const t = useTranslations()
  const [expanded, setExpanded] = useState(false)
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(entries.length / ANSWER_POOL_PAGE_SIZE)
  const firstVisibleEntry = page * ANSWER_POOL_PAGE_SIZE + 1
  const lastVisibleEntry = Math.min(
    (page + 1) * ANSWER_POOL_PAGE_SIZE,
    entries.length
  )
  const visibleEntries = entries.slice(
    page * ANSWER_POOL_PAGE_SIZE,
    (page + 1) * ANSWER_POOL_PAGE_SIZE
  )

  return (
    <details
      className="rounded border border-solid bg-white"
      data-cy="element-import-answer-pool"
      onToggle={(event) => {
        setExpanded(event.currentTarget.open)
        if (!event.currentTarget.open) setPage(0)
      }}
    >
      <summary className="cursor-pointer px-2 py-1.5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2">
        {t('manage.elements.elementImportAnswerPool', {
          count: entries.length,
        })}
      </summary>
      {entries.length > 0 && expanded ? (
        <div className="border-t border-solid">
          <ol
            start={firstVisibleEntry}
            tabIndex={0}
            aria-label={t('manage.elements.elementImportAnswerPool', {
              count: entries.length,
            })}
            className="m-0 max-h-64 list-decimal overflow-auto rounded-sm px-8 py-2 text-sm outline-none [contain:content] focus-visible:ring-2 focus-visible:ring-offset-2"
            data-cy="element-import-answer-pool-page"
            data-total-entries={entries.length}
          >
            {visibleEntries.map((entry) => (
              <li key={entry.id} className="break-words py-0.5">
                {entry.value}
              </li>
            ))}
          </ol>
          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 border-t border-solid px-2 py-1 text-xs">
              <Button
                basic
                type="button"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                data={{ cy: 'element-import-answer-pool-previous' }}
              >
                {t('shared.table.previous')}
              </Button>
              <span aria-live="polite">
                {t('manage.general.showingResults', {
                  start: firstVisibleEntry,
                  end: lastVisibleEntry,
                  total: entries.length,
                })}
              </span>
              <Button
                basic
                type="button"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() =>
                  setPage((current) => Math.min(totalPages - 1, current + 1))
                }
                data={{ cy: 'element-import-answer-pool-next' }}
              >
                {t('shared.table.next')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : entries.length === 0 ? (
        <div className="border-t border-solid px-2 py-1.5 text-sm text-slate-600">
          –
        </div>
      ) : null}
    </details>
  )
}

function ImportedElementDidacticReview({
  element,
  answerCollectionEntries,
}: {
  element: ElementFormTypes
  answerCollectionEntries: readonly AnswerCollectionEntry[]
}) {
  const t = useTranslations()
  const entryById = new Map(
    answerCollectionEntries.map((entry) => [entry.id, entry.value])
  )
  const yesNo = (value: boolean) =>
    t(value ? 'shared.generic.yes' : 'shared.generic.no')
  const hasSampleSolution =
    element.type !== ElementType.Flashcard &&
    element.type !== ElementType.Content &&
    'hasSampleSolution' in element.options
      ? Boolean(element.options.hasSampleSolution)
      : null

  return (
    <section
      className="mt-3 flex flex-col gap-3 border-t border-solid pt-3"
      aria-label={t('manage.elements.elementImportDidacticReview')}
      data-cy="element-import-didactic-review"
    >
      <div>
        <h5 className="mb-1 text-sm font-bold">
          {t('manage.elements.elementImportDidacticReview')}
        </h5>
        <dl className="m-0 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ReviewField label={t('manage.elements.questionStatus')}>
            <Badge className="bg-violet-600 text-white hover:bg-violet-700">
              {t(`shared.${ElementStatus.Review}.statusLabel`)}
            </Badge>
          </ReviewField>
          <ReviewField label={t('manage.elements.elementType')}>
            {t(`shared.${element.type}.typeLabel`)}
          </ReviewField>
          <ReviewField label={t('shared.generic.basePoints')}>
            {yesNo(element.basePoints)}
          </ReviewField>
          <ReviewField label={t('shared.generic.multiplier')}>
            {element.pointsMultiplier}
          </ReviewField>
          <ReviewField label={t('shared.generic.sampleSolution')}>
            {hasSampleSolution === null ? '–' : yesNo(hasSampleSolution)}
          </ReviewField>
        </dl>
      </div>

      <TextBlock
        label={t('manage.elements.contentImportDescription')}
        value={element.content}
      />
      {'explanation' in element ? (
        <TextBlock
          label={t('manage.elements.explanationImportDescription')}
          value={element.explanation}
        />
      ) : null}

      {element.type === ElementType.Sc ||
      element.type === ElementType.Mc ||
      element.type === ElementType.Kprim ? (
        <div>
          <h5 className="mb-1 text-sm font-bold">
            {t('manage.elements.answerOptions')}
          </h5>
          {!element.options.hasSampleSolution ? (
            <div className="mb-2">
              <NoSampleSolutionNotice />
            </div>
          ) : null}
          <ol className="m-0 flex list-decimal flex-col gap-1 pl-6 text-sm">
            {element.options.choices.map((choice, index) => (
              <li
                key={choice.id ?? choice.ix ?? index}
                className="rounded border border-solid p-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0 break-words">
                    {choice.value || '–'}
                  </span>
                  {element.options.hasSampleSolution ? (
                    <Badge
                      className={
                        choice.correct
                          ? 'bg-green-700 text-white hover:bg-green-800'
                          : 'bg-slate-600 text-white hover:bg-slate-700'
                      }
                    >
                      {t(
                        choice.correct
                          ? 'shared.generic.correct'
                          : 'manage.elements.elementImportIncorrect'
                      )}
                    </Badge>
                  ) : null}
                </div>
                {element.options.hasAnswerFeedbacks ? (
                  <div className="mt-1 break-words text-xs text-slate-600">
                    {t('shared.generic.feedback')}:&nbsp;
                    {choice.feedback || t('manage.elements.noFeedbackDefined')}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {element.type === ElementType.Numerical ? (
        <div className="flex flex-col gap-2">
          <h5 className="m-0 text-sm font-bold">
            {t('manage.elements.optionsImportDescription')}
          </h5>
          <dl className="m-0 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ReviewField label={t('shared.generic.precision')}>
              {element.options.accuracy ?? '–'}
            </ReviewField>
            <ReviewField label={t('shared.generic.unit')}>
              {element.options.unit || '–'}
            </ReviewField>
            <ReviewField
              label={t('manage.elements.elementImportNumericalPlaceholder')}
            >
              {element.options.placeholder || '–'}
            </ReviewField>
            <ReviewField label={t('shared.generic.minLong')}>
              {element.options.restrictions?.min ?? '–'}
            </ReviewField>
            <ReviewField label={t('shared.generic.maxLong')}>
              {element.options.restrictions?.max ?? '–'}
            </ReviewField>
          </dl>
          {element.options.hasSampleSolution ? (
            <div>
              <h5 className="mb-1 text-sm font-bold">
                {element.options.solutionType === 'range'
                  ? t('manage.elements.solutionRanges')
                  : t('manage.elements.exactSolutions')}
              </h5>
              {element.options.solutionType === 'range' ? (
                <ol className="m-0 list-decimal pl-6 text-sm">
                  {(element.options.solutionRanges ?? []).map(
                    (range, index) => (
                      <li key={index}>
                        {String(range.min ?? '–')} – {String(range.max ?? '–')}
                      </li>
                    )
                  )}
                </ol>
              ) : (
                <ol className="m-0 list-decimal pl-6 text-sm">
                  {(element.options.exactSolutions ?? []).map(
                    (solution, index) => (
                      <li key={index}>{String(solution)}</li>
                    )
                  )}
                </ol>
              )}
            </div>
          ) : (
            <NoSampleSolutionNotice />
          )}
        </div>
      ) : null}

      {element.type === ElementType.FreeText ? (
        <div className="flex flex-col gap-2">
          <dl className="m-0 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ReviewField label={t('manage.elements.maximumLength')}>
              {element.options.restrictions?.maxLength ?? '–'}
            </ReviewField>
          </dl>
          {element.options.hasSampleSolution ? (
            <div>
              <h5 className="mb-1 text-sm font-bold">
                {t('manage.elements.possibleSolutions')}
              </h5>
              <ol className="m-0 list-decimal pl-6 text-sm">
                {(element.options.solutions ?? []).map((solution, index) => (
                  <li key={index} className="whitespace-pre-wrap break-words">
                    {solution}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <NoSampleSolutionNotice />
          )}
        </div>
      ) : null}

      {element.type === ElementType.Selection ? (
        <div className="flex flex-col gap-2">
          <ReviewField label={t('manage.elements.numberOfInputs')}>
            {element.options.numberOfInputs}
          </ReviewField>
          {element.options.hasSampleSolution ? (
            <div>
              <h5 className="mb-1 text-sm font-bold">
                {t('manage.elements.correctAnswerOptions')}
              </h5>
              <ol className="m-0 list-decimal pl-6 text-sm">
                {(element.options.correctAnswers ?? []).map((answerId) => (
                  <li key={answerId} className="break-words">
                    {entryById.get(answerId) ?? `#${answerId}`}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <NoSampleSolutionNotice />
          )}
          <AnswerPool entries={answerCollectionEntries} />
        </div>
      ) : null}

      {element.type === ElementType.CaseStudy ? (
        <div className="flex flex-col gap-3">
          {!element.options.hasSampleSolution ? (
            <NoSampleSolutionNotice />
          ) : null}
          <div>
            <h5 className="mb-1 text-sm font-bold">
              {t('manage.elements.selectedItems')}
            </h5>
            {(element.options.selectedItems ?? []).length > 0 ? (
              <ol className="m-0 list-decimal pl-6 text-sm">
                {(element.options.selectedItems ?? []).map((itemId) => (
                  <li key={itemId} className="break-words">
                    {entryById.get(itemId) ?? `#${itemId}`}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-sm text-slate-600">–</div>
            )}
          </div>
          <div>
            <h5 className="mb-1 text-sm font-bold">
              {t('shared.generic.criteria')}
            </h5>
            <ol className="m-0 flex list-decimal flex-col gap-1 pl-6 text-sm">
              {element.options.criteria.map((criterion) => (
                <li
                  key={criterion.id}
                  className="break-words rounded border border-solid p-2"
                >
                  <div className="font-bold">{criterion.name}</div>
                  <div className="text-slate-600">
                    {String(criterion.min ?? '–')} –{' '}
                    {String(criterion.max ?? '–')};{' '}
                    {t('manage.elements.elementImportCriterionStep', {
                      step: criterion.step,
                    })}
                    {criterion.unit ? `; ${criterion.unit}` : ''}
                  </div>
                  {criterion.labels ? (
                    <div className="mt-1 text-xs text-slate-600">
                      {criterion.labels.min} / {criterion.labels.mid ?? '–'} /{' '}
                      {criterion.labels.max}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h5 className="mb-1 text-sm font-bold">
              {t('shared.generic.cases')}
            </h5>
            <ol className="m-0 flex list-decimal flex-col gap-2 pl-6 text-sm">
              {element.options.cases.map((caseItem) => (
                <li
                  key={caseItem.id}
                  className="break-words rounded border border-solid p-2"
                >
                  <div className="font-bold">{caseItem.title}</div>
                  <div className="whitespace-pre-wrap break-words">
                    {caseItem.description}
                  </div>
                  {caseItem.solutions ? (
                    <div className="mt-2">
                      <div className="text-xs font-bold text-slate-600">
                        {t('manage.elements.solutionRanges')}
                      </div>
                      <ul className="m-0 list-disc pl-5">
                        {Object.entries(caseItem.solutions).flatMap(
                          ([itemKey, criterionSolutions]) =>
                            Object.entries(criterionSolutions).map(
                              ([criterionId, range]) => {
                                const itemId = Number(
                                  itemKey.replace(/^itemId-/, '')
                                )
                                const criterionName =
                                  element.options.criteria.find(
                                    (criterion) => criterion.id === criterionId
                                  )?.name ?? criterionId

                                return (
                                  <li
                                    key={`${itemKey}-${criterionId}`}
                                    className="break-words"
                                  >
                                    {entryById.get(itemId) ?? itemKey} /{' '}
                                    {criterionName}: {range.min} – {range.max}
                                  </li>
                                )
                              }
                            )
                        )}
                      </ul>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
          <AnswerPool entries={answerCollectionEntries} />
        </div>
      ) : null}
    </section>
  )
}

export default ImportedElementDidacticReview
