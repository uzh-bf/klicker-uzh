// @flow

type FeedbackType = {
  content: string,
  showDelete?: boolean,
  votes: number,
}

type OptionType = {
  correct?: boolean,
  name: string,
}

type TagType = {
  id?: string,
  name: string,
}

type TextInputType = {
  value: string,
  onChange: (newValue: string) => void,
}

type ArrayInputType<T> = {
  value: Array<T>,
  onChange: (newValue: Array<T>) => void,
}

export type { ArrayInputType, FeedbackType, TextInputType, OptionType, TagType }
