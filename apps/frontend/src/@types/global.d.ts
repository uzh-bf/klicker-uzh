declare module '*.graphql' {
  import { DocumentNode } from 'graphql'

  const value: DocumentNode
  export = value
}

declare interface Window {
  ReactIntlLocaleData: any
  __NEXT_DATA__: any
  INIT_GA?: any
  INIT?: boolean
  INIT_LR?: boolean
  requestIdleCallback: any
  gtag: any
}
