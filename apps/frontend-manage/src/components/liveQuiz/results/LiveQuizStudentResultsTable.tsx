import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetAssessmentResultsLiveQuizQuery } from '@klicker-uzh/graphql/dist/ops'
import DataTable from '@klicker-uzh/shared-components/src/DataTable'
import TableSortingButton from '@klicker-uzh/shared-components/src/TableSortingButton'
import { useFormatter, useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

type LiveQuizStudentResult = NonNullable<
  GetAssessmentResultsLiveQuizQuery['assessmentResultsLiveQuiz']
>['studentResults'][number]

type StudentRow = LiveQuizStudentResult & { totalPoints: number }

interface LiveQuizStudentResultsTableProps {
  studentResults: LiveQuizStudentResult[]
  selectedParticipantId: string | null
  onSelect: (participantId: string | null) => void
}

function LiveQuizStudentResultsTable({
  studentResults,
  selectedParticipantId,
  onSelect,
}: LiveQuizStudentResultsTableProps) {
  const t = useTranslations()
  const formatter = useFormatter()

  const rows = useMemo<StudentRow[]>(
    () =>
      studentResults.map((result) => ({
        ...result,
        totalPoints:
          result.basePoints + result.correctnessPoints + result.bonusPoints,
      })),
    [studentResults]
  )

  const formatNumber = (value: number) =>
    formatter.number(value, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    })

  return (
    <div className="border-muted-foreground/20 rounded-lg border bg-white">
      <div className="border-muted-foreground/10 border-b px-4 py-3">
        <h3 className="font-semibold">
          {t('manage.assessment.liveQuizStudentResultsTitle')}
        </h3>
      </div>

      <DataTable
        columns={[
          {
            accessorKey: 'participantEmail',
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
            accessorKey: 'basePoints',
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
        }}
        isPaginated={false}
        isResetSortingEnabled={false}
        onRowClick={(row) => onSelect(row.participantId)}
        getRowClassName={(row) =>
          twMerge(
            'cursor-pointer transition-colors',
            row.participantId === selectedParticipantId
              ? '!bg-primary-20 hover:!bg-primary-30 [&>td]:!bg-primary-20 hover:[&>td]:!bg-primary-30 outline outline-2 outline-primary-100/60'
              : 'hover:bg-muted/50'
          )
        }
      />
    </div>
  )
}

export default LiveQuizStudentResultsTable
