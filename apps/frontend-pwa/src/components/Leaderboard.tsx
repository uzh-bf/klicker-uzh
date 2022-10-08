import { any } from 'ramda'
import { ParticipantOther, ParticipantSelf } from './Participant'

function Leaderboard({
  courseId,
  leaderboard,
  participation,
  participant,
  onJoin,
  onLeave,
}) {
  const isSelfContained = any(
    (item) => item.participantId === participant?.id,
    leaderboard
  )

  return (
    <div className="pt-8 space-y-2">
      {leaderboard?.flatMap((entry) => {
        if (entry.isSelf) {
          return (
            <ParticipantSelf
              key={entry.id}
              isActive={participation?.isActive ?? false}
              pseudonym={entry.username}
              avatar={entry.avatar ?? 'placeholder'}
              points={entry.score}
              rank={entry.rank}
              onJoinCourse={onJoin}
              onLeaveCourse={onLeave}
            />
          )
        }

        return (
          <ParticipantOther
            key={entry.id}
            pseudonym={entry.username}
            avatar={entry.avatar ?? 'placeholder'}
            rank={entry.rank}
            points={entry.score}
          />
        )
      })}

      {(!participation?.isActive || !isSelfContained) && (
        <ParticipantSelf
          key={participant?.id}
          isActive={participation.isActive}
          pseudonym={participant?.username}
          avatar={participant?.avatar ?? 'placeholder'}
          points={null}
          onJoinCourse={onJoin}
          onLeaveCourse={onLeave}
        />
      )}
    </div>
  )
}

export default Leaderboard
