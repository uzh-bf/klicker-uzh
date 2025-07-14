import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@uzh-bf/design-system'
import React, { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

function ContentCollapsible({
  staticContent,
  children,
  maxExpandedHeight,
}: {
  staticContent?: React.ReactNode
  children: React.ReactNode
  maxExpandedHeight?: string
}) {
  const [contentElem, setContentElem] = useState<HTMLDivElement | null>(null)
  const [contentCollapsed, setContentCollapsed] = useState<boolean>(true)
  const [showExtensibleButton, setShowExtensibleButton] =
    useState<boolean>(false)

  useEffect(() => {
    if (!contentElem) return

    // if the element height is larger than what is shown or the content was opened, show the extension button
    if (
      contentElem?.scrollHeight > contentElem?.clientHeight ||
      !contentCollapsed
    ) {
      setShowExtensibleButton(true)
    } else {
      setShowExtensibleButton(false)
    }

    return () => setContentElem(null)
  }, [contentCollapsed, contentElem])

  return (
    <div>
      {staticContent}
      <div
        ref={(ref) => setContentElem(ref)}
        className={twMerge(
          contentCollapsed
            ? 'max-h-28'
            : twMerge(
                maxExpandedHeight ?? 'max-h-[calc(100vh-10.8rem)]',
                'overflow-auto'
              ),
          showExtensibleButton &&
            contentCollapsed &&
            'bg-linear-to-b overflow-y-hidden from-black via-black to-white bg-clip-text',
          !showExtensibleButton && 'border-uzh-grey-80 border-b',
          'w-full px-4'
        )}
      >
        {children}
      </div>

      {showExtensibleButton && (
        <Button
          className={{
            root: twMerge(
              'border-uzh-grey-80 h-6 w-full rounded-none border-0 border-b text-xs shadow-none print:hidden',
              contentCollapsed && 'bg-linear-to-b from-white to-slate-100'
            ),
          }}
          onClick={() => setContentCollapsed(!contentCollapsed)}
          data={{ cy: 'toggle-content-collapsible' }}
        >
          <Button.Icon
            withoutLabel
            icon={contentCollapsed ? faChevronDown : faChevronUp}
            className={{
              root: 'h-5 w-5',
            }}
          />
        </Button>
      )}
    </div>
  )
}

export default ContentCollapsible
