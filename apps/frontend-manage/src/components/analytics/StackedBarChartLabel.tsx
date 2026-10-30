function StackedBarChartLabel({
  value,
  x,
  width,
  y,
  height,
}: {
  value: number
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
}) {
  const labelX = Number(x)
  const labelY = Number(y)
  const labelWidth = Number(width)
  const labelHeight = Number(height)
  if (![labelX, labelY, labelWidth, labelHeight].every(Number.isFinite)) {
    return null
  }

  return (
    <text
      x={labelX + labelWidth / 2}
      y={labelY + labelHeight / 2 + 1}
      fill="white"
      fontSize={14}
      textAnchor="middle"
      dominantBaseline="middle"
      className="font-bold"
    >
      {value} %
    </text>
  )
}

export default StackedBarChartLabel
