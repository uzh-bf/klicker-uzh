
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum
} = require('./runtime/index-browser')


const Prisma = {}

exports.Prisma = Prisma

/**
 * Prisma Client JS version: 4.2.0
 * Query Engine version: 2920a97877e12e055c1333079b8d19cee7f33826
 */
Prisma.prismaVersion = {
  client: "4.2.0",
  engine: "2920a97877e12e055c1333079b8d19cee7f33826"
}

Prisma.PrismaClientKnownRequestError = () => {
  throw new Error(`PrismaClientKnownRequestError is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  throw new Error(`PrismaClientUnknownRequestError is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.PrismaClientRustPanicError = () => {
  throw new Error(`PrismaClientRustPanicError is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.PrismaClientInitializationError = () => {
  throw new Error(`PrismaClientInitializationError is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.PrismaClientValidationError = () => {
  throw new Error(`PrismaClientValidationError is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.NotFoundError = () => {
  throw new Error(`NotFoundError is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  throw new Error(`sqltag is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.empty = () => {
  throw new Error(`empty is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.join = () => {
  throw new Error(`join is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.raw = () => {
  throw new Error(`raw is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
)}
Prisma.validator = () => (val) => val

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}

/**
 * Enums
 */
// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275
function makeEnum(x) { return x; }

exports.Prisma.AccountScalarFieldEnum = makeEnum({
  id: 'id',
  ssoType: 'ssoType',
  ssoId: 'ssoId',
  userId: 'userId'
});

exports.Prisma.AttachmentScalarFieldEnum = makeEnum({
  id: 'id',
  name: 'name',
  originalName: 'originalName',
  description: 'description',
  type: 'type',
  questionId: 'questionId',
  ownerId: 'ownerId'
});

exports.Prisma.CourseScalarFieldEnum = makeEnum({
  id: 'id',
  isArchived: 'isArchived',
  name: 'name',
  displayName: 'displayName',
  description: 'description',
  ownerId: 'ownerId'
});

exports.Prisma.JsonNullValueFilter = makeEnum({
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
});

exports.Prisma.JsonNullValueInput = makeEnum({
  JsonNull: Prisma.JsonNull
});

exports.Prisma.LearningElementScalarFieldEnum = makeEnum({
  id: 'id',
  ownerId: 'ownerId',
  courseId: 'courseId'
});

exports.Prisma.MicroSessionScalarFieldEnum = makeEnum({
  id: 'id',
  scheduledStartAt: 'scheduledStartAt',
  scheduledEndAt: 'scheduledEndAt',
  ownerId: 'ownerId',
  courseId: 'courseId'
});

exports.Prisma.QueryMode = makeEnum({
  default: 'default',
  insensitive: 'insensitive'
});

exports.Prisma.QuestionInstanceScalarFieldEnum = makeEnum({
  id: 'id',
  questionData: 'questionData',
  results: 'results',
  sessionBlockId: 'sessionBlockId',
  learningElementId: 'learningElementId',
  microSessionId: 'microSessionId',
  questionId: 'questionId',
  ownerId: 'ownerId'
});

exports.Prisma.QuestionScalarFieldEnum = makeEnum({
  id: 'id',
  isArchived: 'isArchived',
  isDeleted: 'isDeleted',
  name: 'name',
  content: 'content',
  contentPlain: 'contentPlain',
  options: 'options',
  type: 'type',
  ownerId: 'ownerId'
});

exports.Prisma.SessionBlockScalarFieldEnum = makeEnum({
  id: 'id',
  expiresAt: 'expiresAt',
  timeLimit: 'timeLimit',
  randomSelection: 'randomSelection',
  sessionId: 'sessionId'
});

exports.Prisma.SessionScalarFieldEnum = makeEnum({
  id: 'id',
  namespace: 'namespace',
  execution: 'execution',
  name: 'name',
  displayName: 'displayName',
  settings: 'settings',
  startedAt: 'startedAt',
  finishedAt: 'finishedAt',
  accessMode: 'accessMode',
  status: 'status',
  ownerId: 'ownerId',
  courseId: 'courseId'
});

exports.Prisma.SortOrder = makeEnum({
  asc: 'asc',
  desc: 'desc'
});

exports.Prisma.TagScalarFieldEnum = makeEnum({
  id: 'id',
  ownerId: 'ownerId'
});

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = makeEnum({
  id: 'id',
  isActive: 'isActive',
  isAAI: 'isAAI',
  email: 'email',
  shortname: 'shortname',
  password: 'password',
  salt: 'salt',
  description: 'description',
  lastLoginAt: 'lastLoginAt',
  deletionToken: 'deletionToken',
  deletionRequestedAt: 'deletionRequestedAt',
  role: 'role'
});
exports.AccessMode = makeEnum({
  PUBLIC: 'PUBLIC',
  RESTRICTED: 'RESTRICTED'
});

exports.AttachmentType = makeEnum({
  PNG: 'PNG',
  JPEG: 'JPEG',
  GIF: 'GIF'
});

exports.QuestionType = makeEnum({
  SC: 'SC',
  MC: 'MC',
  FREE_TEXT: 'FREE_TEXT',
  NUMERICAL: 'NUMERICAL'
});

exports.SessionStatus = makeEnum({
  PLANNED: 'PLANNED',
  SCHEDULED: 'SCHEDULED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED'
});

exports.UserRole = makeEnum({
  USER: 'USER',
  ADMIN: 'ADMIN'
});

exports.Prisma.ModelName = makeEnum({
  Account: 'Account',
  User: 'User',
  Attachment: 'Attachment',
  Question: 'Question',
  Tag: 'Tag',
  QuestionInstance: 'QuestionInstance',
  Course: 'Course',
  Session: 'Session',
  SessionBlock: 'SessionBlock',
  LearningElement: 'LearningElement',
  MicroSession: 'MicroSession'
});

/**
 * Create the Client
 */
class PrismaClient {
  constructor() {
    throw new Error(
      `PrismaClient is unable to be run in the browser.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
    )
  }
}
exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
