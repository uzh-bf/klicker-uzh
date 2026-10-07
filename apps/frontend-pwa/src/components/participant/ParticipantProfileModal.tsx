import { useQuery } from '@apollo/client'
import { GetPublicParticipantProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ProfileData from './ProfileData'

interface ParticipantProfileModalProps {
  onClose: () => void
  participantId: string
  top10Participants: string[]
}

function ParticipantProfileModal({
  onClose,
  participantId,
  top10Participants,
}: ParticipantProfileModalProps) {
  const [selectedParticipant, setSelectedParticipant] =
    useState<string>(participantId)
  const [currentIndex, setCurrentIndex] = useState<number>(
    top10Participants.indexOf(participantId)
  )
  const { data, loading } = useQuery(GetPublicParticipantProfileDocument, {
    variables: { id: selectedParticipant },
  })

  const participant = data?.publicParticipantProfile

  const onNext = () => {
    const nextIndex = (currentIndex + 1) % top10Participants.length
    setSelectedParticipant(top10Participants[nextIndex])
    setCurrentIndex(nextIndex)
  }

  const onPrev = () => {
    const prevIndex =
      (currentIndex - 1 + top10Participants.length) % top10Participants.length
    setSelectedParticipant(top10Participants[prevIndex])
    setCurrentIndex(prevIndex)
  }

  return (
    <Modal
      open
      loading={loading || !participant}
      onClose={onClose}
      className={{
        content: 'my-auto w-[500px]',
        title: 'text-3xl',
        onNext: 'hidden md:block',
        onPrev: 'hidden md:block',
      }}
      onNext={onNext}
      onPrev={onPrev}
      title="Top 10"
    >
      {participant && (
        <div className="px-auto flex h-full w-full flex-col items-center justify-between">
          <ProfileData
            level={participant.levelData}
            xp={participant.xp ?? 0}
            avatar={participant.avatar}
            username={participant.username}
            achievements={participant.achievements}
            isSelf={participant.isSelf ?? false}
            showProfileDetails={
              participant.isProfilePublic || participant.isSelf
            }
          />
          <div className="grid w-full grid-cols-10 justify-items-center pt-5">
            {top10Participants.slice(0, 10).map((p, index) => (
              <div
                key={index}
                className={twMerge(
                  'h-2 w-2 rounded-full hover:cursor-pointer',
                  index === currentIndex ? 'bg-black' : 'bg-gray-300'
                )}
                onClick={() => {
                  setCurrentIndex(index)
                  setSelectedParticipant(p)
                }}
              />
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ParticipantProfileModal
