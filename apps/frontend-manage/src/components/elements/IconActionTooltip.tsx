import type React from 'react'

interface IconActionTooltipProps {
  label: string
  children: React.ReactNode
}

// The design-system Tooltip renders its own trigger button, so it cannot wrap
// an existing interactive control without nesting buttons. This presentational
// wrapper keeps exactly one interactive child and discloses a non-interactive
// tooltip on hover and on focus-within instead.
function IconActionTooltip({
  label,
  children,
}: IconActionTooltipProps): React.ReactElement {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="bg-slate-700 pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-xs text-white opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}

export default IconActionTooltip
