import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

function FilterListEntry({
  trigger,
  value,
  active = false,
  appliedLabel,
  data,
  children,
}: {
  trigger: string
  value: string
  active?: boolean
  appliedLabel?: string
  data?: { cy?: string; test?: string }
  children: React.ReactNode
}) {
  return (
    <AccordionItem value={value} className="border-b-0">
      <AccordionTrigger
        className={twMerge(
          'border-border mb-1 mt-0.5 flex w-full border-b border-solid px-2 py-0.5 text-sm text-neutral-500 hover:text-black hover:no-underline',
          active && 'text-primary-100 hover:text-primary-100 font-bold'
        )}
        data-cy={data?.cy}
      >
        {active && appliedLabel ? (
          <span className="flex w-full flex-row items-center justify-between gap-2">
            <span>{trigger}</span>
            <span
              data-cy={data?.cy ? `${data.cy}-applied` : undefined}
              className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-white"
            >
              {appliedLabel}
            </span>
          </span>
        ) : (
          trigger
        )}
      </AccordionTrigger>
      <AccordionContent className="pb-2">
        <ul className="list-none">{children}</ul>
      </AccordionContent>
    </AccordionItem>
  )
}

export default FilterListEntry
