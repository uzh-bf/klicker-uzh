export function projectDictationDraft(
  capturedDraft: string,
  finalTranscript: string,
  interimTranscript: string
) {
  return [
    capturedDraft.trim(),
    finalTranscript.trim(),
    interimTranscript.trim(),
  ]
    .filter(Boolean)
    .join(' ')
}
