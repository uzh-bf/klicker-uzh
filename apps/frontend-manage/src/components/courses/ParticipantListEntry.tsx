import { Participant } from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import Image from 'next/image'

function ParticipantListEntry({
  participant,
}: {
  participant: Pick<Participant, 'id' | 'username' | 'email' | 'avatar'>
}) {
  return (
    <div className="flex flex-row items-center gap-2">
      <div className="flex h-5 w-5 items-center justify-center">
        <Image
          key={participant.avatar}
          src={
            participant.avatar
              ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${participant.avatar}.svg`
              : '/user-solid.svg'
          }
          alt=""
          height={participant.avatar ? 20 : 15}
          width={participant.avatar ? 20 : 15}
        />
      </div>
      <div className="text-sm">{participant.username}</div>
      <Ellipsis maxLines={1} className={{ content: 'text-sm italic' }}>
        {participant.email ?? ''}
      </Ellipsis>
    </div>
  )
}

export default ParticipantListEntry
