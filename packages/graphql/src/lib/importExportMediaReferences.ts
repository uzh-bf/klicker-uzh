export {
  collectAnswerCollectionMediaReferences,
  collectElementMediaHrefs,
  collectElementMediaReferences,
  omitExternalAutoLoadingAnswerCollectionMediaReferences,
  omitExternalAutoLoadingElementMediaReferences,
  rewriteAnswerCollectionMediaReferences,
  rewriteElementMediaReferences,
  rewriteExportAnswerCollectionMediaReferences,
  rewriteExportElementMediaReferences,
} from './importExportElementMediaReferences.js'
export {
  collectMarkdownMediaReferences,
  collectPlainTextMediaReferences,
  rewriteMarkdownMediaReferences,
  rewritePlainTextMediaReferences,
} from './importExportMarkdownMediaReferences.js'
export {
  isImportExportMediaReferenceWorkBounded,
  measureAnswerCollectionMediaReferenceWork,
  measureElementMediaReferenceWork,
} from './importExportMediaReferenceBudget.js'
export {
  IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER,
  MediaReferenceKind,
  PACKAGE_MEDIA_HREF_PREFIX,
  createPackageMediaHref,
  isPackageMediaHref,
  type ElementMediaReference,
  type MediaReferenceWork,
} from './importExportMediaReferenceTypes.js'
