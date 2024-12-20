function StackedBarChartLabel({
  value,
  x,
  width,
  y,
  height,
}: {
  value: number
  x: number
  y: number
  width: number
  height: number
}) {
  return (
    <text
      x={x + width / 2}
      y={y + height / 2 + 1}
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
