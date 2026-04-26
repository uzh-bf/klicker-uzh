declare module '@uzh-bf/design-system' {
  import type {
    ButtonHTMLAttributes,
    CSSProperties,
    ReactElement,
    ReactNode,
  } from 'react'

  export interface ButtonClassNames {
    root?: string
    label?: string
    icon?: string
  }

  export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children?: ReactNode
    className?: ButtonClassNames
    data?: {
      cy?: string
      test?: string
    }
    style?: CSSProperties
  }

  export function Button(props: ButtonProps): ReactElement
}
