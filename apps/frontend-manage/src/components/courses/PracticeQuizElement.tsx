import {
  faHandPointer,
  faPencil,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { PracticeQuiz, PublicationStatus } from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Dropdown } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import StatusTag from './StatusTag'
import DeletePracticeQuizButton from './actions/DeletePracticeQuizButton'
import EditPracticeQuizButton from './actions/EditPracticeQuizButton'
import PracticeQuizAccessLink from './actions/PracticeQuizAccessLink'
import PracticeQuizPreviewLink from './actions/PracticeQuizPreviewLink'
import PublishPracticeQuizButton from './actions/PublishPracticeQuizButton'

interface PracticeQuizElementProps {
  practiceQuiz: Partial<PracticeQuiz>
  courseId: string
}

function PracticeQuizElement({
  practiceQuiz,
  courseId,
}: PracticeQuizElementProps) {
  const t = useTranslations()

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/quiz/${practiceQuiz.id}/`

  return (
    <div
      className="w-full p-2 border border-solid rounded border-uzh-grey-80"
      data-cy={`practice-quiz-${practiceQuiz.name}`}
    >
      <div>
        <div className="flex flex-row justify-between">
          <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
            {practiceQuiz.name || ''}
          </Ellipsis>
          <div className="flex flex-row items-center gap-3 text-sm">
            {practiceQuiz.status === PublicationStatus.Draft && (
              <>
                <PublishPracticeQuizButton practiceQuiz={practiceQuiz} />
                <Dropdown
                  className={{ item: 'p-1', viewport: 'bg-white' }}
                  trigger={t('manage.course.otherActions')}
                  items={[
                    {
                      label: (
                        <PracticeQuizAccessLink
                          practiceQuiz={practiceQuiz}
                          href={href}
                        />
                      ),
                      onClick: () => null,
                    },
                    {
                      label: (
                        <PracticeQuizPreviewLink
                          practiceQuiz={practiceQuiz}
                          href={href}
                        />
                      ),
                      onClick: () => null,
                    },
                    {
                      label: (
                        <EditPracticeQuizButton practiceQuiz={practiceQuiz} />
                      ),
                      onClick: () => null,
                    },

                    {
                      label: (
                        <DeletePracticeQuizButton practiceQuiz={practiceQuiz} />
                      ),
                      onClick: () => null,
                    },
                  ]}
                  triggerIcon={faHandPointer}
                />
              </>
            )}

            {practiceQuiz.status === PublicationStatus.Published && (
              <>
                <PracticeQuizAccessLink
                  practiceQuiz={practiceQuiz}
                  href={href}
                />
                <Dropdown
                  className={{ item: 'p-1', viewport: 'bg-white' }}
                  trigger={t('manage.course.otherActions')}
                  items={[
                    {
                      label: (
                        <PracticeQuizPreviewLink
                          practiceQuiz={practiceQuiz}
                          href={href}
                        />
                      ),
                      onClick: () => null,
                    },
                  ]}
                  triggerIcon={faHandPointer}
                />
              </>
            )}

            {practiceQuiz.status === PublicationStatus.Draft && (
              <StatusTag
                color="bg-gray-200"
                status={t('shared.generic.draft')}
                icon={faPencil}
              />
            )}
            {practiceQuiz.status === PublicationStatus.Published && (
              <StatusTag
                color="bg-green-300"
                status={t('shared.generic.published')}
                icon={faUserGroup}
              />
            )}
          </div>
        </div>
        <div
          className="mb-1 text-sm italic"
          data-cy={`practice-quiz-num-of-questions-${practiceQuiz.name}`}
        >
          {t('manage.course.nQuestions', {
            number: practiceQuiz.numOfQuestions || '0',
          })}
        </div>
      </div>
    </div>
  )
}

export default PracticeQuizElement
