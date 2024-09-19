export interface TextSizeType {
  size: string
  text: string
  prose: string
  textLg: string
  textXl: string
  text2Xl: string
  text3Xl: string
  legend: string
  min: number
  max: number
}

export const TextSizes = {
  xl: {
    size: 'xl',
    text: 'text-xl',
    prose: 'prose-2xl',
    textLg: 'text-2xl',
    textXl: 'text-3xl',
    text2Xl: 'text-4xl',
    text3Xl: 'text-5xl',
    legend: '3rem',
    min: 60,
    max: 80,
  },
  lg: {
    size: 'lg',
    text: 'text-lg',
    prose: 'prose-xl',
    textLg: 'text-xl',
    textXl: 'text-2xl',
    text2Xl: 'text-3xl',
    text3Xl: 'text-4xl',
    legend: '2.5rem',
    min: 50,
    max: 70,
  },
  md: {
    size: 'md',
    text: 'text-base',
    prose: 'prose-lg',
    textLg: 'text-lg',
    textXl: 'text-xl',
    text2Xl: 'text-2xl',
    text3Xl: 'text-3xl',
    legend: '2rem',
    min: 40,
    max: 60,
  },
  sm: {
    size: 'sm',
    text: 'text-sm',
    prose: 'prose-base',
    textLg: 'text-base',
    textXl: 'text-lg',
    text2Xl: 'text-xl',
    text3Xl: 'text-2xl',
    legend: '1.5rem',
    min: 30,
    max: 40,
  },
}

export const sizeReducer = (
  state: { size: string; text: string },
  action: { type: string }
) => {
  switch (action.type) {
    case 'increase':
      switch (state.size) {
        case 'xl':
          return TextSizes.xl
        case 'lg':
          return TextSizes.xl
        case 'md':
          return TextSizes.lg
        case 'sm':
          return TextSizes.md
        default:
          return TextSizes.md
      }
    case 'decrease':
      switch (state.size) {
        case 'xl':
          return TextSizes.lg
        case 'lg':
          return TextSizes.md
        case 'md':
          return TextSizes.sm
        case 'sm':
          return TextSizes.sm
        default:
          return TextSizes.md
      }
    default:
      throw new Error()
  }
}
