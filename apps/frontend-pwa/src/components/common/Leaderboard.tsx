import React from 'react'
import { twMerge } from 'tailwind-merge'

interface LeaderboardProps {
  className?: string
}

function Leaderboard({ className }: LeaderboardProps): React.ReactElement {
  return <div className={twMerge(className, '')}>Leaderboard</div>
}

export default Leaderboard
