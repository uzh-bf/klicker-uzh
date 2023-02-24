import { useQuery } from '@apollo/client'
import { GetParticipantDetailsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useState } from 'react'
import ProfileData from './ProfileData'

interface ParticipantProfileModalProps {
  isProfileModalOpen: boolean
  closeProfileModal: () => void
  participantId: string
  top10Participants: string[]
}

// TODO: think about smart appraoch to allow scrolling between participants on mobile (currently hidden)
//TODO: compare participant's achievements with all possible achievements and grey out the ones that are not achieved yet
//TODO: bugfix - the modal opens when clicking on 'Austreten'
//TODO: Make profile visible after leaving the leaderboard
//TODO: handle overflow in achivevements container in case there are more achievements than the current ones (=5)
//TODO: fix modal for group leader board
//TODO: make modal responsive for mobile apps
//TODO: optional - implement new design for the carousel (e.g. 3D carousel where you can see the next and previous participant in the background)
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

  const { participant, achievements } = data.participantDetails

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
        content: 'w-[500px] h-[700px]',
        title: 'text-3xl',
        onNext: 'hidden md:block',
        onPrev: 'hidden md:block',
      }}
      onNext={onNext}
      onPrev={onPrev}
      title="Top 10"
    >
      <div className="items-center w-full px-auto">
        <div className="mx-auto w-max">
          <ProfileData
            level={participant.levelData}
            xp={participant.xp}
            avatar={participant.avatar}
            username={participant.username}
            achievements={participant.achievements}
          />
        </div>
        <div className="hidden grid-cols-10 pt-5 justify-items-center md:grid">
          {top10Participants.map((p, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full ${
                index === currentIndex ? 'bg-black' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </Modal>
  )
}

export default ParticipantProfileModal
