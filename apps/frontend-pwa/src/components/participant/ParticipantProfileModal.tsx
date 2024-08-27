import { useQuery } from '@apollo/client'
import { GetPublicParticipantProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
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
      open={isProfileModalOpen}
      onClose={closeProfileModal}
      className={{
        content: 'my-auto h-max max-h-full w-[500px] overflow-auto',
        title: 'text-3xl',
        onNext: 'hidden md:block',
        onPrev: 'hidden md:block',
      }}
      onNext={onNext}
      onPrev={onPrev}
      title="Top 10"
    >
      {loading || !participant ? (
        <Loader />
      ) : (
        <div className="px-auto flex h-full w-full flex-col items-center justify-between">
          <ProfileData
            level={participant.levelData}
            xp={participant.xp}
            avatar={participant.avatar}
            username={participant.username}
            achievements={participant.achievements}
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
