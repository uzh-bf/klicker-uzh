import dayjs from 'dayjs'
import Image from 'next/image'
import { useRouter } from 'next/router'

export interface ReceivedAchievementInstance {
  id: number
  achievedAt: Date | string
  achievedCount: number
  achievement: {
    id: number
    nameDE?: string | null
    nameEN?: string | null
    descriptionDE?: string | null
    descriptionEN?: string | null
    icon: string
    iconColor?: string | null
  }
}

function ReceivedAchievementTile({
  instance,
}: {
  instance: ReceivedAchievementInstance
}) {
  const { locale } = useRouter()
  const achievement = instance.achievement

  return (
    <div className="flex w-full flex-row items-center gap-4 rounded border px-3 py-2">
      <Image
        src={achievement.icon}
        width={80}
        height={80}
        alt=""
        className="contain"
      />

      <div className="flex-1">
        <div className="text-sm font-bold">
          {locale === 'de' ? achievement.nameDE : achievement.nameEN}
        </div>
        <div className="text-xs">
          {locale === 'de'
            ? achievement.descriptionDE
            : achievement.descriptionEN}
        </div>
        <div className="mt-1 flex flex-row justify-between border-t pt-1 text-xs">
          <div>{instance.achievedCount}x</div>
          <div>{dayjs(instance.achievedAt).format('DD.MM.YYYY')}</div>
        </div>
      </div>
    </div>
  )
}

export default ReceivedAchievementTile
