import {
  createContext,
  type ComponentType,
  type ReactNode,
  useContext,
} from 'react'

export type AdaptivePwaHostPorts = {
  PreviewMessage: ComponentType<{
    activityType: string
    name: string
    displayName: string
    className?: string
  }>
  scrollContainerId: string
}

const context = createContext<AdaptivePwaHostPorts | null>(null)

export function AdaptivePwaHostProvider({
  ports,
  children,
}: {
  ports: AdaptivePwaHostPorts
  children: ReactNode
}) {
  return <context.Provider value={ports}>{children}</context.Provider>
}

export function useAdaptivePwaHost(): AdaptivePwaHostPorts {
  const ports = useContext(context)
  if (!ports)
    throw new Error('AdaptivePwaHostProvider is required around adaptive UI')
  return ports
}
