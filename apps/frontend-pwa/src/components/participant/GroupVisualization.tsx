import { Participant } from '@klicker-uzh/graphql/dist/ops'
import Image from 'next/image'

export const POSITIONS = [
  [55, 156],
  [55, 132.5],
  [55, 107.5],
  [55, 83.5],
  [55, 55],
]

interface GroupVisualizationProps {
  groupName: string
  participants: Partial<Participant>[]
  scaleFactor?: number
}

function GroupVisualization({
  groupName,
  participants,
  scaleFactor = 1.7,
}: GroupVisualizationProps) {
  const height = 351 * scaleFactor
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
            top: `${POSITIONS[ix][0] * scaleFactor}px`,
            left: `${POSITIONS[ix][1] * scaleFactor}px`,
          }}
          src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${
            participant.avatar ?? 'placeholder'
          }.svg`}
          alt=""
          height={16 * scaleFactor}
          width={16 * scaleFactor}
        />
      ))}
      <div className="absolute top-[64.5px] w-40 text-center left-[130px] text-md">
        {groupName}
      </div>
    </div>
  )
}

export default GroupVisualization
