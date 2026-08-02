import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { type ReactNode, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface ResponsiveDiscussionRailProps {
  ariaLabel: string
  mobileLabel: string
  panelId: string
  dataCy: string
  toggleDataCy: string
  className?: string
  children: ReactNode
}

function ResponsiveDiscussionRail({
  ariaLabel,
  mobileLabel,
  panelId,
  dataCy,
  toggleDataCy,
  className,
  children,
}: ResponsiveDiscussionRailProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <aside
      aria-label={ariaLabel}
      className={twMerge('min-w-0', className)}
      data-cy={dataCy}
    >
      <button
        type="button"
        onClick={() => setMobileOpen((open) => !open)}
        aria-expanded={mobileOpen}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-sm py-2 text-left text-sm font-semibold text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 lg:hidden"
        data-cy={toggleDataCy}
      >
        <span>{mobileLabel}</span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={twMerge(
            'shrink-0 text-gray-500 motion-safe:transition-transform',
            mobileOpen && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>
      <div
        id={panelId}
        className={twMerge(
          'mt-4 hidden',
          mobileOpen && 'block',
          'lg:sticky lg:top-4 lg:mt-0 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto'
        )}
      >
        {children}
      </div>
    </aside>
  )
}

export default ResponsiveDiscussionRail
