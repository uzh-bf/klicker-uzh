export type WordCloudScale = 'linear' | 'log' | 'sqrt'

export type WordCloudSpiral = 'archimedean'

export interface WordCloudWord {
  text: string
  value: number
  [key: string]: unknown
}

export interface FontDescriptor {
  size: number
  family: string
  style: string
  weight: string | number
  rotate: number
}

export interface MeasuredWord {
  width: number
  height: number
}

export interface ComputeWordCloudLayoutOptions {
  width: number
  height: number
  minFontSize?: number
  maxFontSize?: number
  scale?: WordCloudScale
  spiral?: WordCloudSpiral
  padding?: number
  rotationAngles?: [number, number]
  rotations?: number
  deterministic?: boolean
  seed?: string
  fontFamily?: string
  fontStyle?: string
  fontWeight?: string | number
  shrinkFactor?: number
  maxRelayouts?: number
  maxAttemptsPerWord?: number
  measureText?: (text: string, font: FontDescriptor) => MeasuredWord
}

export interface LayoutWord extends WordCloudWord {
  index: number
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  rotate: number
  padding: number
}

export interface LayoutSettings {
  minFontSize: number
  maxFontSize: number
  scale: WordCloudScale
  spiral: WordCloudSpiral
  padding: number
  rotationAngles: [number, number]
  rotations: number
  deterministic: boolean
  seed: string
  fontFamily: string
  fontStyle: string
  fontWeight: string | number
  shrinkFactor: number
  maxRelayouts: number
  maxAttemptsPerWord: number
}

export interface LayoutResult {
  width: number
  height: number
  inputCount: number
  placed: LayoutWord[]
  omitted: WordCloudWord[]
  relayoutCount: number
  settings: LayoutSettings
}

export interface RenderWordCloudOptions {
  colors?: string[]
  transitionDuration?: number
  fontFamily?: string
  fontStyle?: string
  fontWeight?: string | number
  getWordTooltip?: (word: LayoutWord) => Node
  tooltipOffset?: number
  onWordClick?: (word: LayoutWord, event: MouseEvent) => void
  onWordMouseOver?: (word: LayoutWord, event: MouseEvent) => void
  onWordMouseOut?: (word: LayoutWord, event: MouseEvent) => void
}

export interface RendererHandle {
  update: (
    nextLayoutResult: LayoutResult,
    nextRenderOptions?: RenderWordCloudOptions
  ) => void
  destroy: () => void
  getLayout: () => LayoutResult
}
