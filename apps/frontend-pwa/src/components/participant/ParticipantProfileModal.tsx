import { useQuery } from '@apollo/client'
import {
  faShieldHeart,
  faStar,
  faTrophy,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetParticipantDetailsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Label, Modal } from '@uzh-bf/design-system'
import Image from 'next/image'

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
  const { data, loading } = useQuery(GetParticipantDetailsDocument, {
    variables: { id: participantId },
  })

  if (loading || !data?.participantDetails) return <div>loading...</div>

  console.log('participantId: ', participantId)
  console.log('top10Participants: ', top10Participants)

  const { participant, achievements } = data.participantDetails
  console.log('participant: ', participant)
  console.log('achievements: ', achievements)

  return (
    <Modal
      open={isProfileModalOpen}
      onClose={closeProfileModal}
      className={{
        content: 'flex flex-col items-center',
      }}
    >
      <div className="flex flex-col w-[400px] border rounded-md shadow-md p-5">
        <div className="flex justify-center w-full pb-3">
          <Image
            src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${
              participant.avatar ?? 'placeholder'
            }.svg`}
            alt=""
            width="120"
            height="120"
            className="bg-white rounded-full"
          />
        </div>
        <Label
          label={participant.username}
          className={{ root: 'text-xl font-bold pb-4 w-full justify-center' }}
        />
        <div className="flex flex-col w-full">
          <div className="flex flex-row justify-between">
            <div className="flex flex-row">
              <FontAwesomeIcon icon={faTrophy} className="pr-2" />
              <Label
                label={`Level: ${participant.level}`}
                className={{ root: 'font-bold text-sm' }}
              />
            </div>
            <div className="flex flex-row">
              <FontAwesomeIcon icon={faStar} className="pr-2" />
              <Label
                label={`Erfahrungspunkte: ${participant.xp}`}
                className={{ root: 'font-bold text-sm' }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col w-full mt-5">
          <div className="flex flex-row">
            <FontAwesomeIcon icon={faShieldHeart} className="pr-2" />
            <Label
              label="Errungenschaften"
              className={{ root: 'font-bold text-sm' }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 pb-3 justify-items-center">
            {achievements.map((achievement, index) => (
              <div
                key={index}
                className="flex flex-col items-center p-2 place-content-between"
              >
                <Image
                  src={achievement.icon}
                  alt=""
                  width="50"
                  height="50"
                  className="bg-white rounded-full"
                />
                <Label
                  label={achievement.name}
                  tooltip={achievement.description}
                  showTooltipSymbol
                  className={{ root: 'text-center pt-2 text-xs font-bold' }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ParticipantProfileModal
