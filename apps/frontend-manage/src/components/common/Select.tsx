import {
  faCheck,
  faChevronDown,
  faChevronUp,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Button } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

// TODO Attention: scrolling does not work because apparently overflow is set to "hidden" on the body

export interface Item {
  value: string
  disabled?: boolean // disabled React select
  label: string // displayed name
}

export interface SelectProps {
  items: Item[]
  disabled?: boolean
  className?: string
  triggerStyle?: string
  itemStyle?: string
  size?: 'md' | 'sm'
  onChange: (newValue: string) => void
  defaultValue?: string
}
export function Select({
  items,
  disabled,
  className,
  triggerStyle,
  itemStyle,
  size,
  onChange,
  defaultValue,
}: SelectProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex">
      <SelectPrimitive.Root
        defaultValue={defaultValue ? defaultValue : items[0].value}
        onValueChange={onChange}
        onOpenChange={(open) => setOpen(open)}
      >
        <SelectPrimitive.Trigger asChild className={triggerStyle}>
          <Button disabled={disabled}>
            <SelectPrimitive.Value />
            <SelectPrimitive.Icon
              className={twMerge('ml-2', size === 'sm' && 'ml-0.5')}
            >
              <FontAwesomeIcon
                icon={open ? faChevronUp : faChevronDown}
                size={size === 'sm' ? 'sm' : '1x'}
              />
            </SelectPrimitive.Icon>
          </Button>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Content>
          <SelectPrimitive.ScrollUpButton className="flex items-center justify-center text-gray-700 dark:text-gray-300">
            <FontAwesomeIcon
              icon={faChevronUp}
              size={size === 'sm' ? 'sm' : '1x'}
            />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport
            className={twMerge(
              'p-1 bg-white rounded-lg shadow-lg dark:bg-gray-800 z-[9999]',
              className
            )}
          >
            <SelectPrimitive.Group>
              {items.map((item, ix) => (
                <SelectPrimitive.Item
                  disabled={item.disabled}
                  key={ix}
                  value={item.value}
                  className={twMerge(
                    'relative flex items-center px-8 py-2 rounded-md text-gray-700 dark:text-gray-300 font-medium focus:bg-gray-100 dark:focus:bg-gray-900',
                    'rdx-disabled:opacity-50 focus:outline-none select-none',
                    size === 'sm' && 'px-7'
                  )}
                >
                  <SelectPrimitive.ItemText>
                    <div
                      className={twMerge(itemStyle, size === 'sm' && 'text-sm')}
                    >
                      {item.label}
                    </div>
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute inline-flex items-center left-2">
                    <FontAwesomeIcon
                      icon={faCheck}
                      size={size === 'sm' ? 'sm' : '1x'}
                    />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Group>
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex items-center justify-center text-gray-700 dark:text-gray-300">
            <FontAwesomeIcon
              icon={faChevronDown}
              size={size === 'sm' ? 'sm' : '1x'}
            />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Root>
    </div>
  )
}

export default Select
