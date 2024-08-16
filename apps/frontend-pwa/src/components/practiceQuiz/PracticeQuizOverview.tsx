import { useQuery } from '@apollo/client'
import {
  faQuestionCircle,
  faTimesCircle,
} from '@fortawesome/free-regular-svg-icons'
import { faRepeat, faShuffle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementOrderType, SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

interface PracticeQuizOverviewProps {
  displayName: string
  description?: string
  numOfStacks?: number
  orderType: ElementOrderType
  resetTimeDays?: number
  //   previouslyAnswered?: number
  //   stacksWithQuestions?: number
  pointsMultiplier: number
  setCurrentIx: (ix: number) => void
}

function PracticeQuizOverview({
  displayName,
  description,
  numOfStacks,
  orderType,
  resetTimeDays,
  //   previouslyAnswered,
  //   stacksWithQuestions,
  pointsMultiplier,
  setCurrentIx,
}: PracticeQuizOverviewProps) {
  const t = useTranslations()
  const router = useRouter()
  const { data } = useQuery(SelfDocument)

  return (
    <div className="flex flex-col space-y-4">
      {!data?.self && (
        <UserNotification type="warning">
          {t.rich('pwa.general.userNotLoggedIn', {
            login: (text) => (
              <Button
                basic
                className={{
                  root: 'font-bold hover:text-primary-100',
                }}
                onClick={() =>
                  router.push(
                    `/login?expired=true&redirect_to=${
                      encodeURIComponent(
                        window?.location?.pathname +
                          (window?.location?.search ?? '')
                      ) ?? '/'
                    }`
                  )
                }
                data={{ cy: 'login-to-student-login-collect-points' }}
              >
                {text}
              </Button>
            ),
          })}
        </UserNotification>
      )}

      <div className="border-b">
        <H3 className={{ root: 'mb-0' }}>{displayName}</H3>
      </div>

      {description && <DynamicMarkdown content={description} />}

      <div className="flex flex-col gap-2 text-sm md:gap-16 md:flex-row">
        <div className="flex-1 space-y-2">
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faQuestionCircle} />
            <div>
              {t('pwa.microLearning.numOfQuestionSets', {
                number: numOfStacks,
              })}
            </div>
          </div>
          {typeof orderType !== 'undefined' && (
            <div className="flex flex-row items-center gap-2">
              <FontAwesomeIcon icon={faShuffle} />
              <div>{t(`pwa.practiceQuiz.order${orderType}`)}</div>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          {typeof resetTimeDays !== 'undefined' && (
            <div className="flex flex-row items-center gap-2">
              <FontAwesomeIcon icon={faRepeat} />
              {resetTimeDays === 1 ? (
                <>{t('pwa.practiceQuiz.repetitionDaily')}</>
              ) : (
                <>
                  {t('pwa.practiceQuiz.repetitionXDays', {
                    days: resetTimeDays,
                  })}
                </>
              )}
            </div>
          )}
          {/* <div className="flex flex-row items-center gap-2">
        <div>
          Punkte (berechnet): {previousScore}
        </div>
      </div>
      <div className="flex flex-row items-center gap-2">
        <div>
          Punkte (gesammelt):{' '}
          {previousPointsAwarded}
        </div>
      </div> */}
          {/* {typeof previouslyAnswered !== 'undefined' && (
            <div className="flex flex-row items-center gap-2">
              <FontAwesomeIcon icon={faCheck} />
              <div>
                {t('pwa.practiceQuiz.answeredMinOnce', {
                  answered: previouslyAnswered,
                  total: stacksWithQuestions,
                })}
              </div>
            </div>
          )} */}
          {/* <div className="flex flex-row items-center gap-2">
        Anzahl Antworten:{' '}
        <div>{totalTrials}</div>
      </div> */}
          {typeof pointsMultiplier !== 'undefined' && (
            <div className="flex flex-row items-center gap-2">
              <FontAwesomeIcon icon={faTimesCircle} />
              <div>
                {t('pwa.practiceQuiz.multiplicatorPoints', {
                  mult: pointsMultiplier,
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <Button
        className={{ root: 'self-end text-lg' }}
        onClick={() => setCurrentIx(0)}
        data={{ cy: 'start-practice-quiz' }}
      >
        {t('shared.generic.start')}
      </Button>
    </div>
  )
}

export default PracticeQuizOverview
