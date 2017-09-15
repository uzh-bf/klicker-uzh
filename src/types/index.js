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

type FREEOptionsType = {
  restrictions: {
    max: number,
    min: number,
    type: string,
  },
}

type SCOptionsType = {
  choices: OptionType[],
  randomized: boolean,
}

type OptionsType = {
  ...SCOptionsType,
  ...FREEOptionsType,
}

type ReduxFormInputType<T> = {
  value: T,
  onChange: (newValue: T) => void,
}

type TextInputType = ReduxFormInputType<string>

type ArrayInputType<T> = {
  value: Array<T>,
  onChange: (newValue: Array<T>) => void,
}

export type {
  ArrayInputType,
  FeedbackType,
  FREEOptionsType,
  SCOptionsType,
  OptionsType,
  ReduxFormInputType,
  TextInputType,
  OptionType,
  TagType,
}
