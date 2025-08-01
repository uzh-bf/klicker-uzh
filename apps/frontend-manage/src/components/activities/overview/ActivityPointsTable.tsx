import { faBookOpen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCell,
  ShadcnTableFooter,
  ShadcnTableHead,
  ShadcnTableHeader,
  ShadcnTableRow,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

function ActivityPointsTable({
  isLiveQuiz,
  basePoints,
  correctnessPoints,
  bonusPoints,
  totalPoints,
  pointsMultiplier,
  type = 'activity',
}: {
  isLiveQuiz: boolean
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
  totalPoints: number
  pointsMultiplier?: number | null
  type?: 'instance' | 'activity'
}) {
  const t = useTranslations()

  return (
    <div className="mb-1 flex flex-col">
      <ShadcnTable className="mb-2">
        <ShadcnTableHeader>
          <ShadcnTableRow>
            <ShadcnTableHead className="font-bold">
              {t('manage.general.pointTypeDescription')}
            </ShadcnTableHead>
            <ShadcnTableHead className="text-right font-bold">
              {t('manage.general.pointAmountDescription')}
            </ShadcnTableHead>
          </ShadcnTableRow>
        </ShadcnTableHeader>
        {isLiveQuiz ? (
          <ShadcnTableBody className="font-normal">
            <ShadcnTableRow>
              <ShadcnTableCell>
                {t('manage.general.basePointsDescription')}
              </ShadcnTableCell>
              <ShadcnTableCell
                className="text-right"
                data-cy={`base-points-${type}`}
              >
                {`${basePoints} P.`}
              </ShadcnTableCell>
            </ShadcnTableRow>
            <ShadcnTableRow>
              <ShadcnTableCell>
                {`${t('manage.general.correctnessPointsDescription')}${pointsMultiplier ? ` (${t('manage.general.pointsMultiplierDescription')} ${pointsMultiplier}x)` : ''}`}
              </ShadcnTableCell>
              <ShadcnTableCell
                className="text-right"
                data-cy={`correctness-points-${type}`}
              >
                {`${correctnessPoints} P.`}
              </ShadcnTableCell>
            </ShadcnTableRow>
            <ShadcnTableRow>
              <ShadcnTableCell>
                {`${t('manage.general.bonusPointsDescription')}${pointsMultiplier ? ` (${t('manage.general.pointsMultiplierDescription')} ${pointsMultiplier}x)` : ''}`}
              </ShadcnTableCell>
              <ShadcnTableCell
                className="text-right"
                data-cy={`bonus-points-${type}`}
              >
                {`${bonusPoints} P.`}
              </ShadcnTableCell>
            </ShadcnTableRow>
          </ShadcnTableBody>
        ) : null}
        <ShadcnTableFooter>
          <ShadcnTableRow>
            <ShadcnTableCell colSpan={1} className="font-bold">
              {/* {isLiveQuiz
                ? t('manage.general.totalPointsSynchronousDescription')
                : t('manage.general.totalPointsAsynchronousDescription')} */}

              {isLiveQuiz ? (
                t('manage.general.totalPointsSynchronousDescription')
              ) : (
                <>
                  {t('manage.general.totalPointsAsynchronousDescription')}
                  {pointsMultiplier && (
                    <span className="font-normal">
                      {` (${t('manage.general.pointsMultiplierDescription')} ${
                        pointsMultiplier
                      }x)`}
                    </span>
                  )}
                </>
              )}
            </ShadcnTableCell>
            <ShadcnTableCell
              className="text-uzh-darkgreen-100 text-right font-bold"
              data-cy={`total-points-${type}`}
            >
              {`${totalPoints} P.`}
            </ShadcnTableCell>
          </ShadcnTableRow>
        </ShadcnTableFooter>
      </ShadcnTable>
      <Link
        href="https://www.klicker.uzh.ch/gamification/grading_logic/"
        passHref
        legacyBehavior
      >
        <a
          className="text-primary-100 flex flex-row items-center gap-2 self-end text-sm hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FontAwesomeIcon icon={faBookOpen} />
          {t('manage.general.gradingDescription')}
        </a>
      </Link>
    </div>
  )
}

export default ActivityPointsTable
