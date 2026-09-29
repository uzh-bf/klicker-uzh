import {
  createContext,
  type ComponentType,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
} from 'react'

export type AdaptiveManageLayoutProps = {
  children: ReactNode
  displayName?: string
  className?: { root?: string; children?: string }
  data?: { cy?: string; test?: string }
}

export type AdaptivePaginationProps = {
  totalPages: number
  currentPage: number
  setCurrentPage: (page: number) => void
  numOfObjects: number
  pageSize: number
  setPageSize: (value: number) => void
}

export type AdaptiveManageHostPorts = {
  Layout: ComponentType<AdaptiveManageLayoutProps>
  Pagination: ComponentType<AdaptivePaginationProps>
  CreationFormValidator: ComponentType<{
    isValid: boolean
    activeStep: number
    setStepValidity: Dispatch<SetStateAction<boolean[]>>
  }>
  WizardNavigation: ComponentType<{
    editMode: boolean
    isSubmitting: boolean
    stepValidity: boolean[]
    activeStep: number
    lastStep: boolean
    continueDisabled: boolean
    onPrevStep?: () => void
    onCloseWizard: () => void
  }>
}

const context = createContext<AdaptiveManageHostPorts | null>(null)

export function AdaptiveManageHostProvider({
  ports,
  children,
}: {
  ports: AdaptiveManageHostPorts
  children: ReactNode
}) {
  return <context.Provider value={ports}>{children}</context.Provider>
}

export function useAdaptiveManageHost(): AdaptiveManageHostPorts {
  const ports = useContext(context)
  if (!ports) {
    throw new Error('AdaptiveManageHostProvider is required around adaptive UI')
  }
  return ports
}
