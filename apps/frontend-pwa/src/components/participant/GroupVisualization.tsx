import Image from 'next/image'

export const POSITIONS = [
  [55, 156],
  [55, 132.5],
  [55, 107.5],
  [55, 83.5],
  [55, 55],
]

function GroupVisualization({ participants, scaleFactor }) {
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
      <div className="absolute top-0 left-0 right-0">
        <Image
          className="border rounded-lg shadow"
          src="/bubbelgroup.svg"
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
    </div>
  )
}
GroupVisualization.defaultProps = {
  scaleFactor: 1.7,
}

export default GroupVisualization
