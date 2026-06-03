import React from 'react'
import { twMerge } from 'tailwind-merge'
import type { AdaptiveLevel } from './types'
import { formatTheta, mapLevelsToBands, thetaToPercent } from './utils'

interface LevelBandProps {
  levels: AdaptiveLevel[]
  thetaMin: number
  thetaMax: number
  theta?: number | null
  standardError?: number | null
  showTicks?: boolean
  showLabels?: boolean
  className?: string
}

function LevelBand({
  levels,
  thetaMin,
  thetaMax,
  theta,
  standardError,
  showTicks = true,
  showLabels = true,
  className,
}: LevelBandProps) {
  const bands = mapLevelsToBands(levels, thetaMin, thetaMax)
  const markerPercent =
    theta == null ? null : thetaToPercent(theta, thetaMin, thetaMax)
  const errorStart =
    theta != null && standardError != null
      ? thetaToPercent(theta - standardError, thetaMin, thetaMax)
      : null
  const errorEnd =
    theta != null && standardError != null
      ? thetaToPercent(theta + standardError, thetaMin, thetaMax)
      : null

  return (
    <div className={twMerge('w-full', className)}>
      <div className="relative h-20 px-1 pt-9">
        {errorStart != null && errorEnd != null && (
          <div
            className="absolute top-9 z-10 h-8 rounded bg-slate-900/10"
            style={{
              left: `${errorStart}%`,
              width: `${Math.max(2, errorEnd - errorStart)}%`,
            }}
          />
        )}
        <div className="relative z-20 flex h-8 overflow-hidden rounded-sm">
          {bands.map((band) => (
            <div
              key={band.label}
              className="flex min-w-0 flex-1 items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: band.color.fill }}
              title={band.label}
            >
              {showLabels && (
                <span className="truncate px-1">{band.label}</span>
              )}
            </div>
          ))}
        </div>
        {markerPercent != null && (
          <div
            className="absolute top-1 z-30 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${markerPercent}%` }}
          >
            <div className="border-primary-100 h-4 w-4 rounded-full border-4 bg-white shadow-sm" />
            <div className="h-3.5 w-0.5 bg-slate-900" />
            <div className="h-0 w-0 border-x-[7px] border-t-[10px] border-x-transparent border-t-slate-900" />
          </div>
        )}
      </div>
      {showTicks && (
        <div className="mt-1 flex justify-between text-xs text-slate-400">
          <span>{formatTheta(thetaMin)}</span>
          <span>0</span>
          <span>{formatTheta(thetaMax)}</span>
        </div>
      )}
    </div>
  )
}

export default LevelBand
