// Ordering that feeds canonical bytes, hashes or manifests must not depend on
// the host locale: the same evidence is produced on servers and re-verified on
// owner machines. Pin the collation to en-US, the default locale of the
// service containers, so existing evidence keeps its original order.
const AUDIT_COLLATOR = new Intl.Collator('en-US')

export function compareAuditText(left: string, right: string): number {
  return AUDIT_COLLATOR.compare(left, right)
}
