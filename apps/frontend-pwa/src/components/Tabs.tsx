import * as TabsPrimitive from '@radix-ui/react-tabs'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

interface TabProps {
  key: string
  value: string
  label: string
}

export function Tab({ key, value, label }: TabProps) {
  return (
    <TabsPrimitive.Trigger
      key={`tab-trigger-${key}`}
      value={value}
      className={twMerge(
        'group',
        'first:rounded-tl-lg last:rounded-tr-lg',
        'border-b first:border-r last:border-l',
        'border-gray-300',
        'rdx-state-active:border-b-gray-500 focus-visible:rdx-state-active:border-b-transparent rdx-state-inactive:bg-gray-50',
        'flex-1 px-3 py-2.5',
        'focus:rdx-state-active:border-b-red',
        'focus:z-10 focus:outline-none focus-visible:ring focus-visible:ring-purple-500 focus-visible:ring-opacity-75'
      )}
    >
      <span className={twMerge('text-sm font-medium', 'text-gray-700')}>
        {label}
      </span>
    </TabsPrimitive.Trigger>
  )
}

export function TabList({ children }: PropsWithChildren) {
  return (
    <TabsPrimitive.List
      className={twMerge('flex w-full rounded-t-lg bg-white')}
    >
      {children}
    </TabsPrimitive.List>
  )
}

interface TabContentProps {
  key: string
  value: string
}

export function TabContent({
  key,
  value,
  children,
}: PropsWithChildren<TabContentProps>) {
  return (
    <TabsPrimitive.Content
      key={`tab-content-${key}`}
      value={value}
      className={twMerge('rounded-t-lg bg-white px-6 py-4')}
    >
      {children}
    </TabsPrimitive.Content>
  )
}

interface TabsProps {
  defaultValue: string
  value?: string
  onValueChange?: (newValue: string) => void
}

function Tabs({
  defaultValue,
  value,
  children,
  onValueChange,
}: PropsWithChildren<TabsProps>) {
  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
    >
      {children}
    </TabsPrimitive.Root>
  )
}

Tabs.Tab = Tab
Tabs.TabList = TabList
Tabs.TabContent = TabContent

export default Tabs
