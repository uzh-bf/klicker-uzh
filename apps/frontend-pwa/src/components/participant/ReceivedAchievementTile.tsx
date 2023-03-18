import { ParticipantAchievementInstance } from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import Image from 'next/image'

function ReceivedAchievementTile({
  instance,
}: {
  instance: ParticipantAchievementInstance
}) {
  const achievement = instance.achievement

  return (
    <div className="flex flex-row items-center w-full gap-4 px-3 py-2 border rounded">
      <Image
        src={achievement.icon}
        width={80}
        height={80}
        alt=""
        className="contain"
      />

      <div className="flex-1">
        <div className="text-sm font-bold">{achievement.name}</div>
        <div className="text-xs">{achievement.description}</div>
        <div className="flex flex-row justify-between pt-1 mt-1 text-xs border-t">
          <div>{instance.achievedCount}x</div>
          <div>{dayjs(instance.achievedAt).format('DD.MM.YYYY')}</div>
        </div>
      </div>
    </div>
  )
}

export default ReceivedAchievementTile
