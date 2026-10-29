import { twMerge } from 'tailwind-merge'

function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={twMerge(
        'animate-ctrl-live-dot bg-uzh-red inline-block h-[7px] w-[7px] shrink-0 rounded-full',
        className
      )}
    />
  )
}

export default LiveDot
