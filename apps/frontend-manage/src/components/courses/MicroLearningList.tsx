import { MicroLearning } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import CatalystNotification from './CatalystNotification'
import MicroLearningElement from './MicroLearningElement'

interface MicroLearningListProps {
  microLearnings: (Partial<MicroLearning> &
    Pick<MicroLearning, 'id' | 'name'>)[]
  userCatalyst?: boolean
}

function MicroLearningList({
  microLearnings,
  userCatalyst,
}: MicroLearningListProps) {
  const t = useTranslations()

  return (
    <>
      {microLearnings && microLearnings.length > 0 ? (
        <div className="flex flex-col gap-2">
          {microLearnings.map((microlearning) => (
            <MicroLearningElement
              microLearning={microlearning}
              key={microlearning.id}
            />
          ))}
        </div>
      ) : userCatalyst ? (
        <div>{t('manage.course.noPracticeQuizzes')}</div>
      ) : (
        <CatalystNotification />
      )}
    </>
  )
}

export default MicroLearningList
