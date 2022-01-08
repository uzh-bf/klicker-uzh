export interface IFeedback {
  id: string
  resolved: boolean
  content: string
  resolvedAt: string
  createdAt: string
  upvoted?: boolean

  responses: IFeedbackResponse[]
}

export interface IFeedbackResponse {
  id: string
  content: string
  createdAt: string
  positive?: boolean
  negative?: boolean
}
