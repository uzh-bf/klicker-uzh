import { Achievement } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

function PossibleAchievementsTile({
  achievement,
}: {
  achievement: Achievement
}) {
  const t = useTranslations()

  return (
    <div className="flex flex-row w-full gap-6 p-2 pl-4 border rounded">
      <div className="relative flex-initial w-10">
        <Image
          src={achievement.icon}
          fill
          alt=""
          className="contain"
          style={{ filter: 'grayscale(100%)' }}
        />
      </div>

      <div className="flex-1">
        <div className="text-sm font-bold text-gray-500">
          {t('pwa.achievements.notAchievedYet')}
        </div>
      </div>
    </div>
  )
}

export default PossibleAchievementsTile
