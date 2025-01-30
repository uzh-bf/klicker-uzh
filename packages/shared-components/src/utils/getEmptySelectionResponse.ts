import type { SelectionStudentResponseType } from 'src/StudentElement'

function getEmptySelectionResponse({
  numberOfInputs,
}: {
  numberOfInputs?: number | null
}) {
  const initResponses: SelectionStudentResponseType = {}
  for (let i = 0; i < (numberOfInputs ?? 0); i++) {
    initResponses[i] = -1
  }
  return initResponses
}

export default getEmptySelectionResponse
