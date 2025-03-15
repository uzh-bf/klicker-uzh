import {
  faCheckCircle,
  faChevronCircleRight,
  faChevronDown,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@uzh-bf/design-system/dist/future'
import { twMerge } from 'tailwind-merge'

export type TemplateCollapsibleState = {
  open: boolean
  status: 'due' | 'success' | 'error'
}

export type TemplateCollapsibleUIStates = {
  settings: TemplateCollapsibleState
  [blockIx: number]: {
    [elementIx: number]: TemplateCollapsibleState
  }
}

interface SectionCollapsibleProps {
  title: string
  status: 'due' | 'success' | 'error'
  children: React.ReactNode
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  data?: {
    cy?: string
    test?: string
  }
}

const SectionCollapsible: React.FC<SectionCollapsibleProps> = ({
  title,
  status,
  children,
  isOpen,
  onOpenChange,
  data,
}) => {
  const statusIconMap = {
    due: { icon: faChevronCircleRight, color: 'text-orange-400' },
    success: { icon: faCheckCircle, color: 'text-green-500' },
    error: { icon: faChevronCircleRight, color: 'text-red-600' },
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <CollapsibleTrigger
        className="flex w-full items-center justify-between border-b px-1 py-1.5 transition-colors hover:bg-gray-50"
        data-cy={data?.cy}
        data-test={data?.test}
      >
        <div className="flex items-center gap-3">
          <FontAwesomeIcon
            icon={statusIconMap[status].icon}
            className={twMerge('h-4 w-4', statusIconMap[status].color)}
          />
          <h3 className="text-lg">{title}</h3>
        </div>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={twMerge(
            'h-5 w-5 text-gray-500 transition-transform duration-200',
            isOpen && 'rotate-180 transform'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-b pt-1">
        <div className="px-1 py-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default SectionCollapsible
