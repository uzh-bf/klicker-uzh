import { Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { trpc } from '../../lib/trpc'
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
  const t = useTranslations()
  const [selectedParticipant, setSelectedParticipant] =
    useState<string>(participantId)
  const [currentIndex, setCurrentIndex] = useState<number>(
    top10Participants.indexOf(participantId)
  )
  const { data, error, isLoading } = trpc.participant.publicProfile.useQuery(
    { participantId: selectedParticipant },
    { enabled: Boolean(selectedParticipant) }
  )

  const participant = data?.publicParticipantProfile
  const initialLoading = isLoading && !participant
  const profileUnavailable = Boolean((error || !isLoading) && !participant)

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
      loading={initialLoading}
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
      {profileUnavailable ? (
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      ) : null}

      {participant ? (
        <div className="px-auto flex h-full w-full flex-col items-center justify-between">
          <ProfileData
            level={participant.levelData}
            xp={participant.xp ?? 0}
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
      ) : null}
    </Modal>
  )
}

export default ParticipantProfileModal
