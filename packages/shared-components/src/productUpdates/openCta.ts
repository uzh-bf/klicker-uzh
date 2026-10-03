import type { ProductUpdate } from '@klicker-uzh/product-updates'
import type { NextRouter } from 'next/router'

/**
 * Follows the call to action of a product update from any surface that offers
 * one. A relative href belongs to this application and stays inside it; an
 * absolute one leaves for a new tab that cannot reach back into this document.
 */
export function openProductUpdateCta(
  cta: NonNullable<ProductUpdate['cta']>,
  router: NextRouter
) {
  if (cta.href.startsWith('/')) {
    void router.push(cta.href)
  } else {
    window.open(cta.href, '_blank', 'noopener,noreferrer')
  }
}
