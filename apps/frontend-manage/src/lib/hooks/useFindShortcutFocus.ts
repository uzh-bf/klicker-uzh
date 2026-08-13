import { RefObject, useEffect } from 'react'

function useFindShortcutFocus({
  ref,
}: {
  ref: RefObject<HTMLDivElement | null>
}) {
  // The ref is mutable and the document listener is intentionally installed
  // once; it reads the current search container when the shortcut fires.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mutable ref is intentionally read by a once-installed document listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // listen for Cmd+F (Mac) or Ctrl+F (Windows/Linux)
      const isSearchShortcut =
        (event.metaKey && event.key === 'f') ||
        (event.ctrlKey && event.key === 'f')

      if (isSearchShortcut) {
        event.preventDefault() // prevent browser's native find dialog

        // focus the search input field
        const inputElement = ref.current?.querySelector('input')
        if (inputElement) {
          inputElement.focus()
        }
      }
    }

    // add event listener
    document.addEventListener('keydown', handleKeyDown)

    // cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
}

export default useFindShortcutFocus
