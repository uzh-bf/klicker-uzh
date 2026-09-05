import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { GetAssessmentResultsLiveQuizQuery } from '@klicker-uzh/graphql/dist/ops'
import DataTable from '@klicker-uzh/shared-components/src/DataTable'
import TableSortingButton from '@klicker-uzh/shared-components/src/TableSortingButton'
import { Select } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { type Dispatch, type SetStateAction, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

type AssessmentStudentResult = NonNullable<
  GetAssessmentResultsLiveQuizQuery['assessmentResultsLiveQuiz']
>['studentResults'][number]
export type PageSizeOption = '10' | '15' | '30' | 'all'

function AssessmentStudentResultsTable({
  quizName,
  studentResults,
  selectedParticipantId,
  onSelect,
  availableBasePoints,
  availableCorrectnessPoints,
  availableBonusPoints,
  pageSizeOption,
  setPageSizeOption,
}: {
  quizName: string
  studentResults: AssessmentStudentResult[]
  selectedParticipantId: string | null
  onSelect: Dispatch<SetStateAction<{ id: string; email: string } | null>>
  availableBasePoints: number
  availableCorrectnessPoints: number
  availableBonusPoints: number
  pageSizeOption: PageSizeOption
  setPageSizeOption: Dispatch<SetStateAction<PageSizeOption>>
}) {
  const t = useTranslations()
  const formatter = useFormatter()

  const rows = useMemo<(AssessmentStudentResult & { totalPoints: number })[]>(
    () =>
      studentResults.map((result) => ({
        ...result,
        totalPoints:
          result.basePoints + result.correctnessPoints + result.bonusPoints,
      })),
    [studentResults]
  )

  const pageSizeItems = useMemo(() => {
    const baseOptions: { value: PageSizeOption; label: string }[] = [
      10, 15, 30,
    ].map((size) => ({
      value: String(size) as PageSizeOption,
      label: t('manage.general.NEntriesPerPage', { N: size }),
    }))
    return [...baseOptions, { value: 'all', label: t('manage.catalog.all') }]
  }, [t])

  const formatNumber = (value: number) =>
    formatter.number(value, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    })

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
          <div className="bg-muted rounded-md px-2 py-1">
            <span className="font-semibold">
              {t('manage.general.basePointsDescription')}
            </span>
            <span>{`: ${formatNumber(availableBasePoints)}`}</span>
          </div>
          <div className="bg-muted rounded-md px-2 py-1">
            <span className="font-semibold">
              {t('manage.general.correctnessPointsDescription')}
            </span>
            <span>{`: ${formatNumber(availableCorrectnessPoints)}`}</span>
          </div>
          <div className="bg-muted rounded-md px-2 py-1">
            <span className="font-semibold">
              {t('manage.general.bonusPointsDescription')}
            </span>
            <span>{`: ${formatNumber(availableBonusPoints)}`}</span>
          </div>
          <div className="bg-muted rounded-md px-2 py-1">
            <span className="font-semibold">{t('shared.generic.total')}</span>
            <span>{`: ${formatNumber(
              availableBasePoints +
                availableCorrectnessPoints +
                availableBonusPoints
            )}`}</span>
          </div>
        </div>
        <div className="flex justify-end">
          <Select
            value={pageSizeOption}
            items={pageSizeItems}
            onChange={(value) => setPageSizeOption(value as PageSizeOption)}
            className={{ trigger: 'h-8 w-48 text-sm', item: 'text-sm' }}
            data={{ cy: 'live-quiz-results-page-size-select' }}
          />
        </div>
      </div>
      <DataTable
        key={pageSizeOption}
        initialPageSize={
          pageSizeOption === 'all' ? undefined : Number(pageSizeOption)
        }
        isPaginated={pageSizeOption !== 'all'}
        csvFilename={`live-quiz-results-${quizName}.csv`}
        columns={[
          {
            accessorKey: 'participantEmail',
            displayName: t('manage.assessment.liveQuizStudentEmailColumn'),
            header: ({ column }) => (
              <div>
                <TableSortingButton
                  column={column}
                  title={t('manage.assessment.liveQuizStudentEmailColumn')}
                  className="text-xs"
                />
              </div>
            ),
            cell: ({ getValue }) => (
              <span className="block max-w-[16rem] truncate sm:max-w-[10rem] md:max-w-[12rem] lg:max-w-[14rem]">
                {getValue<string>()}
              </span>
            ),
            className:
              'max-w-[16rem] pr-2 text-left sm:max-w-[10rem] md:max-w-[12rem] lg:max-w-[14rem]',
          },
          {
            accessorKey: 'assessmentGivenName',
            displayName: t('manage.assessment.liveQuizStudentGivenNameColumn'),
            csvOnly: true,
          },
          {
            accessorKey: 'assessmentSurname',
            displayName: t('manage.assessment.liveQuizStudentSurnameColumn'),
            csvOnly: true,
          },
          {
            accessorKey: 'assessmentMatriculationNumber',
            displayName: t(
              'manage.assessment.liveQuizStudentMatriculationNumberColumn'
            ),
            csvOnly: true,
          },
          {
            accessorKey: 'basePoints',
            displayName: t('manage.general.basePointsDescription'),
            header: ({ column }) => (
              <TableSortingButton
                column={column}
                title={t('manage.general.basePointsDescription')}
                className="text-xs"
              />
            ),
            cell: ({ row }) => formatNumber(row.original.basePoints),
            className: 'w-max whitespace-normal break-words px-2 text-center',
          },
          {
            accessorKey: 'correctnessPoints',
            displayName: t('manage.general.correctnessPointsDescription'),
            header: ({ column }) => (
              <TableSortingButton
                column={column}
                title={t('manage.general.correctnessPointsDescription')}
                className="text-xs"
              />
            ),
            cell: ({ row }) => formatNumber(row.original.correctnessPoints),
            className: 'w-max whitespace-normal break-words px-2 text-center',
          },
          {
            accessorKey: 'bonusPoints',
            displayName: t('manage.general.bonusPointsDescription'),
            header: ({ column }) => (
              <TableSortingButton
                column={column}
                title={t('manage.general.bonusPointsDescription')}
                className="text-xs"
              />
            ),
            cell: ({ row }) => formatNumber(row.original.bonusPoints),
            className: 'w-max whitespace-normal break-words px-2 text-center',
          },
          {
            accessorKey: 'totalPoints',
            displayName: t('shared.generic.total'),
            header: ({ column }) => (
              <TableSortingButton
                column={column}
                title={t('shared.generic.total')}
                className="text-xs"
              />
            ),
            cell: ({ row }) => (
              <span className="font-semibold">
                {formatNumber(row.original.totalPoints)}
              </span>
            ),
            className: 'w-max whitespace-normal break-words px-2 text-center',
          },
          {
            csvHidden: true,
            accessorKey: 'selectIndicator',
            id: 'selectIndicator',
            header: () => null,
            cell: ({ row }) => (
              <FontAwesomeIcon
                icon={faChevronRight}
                className={twMerge(
                  'h-4 w-4 transition-colors',
                  row.original.participantId === selectedParticipantId
                    ? 'text-primary-100'
                    : 'text-muted-foreground'
                )}
              />
            ),
            enableSorting: false,
            className: 'w-8 pr-4 text-right',
          },
        ]}
        data={rows}
        initialSorting={[{ id: 'totalPoints', desc: true }]}
        className={{
          table: 'text-sm',
          tableHeader: 'bg-muted/40',
          tableCell: 'px-2 py-2 align-middle',
          tableRow: 'align-middle',
          buttons: 'text-sm',
          buttonsContainer: 'items-center',
        }}
        isResetSortingEnabled={false}
        onRowClick={(row) =>
          onSelect({ id: row.participantId, email: row.participantEmail })
        }
        getRowClassName={(row) =>
          twMerge(
            'cursor-pointer transition-colors',
            row.participantId === selectedParticipantId
              ? '!bg-primary-20 hover:!bg-primary-30 [&>td]:!bg-primary-20 hover:[&>td]:!bg-primary-30 outline outline-2 outline-primary-100/60'
              : 'hover:bg-muted/50'
          )
        }
      />
    </>
  )
}

export default AssessmentStudentResultsTable
