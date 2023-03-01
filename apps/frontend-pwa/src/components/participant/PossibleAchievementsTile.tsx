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
    <div className="flex flex-row items-center w-full gap-4 px-3 py-2 border rounded">
      <Image
        src={achievement.icon}
        width={45}
        height={45}
        alt=""
        className="contain"
        style={{ filter: 'grayscale(100%)' }}
      />

      <div className="text-sm font-bold text-gray-500">
        {t('pwa.achievements.notAchievedYet')}
      </div>
    </div>
  )
}

export default PossibleAchievementsTile
