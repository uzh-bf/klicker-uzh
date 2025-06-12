import Image from 'next/image'
import { twMerge } from 'tailwind-merge'

function AvatarWithLevel({
  avatar,
  level,
}: {
  avatar?: string | null
  level?: number | null
}) {
  return (
    <>
      <Image
        src={
          avatar
            ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${avatar}.svg`
            : '/user-solid.svg'
        }
        alt=""
        width="35"
        height="35"
        className={twMerge(
          'hover:bg-uzh-red-20 cursor-pointer rounded-full bg-white',
          avatar ? '' : 'p-1'
        )}
      />
      {level && (
        <div
          className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-white text-xs font-bold text-slate-600"
          data-cy="participant-level"
        >
          {level}
        </div>
      )}
    </>
  )
}

export default AvatarWithLevel
