/** Shared SHA-256 identity syntax for figure assets and content digests. */
export const COURSE_IMAGE_DIGEST_PATTERN = '[a-f0-9]{64}'
export const COURSE_IMAGE_DIGEST_REGEX = new RegExp(
  `^${COURSE_IMAGE_DIGEST_PATTERN}$`
)
