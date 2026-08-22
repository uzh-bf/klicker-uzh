export function projectDictationDraft(
  capturedDraft: string,
  finalTranscript: string,
  interimTranscript: string
) {
  const transcript = [finalTranscript.trim(), interimTranscript.trim()]
    .filter(Boolean)
    .join(' ')

  if (!transcript) return capturedDraft
  if (!capturedDraft) return transcript
  return /\s$/.test(capturedDraft)
    ? `${capturedDraft}${transcript}`
    : `${capturedDraft} ${transcript}`
}
