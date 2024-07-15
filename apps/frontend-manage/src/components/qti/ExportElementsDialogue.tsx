import { Element } from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import exportToQTI from './exportToQTI'

interface ExportElementsDialogueProps {
  elements: (Element | undefined)[]
  open: boolean
  setOpen: (open: boolean) => void
}

function ExportElementsDialogue({
  elements,
  open,
  setOpen,
}: ExportElementsDialogueProps): React.ReactElement {
  const t = useTranslations()
  const filteredElements = useMemo(
    () => elements.filter((element) => element !== undefined),
    [elements]
  )

  // TODO: translate, style, etc. and text where export is explained
  return (
    <Modal
      open={open}
      onOpenChange={() => setOpen(!open)}
      onClose={() => setOpen(false)}
      className={{
        content: 'w-[40rem] min-h-max h-max self-center !py-0',
      }}
      hideCloseButton
    >
      <H2>QTI Element Export</H2>
      <div>EXPLAIN HOW EXPORT QTI STUFF WORKS</div>
      <div className="border border-solid border-gray-300 rounded-md mt-2 mb-3 max-h-96 overflow-y-scroll">
        {filteredElements.map((element, index) => (
          <div
            key={index}
            className={twMerge(
              'p-1 w-full bg-white first:rounded-t-md last:rounded-b-md',
              index % 2 === 0 && 'bg-gray-100'
            )}
          >
            {element?.name}
          </div>
        ))}
      </div>

      <div className="flex flex-row items-center justify-between">
        <Button onClick={() => setOpen(false)}>
          {t('shared.generic.close')}
        </Button>
        <Button
          className={{ root: 'bg-primary-80 text-white' }}
          onClick={() => exportToQTI(filteredElements)}
        >
          Export
        </Button>
      </div>
    </Modal>
  )
}

export default ExportElementsDialogue
