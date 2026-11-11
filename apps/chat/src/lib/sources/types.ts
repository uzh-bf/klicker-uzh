export type ChatSourceType = 'document' | 'link' | 'video' | 'image'

export interface ChatSourceVideoPassage {
  startSec: number
  endSec?: number
  excerpt?: string
}

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
  // All retrieved passages in payload order. Video citation clocks are
  // validated against these before they replace the fallback range above.
  videoPassages?: ChatSourceVideoPassage[]
  // Distinct clocks the answer cites for this video, ascending by seconds.
  citedStartSecs?: number[]
  url?: string
  excerpt?: string
}
