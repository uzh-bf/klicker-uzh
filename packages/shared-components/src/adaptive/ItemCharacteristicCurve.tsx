import React from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface ItemCharacteristicCurveProps {
  discrimination: number
  difficulty: number
  guessing: number
  thetaMin?: number
  thetaMax?: number
}

function probability(theta: number, a: number, b: number, c: number) {
  const logistic = 1 / (1 + Math.exp(-a * (theta - b)))
  return c + (1 - c) * logistic
}

function information(theta: number, a: number, b: number, c: number) {
  const p = probability(theta, a, b, c)
  const q = 1 - p
  const numerator = Math.pow(a, 2) * q * Math.pow(p - c, 2)
  const denominator = Math.max(Math.pow(1 - c, 2) * p, 1e-9)
  return Math.max(0, numerator / denominator)
}

function ItemCharacteristicCurve({
  discrimination,
  difficulty,
  guessing,
  thetaMin = -4,
  thetaMax = 4,
}: ItemCharacteristicCurveProps) {
  const data = Array.from({ length: 81 }, (_, index) => {
    const theta = thetaMin + ((thetaMax - thetaMin) * index) / 80
    return {
      theta: Number(theta.toFixed(2)),
      probability: probability(theta, discrimination, difficulty, guessing),
      information: information(theta, discrimination, difficulty, guessing),
    }
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{ top: 16, right: 20, bottom: 16, left: 0 }}
      >
        <CartesianGrid vertical={false} stroke="#edf0f2" />
        <XAxis dataKey="theta" type="number" domain={[thetaMin, thetaMax]} />
        <YAxis yAxisId="probability" domain={[0, 1]} />
        <YAxis yAxisId="information" orientation="right" hide />
        <Tooltip
          formatter={(value, name) => [
            Number(value).toFixed(2),
            name === 'probability' ? 'P(correct)' : 'Information',
          ]}
          labelFormatter={(label) => `theta ${label}`}
          contentStyle={{ borderRadius: 8, borderColor: '#e5e7eb' }}
        />
        <ReferenceLine x={difficulty} stroke="#99a9db" strokeDasharray="4 4" />
        <ReferenceLine
          yAxisId="probability"
          y={guessing}
          stroke="#dc6027"
          strokeDasharray="4 4"
        />
        <Line
          yAxisId="probability"
          type="monotone"
          dataKey="probability"
          stroke="#0028a5"
          strokeWidth={3}
          dot={false}
        />
        <Line
          yAxisId="information"
          type="monotone"
          dataKey="information"
          stroke="#dc6027"
          strokeWidth={2}
          strokeDasharray="3 3"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default ItemCharacteristicCurve
