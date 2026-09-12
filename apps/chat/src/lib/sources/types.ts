export type ChatSourceType = 'document' | 'link' | 'video' | 'image'

export interface ChatSource {
  id: string
  // 1-based citation number, first-appearance order across a message's
  // doc_query calls.
  index: number
  type: ChatSourceType
  title: string
  page?: number
  labeledPage?: string
  startSec?: number
  endSec?: number
  url?: string
  excerpt?: string
}
