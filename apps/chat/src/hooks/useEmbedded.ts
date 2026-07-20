'use client'

import { useSearchParams } from 'next/navigation'

export function useEmbedded(): boolean {
  const searchParams = useSearchParams()
  const value = searchParams.get('embed')
  return value === 'true' || value === '1'
}
