function completeSelectionResponse({
  existingResponse,
  emptyResponses,
}: {
  existingResponse?: Record<number, number>
  emptyResponses: Record<number, number>
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
