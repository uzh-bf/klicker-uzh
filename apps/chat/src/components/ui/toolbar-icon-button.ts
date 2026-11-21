/**
 * Shared styling for the icon buttons in the chat's chrome: header, sidebar
 * header, floating framed controls and the embedded toolbar (new chat, sidebar
 * toggle, fullscreen, knowledge graph, close). One square ghost button keeps
 * these controls visually identical wherever they appear. Touch keeps the
 * 44px target; mouse users get the compact 32px size.
 *
 * Message action bars use `actionBarButtonClassName`, and the composer keeps
 * its round attach and send buttons.
 */
export const toolbarIconButtonClassName =
  'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex size-11 shrink-0 items-center justify-center rounded-md transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 fine-pointer:size-8 [&_svg]:size-4'
