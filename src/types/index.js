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

type ObjectIdType = {
  id: string,
}

type QuestionType = {
  id: string,
  title: string,
  type: string,
}

type QuestionBlockType = {
  status: string,
  instances: Array<{
    id: string,
    question: QuestionType,
  }>,
  showSolutions: boolean,
  timeLimit: number,
}

type TextInputType = {
  value: string,
  onChange: (newValue: string) => void,
}

type ArrayInputType<T> = {
  value: Array<T>,
  onChange: (newValue: Array<T>) => void,
}

export type {
  ArrayInputType,
  FeedbackType,
  TextInputType,
  ObjectIdType,
  OptionType,
  QuestionBlockType,
  QuestionType,
  TagType,
}
