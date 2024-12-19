function computeHistogramStatistics(data: number[]) {
  const sorted = [...data].sort((a, b) => a - b)
  const len = sorted.length

  return {
    q1: sorted[Math.floor(len * 0.25)],
    q3: sorted[Math.floor(len * 0.75)],
    median:
      len % 2 === 0
        ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
        : sorted[Math.floor(len / 2)],
    mean: data.reduce((a, b) => a + b, 0) / len,
  }
}

export default computeHistogramStatistics
