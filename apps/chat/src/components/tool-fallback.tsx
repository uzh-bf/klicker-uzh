import { ToolCallContentPartComponent } from '@assistant-ui/react'
import { Button } from '@uzh-bf/design-system'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useState } from 'react'

export const ToolFallback: ToolCallContentPartComponent = ({
  toolName,
  argsText,
  result,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true)
  return (
    <div className="mb-4 flex w-full flex-col gap-3 rounded-lg border py-1">
      <div className="flex items-center gap-2 px-4">
        <CheckIcon className="size-4" />
        <p className="">
          Used <b>{toolName}</b>
        </p>
        <div className="flex-grow" />
        <Button basic onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </Button>
      </div>
      {!isCollapsed && (
        <div className="flex flex-col gap-2 border-t pt-2">
          <div className="px-4">
            <div className="font-semibold">Input:</div>
            <div className="whitespace-pre-wrap text-xs">{argsText}</div>
          </div>
          {result !== undefined && (
            <div className="border-t border-dashed px-4 pt-2">
              <div className="font-semibold">Output:</div>
              <div className="whitespace-pre-wrap text-xs">
                {typeof result === 'string'
                  ? result
                  : JSON.stringify(result, null, 2)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
