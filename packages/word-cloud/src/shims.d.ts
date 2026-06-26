declare module 'd3-transition'

declare module 'd3-scale' {
  interface Scale {
    domain: (domain: [number, number]) => Scale
    range: (range: [number, number]) => Scale
    (value: number): number
  }

  export function scaleLinear<T = number, U = number>(): Scale
  export function scaleLog<T = number, U = number>(): Scale
  export function scaleSqrt<T = number, U = number>(): Scale
}

declare module 'd3-selection' {
  export function select(selector: Element | string): any
}
