import {
  GroupActivityClueInstance,
  ParameterType,
  Participant,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'

interface GroupActivityClueProps {
  clue: Omit<GroupActivityClueInstance, 'name' | 'participant'> & {
    participant: Partial<Participant>
  }
}

function GroupActivityClue({ clue }: GroupActivityClueProps) {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center gap-2 py-2 border rounded shadow',
        clue.participant.isSelf && 'border-primary-40'
      )}
      key={clue.participant.id}
    >
      <div className="flex flex-col items-center flex-none w-24 px-4">
        <Image
          src={
            clue.participant.avatar
              ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${clue.participant.avatar}.svg`
              : '/user-solid.svg'
          }
          alt=""
          height={25}
          width={30}
        />
        <div className={twMerge(clue.participant.isSelf && 'font-bold')}>
          {clue.participant.username}
        </div>
      </div>
      <div className="text-sm h-max">
        <div className="font-bold">{clue.displayName}</div>
        {typeof clue.value === 'string' && (
          <div>
            {clue.type === ParameterType.Number ? (
              <div>{`${clue.value} ${clue.unit ?? ''}`}</div>
            ) : (
              <Markdown
                withProse
                content={clue.value}
                className={{ root: 'prose-sm' }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default GroupActivityClue
