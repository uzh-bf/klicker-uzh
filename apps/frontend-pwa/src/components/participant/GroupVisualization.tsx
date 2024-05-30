import { Participant } from '@klicker-uzh/graphql/dist/ops'
import Image from 'next/image'

export const POSITIONS = [
  [46, 67],
  [46, 52],
  [46, 37],
  [46, 23],
  [46, 6],
]

interface GroupVisualizationProps {
  groupName: string
  participants: Omit<Participant, 'isActive' | 'locale' | 'xp'>[]
  scaleFactor?: number
}

function GroupVisualization({
  groupName,
  participants,
  scaleFactor = 1.3,
}: GroupVisualizationProps) {
  const height = 132 * scaleFactor
  const width = 248 * scaleFactor

  return (
    <div
      className="relative flex-initial"
      style={{
        height,
        width,
      }}
    >
      <div className="absolute">
        <Image
          className=""
          src="/Bus.svg"
          width={width}
          height={height}
          alt=""
        />
        {/* <Image className="" src="/rocket_base.svg" fill /> */}
      </div>

      {participants.slice(0, 5).map((participant, ix) => (
        <Image
          key={participant.avatar}
          className="absolute"
          style={{
            top: `${POSITIONS[ix][0]}%`,
            left: `${POSITIONS[ix][1]}%`,
            width: '10%',
          }}
          src={
            participant.avatar
              ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${participant.avatar}.svg`
              : '/user-solid.svg'
          }
          alt=""
          height={50}
          width={50}
        />
      ))}

      <div
        className="absolute w-full text-sm font-bold text-center text-slate-700"
        style={{ top: '29%' }}
      >
        {groupName}
      </div>
    </div>
  )
}

export default GroupVisualization
