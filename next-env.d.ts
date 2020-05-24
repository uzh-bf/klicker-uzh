/* eslint-disable */
/// <reference types="next" />
/// <reference types="next/types/global" />

declare module '*.graphql' {
  import { DocumentNode } from 'graphql'

  const value: DocumentNode
  export = value
}

declare interface Window {
  ReactIntlLocaleData: any
  __NEXT_DATA__: any
  INIT_GA: any
}
