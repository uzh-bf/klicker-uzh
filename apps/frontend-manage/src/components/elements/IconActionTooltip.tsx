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
        className="bg-slate-700 pointer-events-none invisible absolute right-0 bottom-full z-30 mb-1.5 w-max max-w-64 rounded-md px-2 py-1 text-left text-xs whitespace-normal text-white opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}

export default IconActionTooltip
