import { useQuery } from '@apollo/client'
import { GetParticipantDetailsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ProfileData from './ProfileData'

interface ParticipantProfileModalProps {
  isProfileModalOpen: boolean
  closeProfileModal: () => void
  participantId: string
  top10Participants: string[]
}

function ParticipantProfileModal({
  isProfileModalOpen,
  closeProfileModal,
  participantId,
  top10Participants,
}: ParticipantProfileModalProps) {
  const [selectedParticipant, setSelectedParticipant] =
    useState<string>(participantId)
  const [currentIndex, setCurrentIndex] = useState<number>(
    top10Participants.indexOf(participantId)
  )
  const { data, loading } = useQuery(GetParticipantDetailsDocument, {
    variables: { id: selectedParticipant },
  })

  if (loading || !data?.participantDetails) return <div>loading...</div>

  const participant = data.participantDetails

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
      open={isProfileModalOpen}
      onClose={closeProfileModal}
      className={{
        content: 'w-[500px] my-auto max-h-full overflow-auto',
        title: 'text-3xl',
        onNext: 'hidden md:block',
        onPrev: 'hidden md:block',
      }}
      onNext={onNext}
      onPrev={onPrev}
      title="Top 10"
    >
      <div className="flex flex-col items-center justify-between w-full h-full px-auto">
        <ProfileData
          level={participant.levelData}
          xp={participant.xp}
          avatar={participant.avatar}
          username={participant.username}
          achievements={participant.achievements}
        />
        <div className="grid w-full grid-cols-10 pt-5 justify-items-center">
          {top10Participants.map((p, index) => (
            <div
              key={index}
              className={twMerge(
                'w-2 h-2 rounded-full hover:cursor-pointer',
                index === currentIndex ? 'bg-black' : 'bg-gray-300'
              )}
              onClick={() => {
                setCurrentIndex(index)
                setSelectedParticipant(top10Participants[index])
              }}
            />
          ))}
        </div>
      </div>
    </Modal>
  )
}

export default ParticipantProfileModal
