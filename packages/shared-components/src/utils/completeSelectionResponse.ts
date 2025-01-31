import type { SelectionStudentResponseType } from '../StudentElement'

function completeSelectionResponse({
  existingResponse,
  emptyResponses,
}: {
  existingResponse?: SelectionStudentResponseType
  emptyResponses: SelectionStudentResponseType
}) {
  if (!existingResponse) {
    return undefined
  }

  const completedResponse = { ...emptyResponses }
  Object.keys(existingResponse).forEach((key) => {
    completedResponse[parseInt(key)] = existingResponse[parseInt(key)] ?? -1
  })

  return completedResponse
}

export default completeSelectionResponse
