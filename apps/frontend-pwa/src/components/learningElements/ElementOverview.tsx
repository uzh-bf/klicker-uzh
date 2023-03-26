import {
  faQuestionCircle,
  faTimesCircle,
} from '@fortawesome/free-regular-svg-icons'
import { faCheck, faRepeat, faShuffle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import DynamicMarkdown from './DynamicMarkdown'

interface ElementOverviewProps {
  displayName: string
  description?: string
  numOfQuestions?: number
  orderType: string
  resetTimeDays?: number
  previouslyAnswered?: number
  stacksWithQuestions?: number
  pointsMultiplier: number
  setCurrentIx: (ix: number) => void
}

function ElementOverview({
  displayName,
  description,
  numOfQuestions,
  orderType,
  resetTimeDays,
  previouslyAnswered,
  stacksWithQuestions,
  pointsMultiplier,
  setCurrentIx,
}: ElementOverviewProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-col space-y-4">
      <div className="border-b">
        <H3 className={{ root: 'mb-0' }}>{displayName}</H3>
      </div>

      {description && <DynamicMarkdown content={description} />}

      <div className="flex flex-col gap-2 text-sm md:gap-16 md:flex-row">
        <div className="flex-1 space-y-2">
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faQuestionCircle} />
            <div>
              {t('pwa.learningElement.numOfQuestions', {
                number: numOfQuestions,
              })}
            </div>
          </div>
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faShuffle} />
            <div>{t(`pwa.learningElement.order${orderType}`)}</div>
          </div>
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faRepeat} />
            {resetTimeDays === 1 ? (
              <>{t('pwa.learningElement.repetitionDaily')}</>
            ) : (
              <>
                {t('pwa.learningElement.repetitionXDays', {
                  days: resetTimeDays,
                })}
              </>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-2">
          {/* <div className="flex flex-row items-center gap-2">
        <div>
          Punkte (berechnet): {data.learningElement.previousScore}
        </div>
      </div>
      <div className="flex flex-row items-center gap-2">
        <div>
          Punkte (gesammelt):{' '}
          {data.learningElement.previousPointsAwarded}
        </div>
      </div> */}
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faCheck} />
            <div>
              {t('pwa.learningElement.answeredMinOnce', {
                answered: previouslyAnswered,
                total: stacksWithQuestions,
              })}
            </div>
          </div>
          {/* <div className="flex flex-row items-center gap-2">
        Anzahl Antworten:{' '}
        <div>{data.learningElement.totalTrials}</div>
      </div> */}
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faTimesCircle} />
            <div>
              {t('pwa.learningElement.multiplicatorPoints', {
                mult: pointsMultiplier,
              })}
            </div>
          </div>
        </div>
      </div>

      <Button
        className={{ root: 'self-end text-lg' }}
        onClick={() => setCurrentIx(0)}
        data={{ cy: 'start-learning-element' }}
      >
        {t('shared.generic.start')}
      </Button>
    </div>
  )
}

export default ElementOverview
