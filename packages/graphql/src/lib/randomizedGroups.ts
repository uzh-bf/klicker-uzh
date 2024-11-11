interface RandomGroupAssignmentArgs {
  participantIds: string[]
  preferredGroupSize: number
}

export function splitGroupsRunning({
  participantIds,
  preferredGroupSize,
}: RandomGroupAssignmentArgs) {
  // if more than double the preferred group size is in the pool, start creating groups
  if (participantIds.length >= preferredGroupSize * 2) {
    const participantIdsCopy = [...participantIds]
    const groups: string[][] = []

    while (participantIdsCopy.length >= 2 * preferredGroupSize) {
      const group = participantIdsCopy.splice(0, preferredGroupSize)
      groups.push(group)
    }

    return { groups, remainingParticipantIds: participantIdsCopy }
  }

  return { groups: [], remainingParticipantIds: participantIds }
}

export function splitGroupsFinal({
  participantIds,
  preferredGroupSize,
}: RandomGroupAssignmentArgs) {
  // if only a single participant is left, return null and handle this case on level above
  if (participantIds.length === 1) {
    return []
  }

  // check if groups with the preferred size can be created
  let studentsInPool = participantIds.length
  if (studentsInPool % preferredGroupSize === 0) {
    const groups: string[][] = []
    while (studentsInPool > 0) {
      const group = participantIds.splice(0, preferredGroupSize)
      groups.push(group)
      studentsInPool -= preferredGroupSize
    }

    return groups
  }
  // try to split the participants on different groups as evenly as possible
  else {
    const numOfGroups =
      Math.floor((studentsInPool - 2) / preferredGroupSize) + 1
    const groups: string[][] = Array.from({ length: numOfGroups }, () => [])

    // add the participants to the groups in a round-robin fashion
    let groupIx = 0
    for (const participantId of participantIds) {
      groups[groupIx]!.push(participantId)
      groupIx = (groupIx + 1) % numOfGroups
    }

    return groups
  }
}
