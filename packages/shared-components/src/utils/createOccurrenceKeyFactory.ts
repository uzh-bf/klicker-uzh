function createOccurrenceKeyFactory() {
  const occurrences = new Map<string, number>()

  return (signature: string) => {
    const occurrence = occurrences.get(signature) ?? 0
    occurrences.set(signature, occurrence + 1)
    return `${signature}-${occurrence}`
  }
}

export default createOccurrenceKeyFactory
