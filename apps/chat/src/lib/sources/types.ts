export type ChatSourceType = 'document' | 'link' | 'video' | 'image'

export interface ChatSource {
  id: string
  // 1-based citation number, first-appearance order across a message's
  // doc_query calls.
  index: number
  type: ChatSourceType
  title: string
  // `page` stays the navigation anchor (the lowest retrieved physical page),
  // `pageEnd` the highest one when retrieval spans more than a single page.
  page?: number
  pageEnd?: number
  labeledPage?: string
  labeledPageEnd?: string
  startSec?: number
  endSec?: number
  url?: string
  excerpt?: string
}
