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
    <div className="relative !p-0 hover:bg-transparent" data-cy="header-avatar">
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
          className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-white pl-[0.3rem] text-xs font-bold text-slate-600"
          data-cy="participant-level"
        >
          {level}
        </div>
      )}
    </div>
  )
}

export default AvatarWithLevel
