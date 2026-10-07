import { useQuery } from '@apollo/client'
import {
  faQuestionCircle,
  faTimesCircle,
} from '@fortawesome/free-regular-svg-icons'
import { faRepeat, faShuffle } from '@fortawesome/free-solid-svg-icons'
import {
  type ElementOrderType,
  SelfDocument,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import {
  PracticeQuizOverviewFact,
  PracticeQuizOverviewFactColumn,
  PracticeQuizOverviewFacts,
  PracticeQuizOverviewHeader,
  PracticeQuizStartButton,
} from '@klicker-uzh/shared-components/src/practiceQuiz/PracticeQuizOverviewParts'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'

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
  previewOnly: boolean
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
  previewOnly,
}: PracticeQuizOverviewProps) {
  const t = useTranslations()
  const router = useRouter()
  const { data } = useQuery(SelfDocument, { skip: previewOnly })

  const pageInFrame =
    global?.window &&
    global?.window?.location !== global?.window?.parent.location

  return (
    <div className="flex flex-col space-y-4">
      {!previewOnly &&
        (!data?.self || data.self.role === UserRole.TemporaryParticipant) && (
          <UserNotification type="warning">
            {pageInFrame
              ? t('pwa.general.userNotLoggedInFrame')
              : t.rich('pwa.general.userNotLoggedIn', {
                  login: (text) => (
                    <Button
                      basic
                      className={{
                        root: 'hover:text-primary-100 p-0! text-sm font-bold hover:bg-transparent',
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

      <PracticeQuizOverviewHeader
        displayName={displayName}
        description={description}
      />

      <PracticeQuizOverviewFacts>
        <PracticeQuizOverviewFactColumn>
          <PracticeQuizOverviewFact icon={faQuestionCircle}>
            <div>
              {t('pwa.microLearning.numOfQuestionSets', {
                number: numOfStacks ?? 0,
              })}
            </div>
          </PracticeQuizOverviewFact>
          {typeof orderType !== 'undefined' && (
            <PracticeQuizOverviewFact icon={faShuffle}>
              <div>{t(`pwa.practiceQuiz.order${orderType}`)}</div>
            </PracticeQuizOverviewFact>
          )}
        </PracticeQuizOverviewFactColumn>

        <PracticeQuizOverviewFactColumn>
          {typeof resetTimeDays !== 'undefined' && (
            <PracticeQuizOverviewFact icon={faRepeat}>
              {resetTimeDays === 1 ? (
                <>{t('pwa.practiceQuiz.repetitionDaily')}</>
              ) : (
                <>
                  {t('pwa.practiceQuiz.repetitionXDays', {
                    days: resetTimeDays,
                  })}
                </>
              )}
            </PracticeQuizOverviewFact>
          )}
          {typeof pointsMultiplier !== 'undefined' && (
            <PracticeQuizOverviewFact icon={faTimesCircle}>
              <div>
                {t('pwa.practiceQuiz.multiplicatorPoints', {
                  mult: pointsMultiplier,
                })}
              </div>
            </PracticeQuizOverviewFact>
          )}
        </PracticeQuizOverviewFactColumn>
      </PracticeQuizOverviewFacts>

      <PracticeQuizStartButton
        label={t('shared.generic.start')}
        onClick={() => setCurrentIx(0)}
        cy="start-practice-quiz"
      />
    </div>
  )
}

export default PracticeQuizOverview
