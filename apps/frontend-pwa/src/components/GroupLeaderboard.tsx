import { ParticipantOther, ParticipantSelf } from './Participant'

function GroupLeaderboard({ leaderboard, courseId, groupId, onLeave }) {
  return (
    <div className="pt-8 space-y-2">
      {leaderboard.flatMap((entry) => {
        if (entry.isSelf) {
          return (
            <ParticipantSelf
              key={entry.id}
              isActive
              pseudonym={entry.username}
              avatar={entry.avatar ?? 'placeholder'}
              points={entry.score}
              onLeaveCourse={onLeave}
            />
          )
        }

        return (
          <ParticipantOther
            key={entry.id}
            pseudonym={entry.username}
            avatar={entry.avatar ?? 'placeholder'}
            points={entry.score}
          />
        )
      })}
    </div>
  )
}

export default GroupLeaderboard
