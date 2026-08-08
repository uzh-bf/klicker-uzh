/**
 * Shared styling for icon buttons in the message action bars
 * (copy, reload, edit, rate, branch navigation). It lived inline in seven
 * places, which is how the reskin left some of them behind on the old palette.
 */
export const actionBarButtonClassName =
  'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex size-11 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 fine-pointer:size-8'
