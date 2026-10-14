import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@uzh-bf/design-system'

interface ResponsiveSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  actions: React.ReactNode
  dataCy?: string
}

// Bottom sheet on phones, centred dialog (max 520px) from 720px.
function ResponsiveSheet({
  open,
  onClose,
  title,
  children,
  actions,
  dataCy,
}: ResponsiveSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="bottom"
        data-cy={dataCy}
        className="border-ctrl-border max-h-[88%] gap-0 rounded-t-xl border bg-white font-sans min-[720px]:inset-x-auto min-[720px]:top-1/2 min-[720px]:bottom-auto min-[720px]:left-1/2 min-[720px]:w-[calc(100%-48px)] min-[720px]:max-w-[520px] min-[720px]:-translate-x-1/2 min-[720px]:-translate-y-1/2 min-[720px]:rounded-xl"
      >
        <div className="bg-ctrl-border mx-auto mt-2 h-1 w-9 rounded-full min-[720px]:hidden" />
        <div className="px-5 pt-4">
          <SheetTitle className="text-ctrl-ink text-xl font-bold">
            {title}
          </SheetTitle>
        </div>
        <SheetDescription asChild>
          <div className="text-ctrl-ink-2 overflow-auto px-5 py-3 text-[15px] leading-normal">
            {children}
          </div>
        </SheetDescription>
        <div className="border-ctrl-hair flex gap-2 border-t px-5 pt-3 pb-[calc(1.25rem_+_env(safe-area-inset-bottom))]">
          {actions}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default ResponsiveSheet
