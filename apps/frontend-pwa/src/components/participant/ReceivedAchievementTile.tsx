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
    <div className="flex flex-row w-full gap-6 p-2 pl-4 border rounded">
      <div className="relative flex-initial w-10">
        <Image src={achievement.icon} fill alt="" className="contain" />
      </div>

      <div className="flex-1">
        <div className="text-sm font-bold text-ellipsis">
          {achievement.name}
        </div>
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
