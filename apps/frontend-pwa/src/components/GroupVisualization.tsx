import Image from 'next/future/image'

export const POSITIONS = [
  [77, 75],
  [69, 98],
  [101, 83],
  [93, 106],
  [123, 92],
  [115, 115],
  [146, 100],
  [138, 123],
  [170, 108],
  [162, 131],
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
          className="border shadow rounded-xl"
          src="/rakete_mond.png"
          width={width}
          height={height}
        />
        {/* <Image className="" src="/rocket_base.svg" fill /> */}
      </div>

      {participants.slice(0, 10).map((participant, ix) => (
        <Image
          key={participant.avatar}
          className="absolute rounded-full"
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
