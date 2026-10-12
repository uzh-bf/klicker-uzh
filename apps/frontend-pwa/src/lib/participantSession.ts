export function isSuccessfulParticipantSessionResult(result: {
  data?: Record<string, unknown> | null
  errors?: readonly unknown[]
}) {
  if (result.errors?.length || !result.data) return false
  const data = result.data
  return (
    !!(
      data.createParticipantAccount &&
      typeof data.createParticipantAccount === 'object' &&
      'participantToken' in data.createParticipantAccount &&
      data.createParticipantAccount.participantToken
    ) ||
    data.deleteParticipantAccount === true ||
    data.logoutTemporaryParticipant === true ||
    [
      'logoutParticipant',
      'loginParticipant',
      'loginTemporaryParticipant',
      'loginParticipantMagicLink',
      'activateParticipantAccount',
    ].some((field) => typeof data[field] === 'string' && !!data[field])
  )
}
