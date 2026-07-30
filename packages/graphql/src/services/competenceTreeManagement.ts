// Public boundary for GraphQL schema consumers. Keep implementation modules
// below this facade so command, query, and persistence concerns stay separate.
export {
  archiveCompetenceTree,
  createCompetenceTree,
  deleteCompetenceTree,
  duplicateCompetenceTree,
  linkCompetenceTreeToCourse,
  replaceCompetenceTree,
  restoreCompetenceTree,
  unlinkCompetenceTreeFromCourse,
  updateCompetenceTreeElementAssignment,
  updateCompetenceTreeMetadata,
  validateCompetenceTreeInput,
} from './competenceTreeCommands.js'
export type {
  CompetenceTreeAssignmentInput,
  CompetenceTreeCoverageInput,
  CompetenceTreeInput,
  CompetenceTreeLevelInput,
  CompetenceTreeMetadataInput,
  CompetenceTreeNodeInput,
  DuplicateCompetenceTreeInput,
} from './competenceTreeInput.js'
export type {
  CompetenceTreeAssignmentView,
  CompetenceTreeCatalogArgs,
  CompetenceTreeCatalogOwnership,
  CompetenceTreeCatalogPage,
  CompetenceTreeCourseView,
  CompetenceTreeDetail,
  CompetenceTreeElementAssignmentUpdateInput,
  CompetenceTreeLevelView,
  CompetenceTreeSummary,
} from './competenceTreeManagementTypes.js'
export {
  getCompetenceTree,
  getCompetenceTreeCatalog,
  getCompetenceTrees,
  getCourseCompetenceTreeCatalog,
  getCourseCompetenceTrees,
  getElementCompetenceTrees,
} from './competenceTreeReadModels.js'
