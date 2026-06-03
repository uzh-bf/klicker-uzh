import React from 'react'
import type { AdaptiveDistributionBin } from './types'
import { getLevelColor } from './utils'

interface AbilityHistogramProps {
  bins: AdaptiveDistributionBin[]
}

function AbilityHistogram({ bins }: AbilityHistogramProps) {
  const maxCount = Math.max(1, ...bins.map((bin) => bin.count))

  return (
    <div className="h-80 w-full">
      <div
        className="grid h-64 items-end gap-2 border-b border-slate-200 px-1"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, bins.length)}, minmax(0, 1fr))`,
        }}
      >
        {bins.map((bin, index) => {
          const color = getLevelColor(bin.levelLabel, index)
          const height = (bin.count / maxCount) * 100

          return (
            <div
              key={`${bin.levelLabel}-${index}`}
              className="flex h-full min-w-0 flex-col justify-end"
              title={`${bin.levelLabel}: ${bin.count} students`}
            >
              <div className="mb-2 text-center text-xs font-semibold text-slate-500">
                {bin.count > 0 ? bin.count : ''}
              </div>
              <div
                className="w-full rounded-t"
                style={{
                  backgroundColor: color.fill,
                  height: bin.count > 0 ? `${Math.max(4, height)}%` : 0,
                }}
              />
            </div>
          )
        })}
      </div>
      <div
        className="mt-3 grid gap-2 px-1 text-center text-xs font-semibold text-slate-500"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, bins.length)}, minmax(0, 1fr))`,
        }}
      >
        {bins.map((bin, index) => (
          <div key={`${bin.levelLabel}-label-${index}`} className="truncate">
            {bin.levelLabel}
          </div>
        ))}
      </div>
    </div>
  )
}

export default AbilityHistogram
