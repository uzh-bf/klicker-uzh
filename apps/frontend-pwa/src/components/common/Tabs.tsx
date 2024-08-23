import * as TabsPrimitive from '@radix-ui/react-tabs'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

interface TabProps {
  key: string
  value: string
  label: string
  data?: {
    cy?: string
    test?: string
  }
  className?: string
}

export function Tab({ key, value, label, data, className }: TabProps) {
  return (
    <TabsPrimitive.Trigger
      key={`tab-trigger-${key}`}
      value={value}
      className={twMerge(
        'group',
        'first:rounded-tl-lg last:rounded-tr-lg',
        'border-b border-r last:border-r-0',
        'border-gray-300',
        'rdx-state-active:border-b-slate-600 focus-visible:rdx-state-active:border-b-transparent rdx-state-inactive:bg-gray-50',
        'flex-1 px-3 py-2.5',
        'focus:rdx-state-active:border-b-red',
        'focus:z-10 focus:outline-none focus-visible:ring focus-visible:ring-purple-500 focus-visible:ring-opacity-75',
        className
      )}
      data-cy={data?.cy}
      data-test={data?.test}
    >
      <span className={twMerge('text-sm font-medium', 'text-gray-700')}>
        {label}
      </span>
    </TabsPrimitive.Trigger>
  )
}

interface TabListProps {
  className?: string
}

export function TabList({
  children,
  className,
}: PropsWithChildren<TabListProps>) {
  return (
    <TabsPrimitive.List
      className={twMerge(
        'flex w-full flex-col rounded-t-lg bg-white md:flex-row',
        className
      )}
    >
      {children}
    </TabsPrimitive.List>
  )
}

interface TabContentProps {
  key: string
  value: string
  className?: string
}

export function TabContent({
  key,
  value,
  children,
  className,
}: PropsWithChildren<TabContentProps>) {
  return (
    <TabsPrimitive.Content
      key={`tab-content-${key}`}
      value={value}
      className={twMerge('rounded-t-lg bg-white py-4 md:px-6', className)}
    >
      {children}
    </TabsPrimitive.Content>
  )
}

interface TabsProps {
  defaultValue: string
  value?: string
  onValueChange?: (newValue: string) => void
  className?: string
}

function Tabs({
  defaultValue,
  value,
  children,
  onValueChange,
  className,
}: PropsWithChildren<TabsProps>) {
  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      className={twMerge(className)}
    >
      {children}
    </TabsPrimitive.Root>
  )
}

Tabs.Tab = Tab
Tabs.TabList = TabList
Tabs.TabContent = TabContent

export default Tabs
