export function buildLiveQuizSelectionResponseMetadata({
  answerCollectionEntries,
  solutionIds,
}: {
  answerCollectionEntries?: { id: number }[] | null
  solutionIds?: number[] | null
}) {
  const selectableIds =
    answerCollectionEntries?.map((entry) => entry.id) ?? solutionIds ?? []

  return {
    selectionAnswerIds: JSON.stringify(selectableIds),
    solutions: JSON.stringify(solutionIds),
  }
}
