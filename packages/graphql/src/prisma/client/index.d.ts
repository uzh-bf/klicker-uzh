
/**
 * Client
**/

import * as runtime from './runtime/index';
declare const prisma: unique symbol
export type PrismaPromise<A> = Promise<A> & {[prisma]: true}
type UnwrapPromise<P extends any> = P extends Promise<infer R> ? R : P
type UnwrapTuple<Tuple extends readonly unknown[]> = {
  [K in keyof Tuple]: K extends `${number}` ? Tuple[K] extends PrismaPromise<infer X> ? X : UnwrapPromise<Tuple[K]> : UnwrapPromise<Tuple[K]>
};


/**
 * Model Account
 * 
 */
export type Account = {
  id: string
  ssoType: string
  ssoId: string
  userId: string
}

/**
 * Model User
 * 
 */
export type User = {
  id: string
  isActive: boolean
  isAAI: boolean
  email: string
  shortname: string
  password: string
  salt: string
  description: string | null
  lastLoginAt: Date | null
  deletionToken: string | null
  deletionRequestedAt: Date | null
  role: UserRole
}

/**
 * Model Attachment
 * 
 */
export type Attachment = {
  id: string
  name: string
  originalName: string
  description: string | null
  type: AttachmentType
  questionId: string | null
  ownerId: string
}

/**
 * Model Question
 * 
 */
export type Question = {
  id: string
  isArchived: boolean
  isDeleted: boolean
  name: string
  content: string
  contentPlain: string
  options: Prisma.JsonValue
  type: QuestionType
  ownerId: string
}

/**
 * Model Tag
 * 
 */
export type Tag = {
  id: number
  ownerId: string
}

/**
 * Model QuestionInstance
 * 
 */
export type QuestionInstance = {
  id: string
  questionData: Prisma.JsonValue
  results: Prisma.JsonValue
  sessionBlockId: number | null
  learningElementId: string | null
  microSessionId: string | null
  questionId: string
  ownerId: string
}

/**
 * Model Course
 * 
 */
export type Course = {
  id: string
  isArchived: boolean
  name: string
  displayName: string
  description: string | null
  ownerId: string
}

/**
 * Model Session
 * 
 */
export type Session = {
  id: string
  namespace: string
  execution: number
  name: string
  displayName: string
  settings: Prisma.JsonValue
  startedAt: Date
  finishedAt: Date
  accessMode: AccessMode
  status: SessionStatus
  ownerId: string
  courseId: string
}

/**
 * Model SessionBlock
 * 
 */
export type SessionBlock = {
  id: number
  expiresAt: Date | null
  timeLimit: number | null
  randomSelection: number | null
  sessionId: string
}

/**
 * Model LearningElement
 * 
 */
export type LearningElement = {
  id: string
  ownerId: string
  courseId: string
}

/**
 * Model MicroSession
 * 
 */
export type MicroSession = {
  id: string
  scheduledStartAt: Date
  scheduledEndAt: Date
  ownerId: string
  courseId: string
}


/**
 * Enums
 */

// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275

export const AccessMode: {
  PUBLIC: 'PUBLIC',
  RESTRICTED: 'RESTRICTED'
};

export type AccessMode = (typeof AccessMode)[keyof typeof AccessMode]


export const AttachmentType: {
  PNG: 'PNG',
  JPEG: 'JPEG',
  GIF: 'GIF'
};

export type AttachmentType = (typeof AttachmentType)[keyof typeof AttachmentType]


export const QuestionType: {
  SC: 'SC',
  MC: 'MC',
  FREE_TEXT: 'FREE_TEXT',
  NUMERICAL: 'NUMERICAL'
};

export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType]


export const SessionStatus: {
  PLANNED: 'PLANNED',
  SCHEDULED: 'SCHEDULED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED'
};

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus]


export const UserRole: {
  USER: 'USER',
  ADMIN: 'ADMIN'
};

export type UserRole = (typeof UserRole)[keyof typeof UserRole]


/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Accounts
 * const accounts = await prisma.account.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  T extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof T ? T['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<T['log']> : never : never,
  GlobalReject = 'rejectOnNotFound' extends keyof T
    ? T['rejectOnNotFound']
    : false
      > {
      /**
       * @private
       */
      private fetcher;
      /**
       * @private
       */
      private readonly dmmf;
      /**
       * @private
       */
      private connectionPromise?;
      /**
       * @private
       */
      private disconnectionPromise?;
      /**
       * @private
       */
      private readonly engineConfig;
      /**
       * @private
       */
      private readonly measurePerformance;

    /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Accounts
   * const accounts = await prisma.account.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<T, Prisma.PrismaClientOptions>);
  $on<V extends (U | 'beforeExit')>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : V extends 'beforeExit' ? () => Promise<void> : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): Promise<void>;

  /**
   * Add a middleware
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): PrismaPromise<T>;

  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends PrismaPromise<any>[]>(arg: [...P]): Promise<UnwrapTuple<P>>;

  $transaction<R>(fn: (prisma: Prisma.TransactionClient) => Promise<R>, options?: {maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel}): Promise<R>;

      /**
   * `prisma.account`: Exposes CRUD operations for the **Account** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Accounts
    * const accounts = await prisma.account.findMany()
    * ```
    */
  get account(): Prisma.AccountDelegate<GlobalReject>;

  /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<GlobalReject>;

  /**
   * `prisma.attachment`: Exposes CRUD operations for the **Attachment** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Attachments
    * const attachments = await prisma.attachment.findMany()
    * ```
    */
  get attachment(): Prisma.AttachmentDelegate<GlobalReject>;

  /**
   * `prisma.question`: Exposes CRUD operations for the **Question** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Questions
    * const questions = await prisma.question.findMany()
    * ```
    */
  get question(): Prisma.QuestionDelegate<GlobalReject>;

  /**
   * `prisma.tag`: Exposes CRUD operations for the **Tag** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Tags
    * const tags = await prisma.tag.findMany()
    * ```
    */
  get tag(): Prisma.TagDelegate<GlobalReject>;

  /**
   * `prisma.questionInstance`: Exposes CRUD operations for the **QuestionInstance** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more QuestionInstances
    * const questionInstances = await prisma.questionInstance.findMany()
    * ```
    */
  get questionInstance(): Prisma.QuestionInstanceDelegate<GlobalReject>;

  /**
   * `prisma.course`: Exposes CRUD operations for the **Course** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Courses
    * const courses = await prisma.course.findMany()
    * ```
    */
  get course(): Prisma.CourseDelegate<GlobalReject>;

  /**
   * `prisma.session`: Exposes CRUD operations for the **Session** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Sessions
    * const sessions = await prisma.session.findMany()
    * ```
    */
  get session(): Prisma.SessionDelegate<GlobalReject>;

  /**
   * `prisma.sessionBlock`: Exposes CRUD operations for the **SessionBlock** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SessionBlocks
    * const sessionBlocks = await prisma.sessionBlock.findMany()
    * ```
    */
  get sessionBlock(): Prisma.SessionBlockDelegate<GlobalReject>;

  /**
   * `prisma.learningElement`: Exposes CRUD operations for the **LearningElement** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more LearningElements
    * const learningElements = await prisma.learningElement.findMany()
    * ```
    */
  get learningElement(): Prisma.LearningElementDelegate<GlobalReject>;

  /**
   * `prisma.microSession`: Exposes CRUD operations for the **MicroSession** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MicroSessions
    * const microSessions = await prisma.microSession.findMany()
    * ```
    */
  get microSession(): Prisma.MicroSessionDelegate<GlobalReject>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError
  export import NotFoundError = runtime.NotFoundError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql

  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export import Metrics = runtime.Metrics
  export import Metric = runtime.Metric
  export import MetricHistogram = runtime.MetricHistogram
  export import MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
   * Prisma Client JS version: 4.2.0
   * Query Engine version: 2920a97877e12e055c1333079b8d19cee7f33826
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */

  /**
   * From https://github.com/sindresorhus/type-fest/
   * Matches a JSON object.
   * This type can be useful to enforce some input to be JSON-compatible or as a super-type to be extended from. 
   */
  export type JsonObject = {[Key in string]?: JsonValue}

  /**
   * From https://github.com/sindresorhus/type-fest/
   * Matches a JSON array.
   */
  export interface JsonArray extends Array<JsonValue> {}

  /**
   * From https://github.com/sindresorhus/type-fest/
   * Matches any valid JSON value.
   */
  export type JsonValue = string | number | boolean | JsonObject | JsonArray | null

  /**
   * Matches a JSON object.
   * Unlike `JsonObject`, this type allows undefined and read-only properties.
   */
  export type InputJsonObject = {readonly [Key in string]?: InputJsonValue | null}

  /**
   * Matches a JSON array.
   * Unlike `JsonArray`, readonly arrays are assignable to this type.
   */
  export interface InputJsonArray extends ReadonlyArray<InputJsonValue | null> {}

  /**
   * Matches any valid value that can be used as an input for operations like
   * create and update as the value of a JSON field. Unlike `JsonValue`, this
   * type allows read-only arrays and read-only object properties and disallows
   * `null` at the top level.
   *
   * `null` cannot be used as the value of a JSON field because its meaning
   * would be ambiguous. Use `Prisma.JsonNull` to store the JSON null value or
   * `Prisma.DbNull` to clear the JSON value and set the field to the database
   * NULL value instead.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-by-null-values
   */
  export type InputJsonValue = string | number | boolean | InputJsonObject | InputJsonArray

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }
  type HasSelect = {
    select: any
  }
  type HasInclude = {
    include: any
  }
  type CheckSelect<T, S, U> = T extends SelectAndInclude
    ? 'Please either choose `select` or `include`'
    : T extends HasSelect
    ? U
    : T extends HasInclude
    ? U
    : S

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => Promise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = {
    [key in keyof T]: T[key] extends false | undefined | null ? never : key
  }[keyof T]

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Buffer
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Exact<A, W = unknown> = 
  W extends unknown ? A extends Narrowable ? Cast<A, W> : Cast<
  {[K in keyof A]: K extends keyof W ? Exact<A[K], W[K]> : never},
  {[K in keyof W]: K extends keyof A ? Exact<A[K], W[K]> : W[K]}>
  : never;

  type Narrowable = string | number | boolean | bigint;

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;

  export function validator<V>(): <S>(select: Exact<S, V>) => S;

  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but with an array
   */
  type PickArray<T, K extends Array<keyof T>> = Prisma__Pick<T, TupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T

  class PrismaClientFetcher {
    private readonly prisma;
    private readonly debug;
    private readonly hooks?;
    constructor(prisma: PrismaClient<any, any>, debug?: boolean, hooks?: Hooks | undefined);
    request<T>(document: any, dataPath?: string[], rootField?: string, typeName?: string, isList?: boolean, callsite?: string): Promise<T>;
    sanitizeMessage(message: string): string;
    protected unpack(document: any, data: any, path: string[], rootField?: string, isList?: boolean): any;
  }

  export const ModelName: {
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
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  export type RejectOnNotFound = boolean | ((error: Error) => Error)
  export type RejectPerModel = { [P in ModelName]?: RejectOnNotFound }
  export type RejectPerOperation =  { [P in "findUnique" | "findFirst"]?: RejectPerModel | RejectOnNotFound } 
  type IsReject<T> = T extends true ? True : T extends (err: Error) => Error ? True : False
  export type HasReject<
    GlobalRejectSettings extends Prisma.PrismaClientOptions['rejectOnNotFound'],
    LocalRejectSettings,
    Action extends PrismaAction,
    Model extends ModelName
  > = LocalRejectSettings extends RejectOnNotFound
    ? IsReject<LocalRejectSettings>
    : GlobalRejectSettings extends RejectPerOperation
    ? Action extends keyof GlobalRejectSettings
      ? GlobalRejectSettings[Action] extends RejectOnNotFound
        ? IsReject<GlobalRejectSettings[Action]>
        : GlobalRejectSettings[Action] extends RejectPerModel
        ? Model extends keyof GlobalRejectSettings[Action]
          ? IsReject<GlobalRejectSettings[Action][Model]>
          : False
        : False
      : False
    : IsReject<GlobalRejectSettings>
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'

  export interface PrismaClientOptions {
    /**
     * Configure findUnique/findFirst to throw an error if the query returns null. 
     * @deprecated since 4.0.0. Use `findUniqueOrThrow`/`findFirstOrThrow` methods instead.
     * @example
     * ```
     * // Reject on both findUnique/findFirst
     * rejectOnNotFound: true
     * // Reject only on findFirst with a custom error
     * rejectOnNotFound: { findFirst: (err) => new Error("Custom Error")}
     * // Reject on user.findUnique with a custom error
     * rejectOnNotFound: { findUnique: {User: (err) => new Error("User not found")}}
     * ```
     */
    rejectOnNotFound?: RejectOnNotFound | RejectPerOperation
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources

    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat

    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: Array<LogLevel | LogDefinition>
  }

  export type Hooks = {
    beforeRequest?: (options: { query: string, path: string[], rootField?: string, typeName?: string, document: any }) => any
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findMany'
    | 'findFirst'
    | 'create'
    | 'createMany'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'

  /**
   * These options are being passed in to the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => Promise<T>,
  ) => Promise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;


  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */


  export type UserCountOutputType = {
    accounts: number
    courses: number
    questions: number
    attachments: number
    tags: number
    questionInstances: number
    sessions: number
    learningElements: number
    microSessions: number
  }

  export type UserCountOutputTypeSelect = {
    accounts?: boolean
    courses?: boolean
    questions?: boolean
    attachments?: boolean
    tags?: boolean
    questionInstances?: boolean
    sessions?: boolean
    learningElements?: boolean
    microSessions?: boolean
  }

  export type UserCountOutputTypeGetPayload<
    S extends boolean | null | undefined | UserCountOutputTypeArgs,
    U = keyof S
      > = S extends true
        ? UserCountOutputType
    : S extends undefined
    ? never
    : S extends UserCountOutputTypeArgs
    ?'include' extends U
    ? UserCountOutputType 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
    P extends keyof UserCountOutputType ? UserCountOutputType[P] : never
  } 
    : UserCountOutputType
  : UserCountOutputType




  // Custom InputTypes

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeArgs = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     * 
    **/
    select?: UserCountOutputTypeSelect | null
  }



  /**
   * Count Type QuestionCountOutputType
   */


  export type QuestionCountOutputType = {
    attachments: number
    tags: number
    instances: number
  }

  export type QuestionCountOutputTypeSelect = {
    attachments?: boolean
    tags?: boolean
    instances?: boolean
  }

  export type QuestionCountOutputTypeGetPayload<
    S extends boolean | null | undefined | QuestionCountOutputTypeArgs,
    U = keyof S
      > = S extends true
        ? QuestionCountOutputType
    : S extends undefined
    ? never
    : S extends QuestionCountOutputTypeArgs
    ?'include' extends U
    ? QuestionCountOutputType 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
    P extends keyof QuestionCountOutputType ? QuestionCountOutputType[P] : never
  } 
    : QuestionCountOutputType
  : QuestionCountOutputType




  // Custom InputTypes

  /**
   * QuestionCountOutputType without action
   */
  export type QuestionCountOutputTypeArgs = {
    /**
     * Select specific fields to fetch from the QuestionCountOutputType
     * 
    **/
    select?: QuestionCountOutputTypeSelect | null
  }



  /**
   * Count Type TagCountOutputType
   */


  export type TagCountOutputType = {
    questions: number
  }

  export type TagCountOutputTypeSelect = {
    questions?: boolean
  }

  export type TagCountOutputTypeGetPayload<
    S extends boolean | null | undefined | TagCountOutputTypeArgs,
    U = keyof S
      > = S extends true
        ? TagCountOutputType
    : S extends undefined
    ? never
    : S extends TagCountOutputTypeArgs
    ?'include' extends U
    ? TagCountOutputType 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
    P extends keyof TagCountOutputType ? TagCountOutputType[P] : never
  } 
    : TagCountOutputType
  : TagCountOutputType




  // Custom InputTypes

  /**
   * TagCountOutputType without action
   */
  export type TagCountOutputTypeArgs = {
    /**
     * Select specific fields to fetch from the TagCountOutputType
     * 
    **/
    select?: TagCountOutputTypeSelect | null
  }



  /**
   * Count Type CourseCountOutputType
   */


  export type CourseCountOutputType = {
    sessions: number
    learningElements: number
    microSessions: number
  }

  export type CourseCountOutputTypeSelect = {
    sessions?: boolean
    learningElements?: boolean
    microSessions?: boolean
  }

  export type CourseCountOutputTypeGetPayload<
    S extends boolean | null | undefined | CourseCountOutputTypeArgs,
    U = keyof S
      > = S extends true
        ? CourseCountOutputType
    : S extends undefined
    ? never
    : S extends CourseCountOutputTypeArgs
    ?'include' extends U
    ? CourseCountOutputType 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
    P extends keyof CourseCountOutputType ? CourseCountOutputType[P] : never
  } 
    : CourseCountOutputType
  : CourseCountOutputType




  // Custom InputTypes

  /**
   * CourseCountOutputType without action
   */
  export type CourseCountOutputTypeArgs = {
    /**
     * Select specific fields to fetch from the CourseCountOutputType
     * 
    **/
    select?: CourseCountOutputTypeSelect | null
  }



  /**
   * Count Type SessionCountOutputType
   */


  export type SessionCountOutputType = {
    blocks: number
  }

  export type SessionCountOutputTypeSelect = {
    blocks?: boolean
  }

  export type SessionCountOutputTypeGetPayload<
    S extends boolean | null | undefined | SessionCountOutputTypeArgs,
    U = keyof S
      > = S extends true
        ? SessionCountOutputType
    : S extends undefined
    ? never
    : S extends SessionCountOutputTypeArgs
    ?'include' extends U
    ? SessionCountOutputType 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
    P extends keyof SessionCountOutputType ? SessionCountOutputType[P] : never
  } 
    : SessionCountOutputType
  : SessionCountOutputType




  // Custom InputTypes

  /**
   * SessionCountOutputType without action
   */
  export type SessionCountOutputTypeArgs = {
    /**
     * Select specific fields to fetch from the SessionCountOutputType
     * 
    **/
    select?: SessionCountOutputTypeSelect | null
  }



  /**
   * Count Type SessionBlockCountOutputType
   */


  export type SessionBlockCountOutputType = {
    instances: number
  }

  export type SessionBlockCountOutputTypeSelect = {
    instances?: boolean
  }

  export type SessionBlockCountOutputTypeGetPayload<
    S extends boolean | null | undefined | SessionBlockCountOutputTypeArgs,
    U = keyof S
      > = S extends true
        ? SessionBlockCountOutputType
    : S extends undefined
    ? never
    : S extends SessionBlockCountOutputTypeArgs
    ?'include' extends U
    ? SessionBlockCountOutputType 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
    P extends keyof SessionBlockCountOutputType ? SessionBlockCountOutputType[P] : never
  } 
    : SessionBlockCountOutputType
  : SessionBlockCountOutputType




  // Custom InputTypes

  /**
   * SessionBlockCountOutputType without action
   */
  export type SessionBlockCountOutputTypeArgs = {
    /**
     * Select specific fields to fetch from the SessionBlockCountOutputType
     * 
    **/
    select?: SessionBlockCountOutputTypeSelect | null
  }



  /**
   * Count Type LearningElementCountOutputType
   */


  export type LearningElementCountOutputType = {
    instances: number
  }

  export type LearningElementCountOutputTypeSelect = {
    instances?: boolean
  }

  export type LearningElementCountOutputTypeGetPayload<
    S extends boolean | null | undefined | LearningElementCountOutputTypeArgs,
    U = keyof S
      > = S extends true
        ? LearningElementCountOutputType
    : S extends undefined
    ? never
    : S extends LearningElementCountOutputTypeArgs
    ?'include' extends U
    ? LearningElementCountOutputType 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
    P extends keyof LearningElementCountOutputType ? LearningElementCountOutputType[P] : never
  } 
    : LearningElementCountOutputType
  : LearningElementCountOutputType




  // Custom InputTypes

  /**
   * LearningElementCountOutputType without action
   */
  export type LearningElementCountOutputTypeArgs = {
    /**
     * Select specific fields to fetch from the LearningElementCountOutputType
     * 
    **/
    select?: LearningElementCountOutputTypeSelect | null
  }



  /**
   * Count Type MicroSessionCountOutputType
   */


  export type MicroSessionCountOutputType = {
    instances: number
  }

  export type MicroSessionCountOutputTypeSelect = {
    instances?: boolean
  }

  export type MicroSessionCountOutputTypeGetPayload<
    S extends boolean | null | undefined | MicroSessionCountOutputTypeArgs,
    U = keyof S
      > = S extends true
        ? MicroSessionCountOutputType
    : S extends undefined
    ? never
    : S extends MicroSessionCountOutputTypeArgs
    ?'include' extends U
    ? MicroSessionCountOutputType 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
    P extends keyof MicroSessionCountOutputType ? MicroSessionCountOutputType[P] : never
  } 
    : MicroSessionCountOutputType
  : MicroSessionCountOutputType




  // Custom InputTypes

  /**
   * MicroSessionCountOutputType without action
   */
  export type MicroSessionCountOutputTypeArgs = {
    /**
     * Select specific fields to fetch from the MicroSessionCountOutputType
     * 
    **/
    select?: MicroSessionCountOutputTypeSelect | null
  }



  /**
   * Models
   */

  /**
   * Model Account
   */


  export type AggregateAccount = {
    _count: AccountCountAggregateOutputType | null
    _min: AccountMinAggregateOutputType | null
    _max: AccountMaxAggregateOutputType | null
  }

  export type AccountMinAggregateOutputType = {
    id: string | null
    ssoType: string | null
    ssoId: string | null
    userId: string | null
  }

  export type AccountMaxAggregateOutputType = {
    id: string | null
    ssoType: string | null
    ssoId: string | null
    userId: string | null
  }

  export type AccountCountAggregateOutputType = {
    id: number
    ssoType: number
    ssoId: number
    userId: number
    _all: number
  }


  export type AccountMinAggregateInputType = {
    id?: true
    ssoType?: true
    ssoId?: true
    userId?: true
  }

  export type AccountMaxAggregateInputType = {
    id?: true
    ssoType?: true
    ssoId?: true
    userId?: true
  }

  export type AccountCountAggregateInputType = {
    id?: true
    ssoType?: true
    ssoId?: true
    userId?: true
    _all?: true
  }

  export type AccountAggregateArgs = {
    /**
     * Filter which Account to aggregate.
     * 
    **/
    where?: AccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Accounts to fetch.
     * 
    **/
    orderBy?: Enumerable<AccountOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     * 
    **/
    cursor?: AccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Accounts from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Accounts.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Accounts
    **/
    _count?: true | AccountCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AccountMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AccountMaxAggregateInputType
  }

  export type GetAccountAggregateType<T extends AccountAggregateArgs> = {
        [P in keyof T & keyof AggregateAccount]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAccount[P]>
      : GetScalarType<T[P], AggregateAccount[P]>
  }




  export type AccountGroupByArgs = {
    where?: AccountWhereInput
    orderBy?: Enumerable<AccountOrderByWithAggregationInput>
    by: Array<AccountScalarFieldEnum>
    having?: AccountScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AccountCountAggregateInputType | true
    _min?: AccountMinAggregateInputType
    _max?: AccountMaxAggregateInputType
  }


  export type AccountGroupByOutputType = {
    id: string
    ssoType: string
    ssoId: string
    userId: string
    _count: AccountCountAggregateOutputType | null
    _min: AccountMinAggregateOutputType | null
    _max: AccountMaxAggregateOutputType | null
  }

  type GetAccountGroupByPayload<T extends AccountGroupByArgs> = PrismaPromise<
    Array<
      PickArray<AccountGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AccountGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AccountGroupByOutputType[P]>
            : GetScalarType<T[P], AccountGroupByOutputType[P]>
        }
      >
    >


  export type AccountSelect = {
    id?: boolean
    ssoType?: boolean
    ssoId?: boolean
    user?: boolean | UserArgs
    userId?: boolean
  }

  export type AccountInclude = {
    user?: boolean | UserArgs
  }

  export type AccountGetPayload<
    S extends boolean | null | undefined | AccountArgs,
    U = keyof S
      > = S extends true
        ? Account
    : S extends undefined
    ? never
    : S extends AccountArgs | AccountFindManyArgs
    ?'include' extends U
    ? Account  & {
    [P in TrueKeys<S['include']>]:
        P extends 'user' ? UserGetPayload<S['include'][P]> :  never
  } 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
        P extends 'user' ? UserGetPayload<S['select'][P]> :  P extends keyof Account ? Account[P] : never
  } 
    : Account
  : Account


  type AccountCountArgs = Merge<
    Omit<AccountFindManyArgs, 'select' | 'include'> & {
      select?: AccountCountAggregateInputType | true
    }
  >

  export interface AccountDelegate<GlobalRejectSettings> {
    /**
     * Find zero or one Account that matches the filter.
     * @param {AccountFindUniqueArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends AccountFindUniqueArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args: SelectSubset<T, AccountFindUniqueArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findUnique', 'Account'> extends True ? CheckSelect<T, Prisma__AccountClient<Account>, Prisma__AccountClient<AccountGetPayload<T>>> : CheckSelect<T, Prisma__AccountClient<Account | null >, Prisma__AccountClient<AccountGetPayload<T> | null >>

    /**
     * Find the first Account that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountFindFirstArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends AccountFindFirstArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args?: SelectSubset<T, AccountFindFirstArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findFirst', 'Account'> extends True ? CheckSelect<T, Prisma__AccountClient<Account>, Prisma__AccountClient<AccountGetPayload<T>>> : CheckSelect<T, Prisma__AccountClient<Account | null >, Prisma__AccountClient<AccountGetPayload<T> | null >>

    /**
     * Find zero or more Accounts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Accounts
     * const accounts = await prisma.account.findMany()
     * 
     * // Get first 10 Accounts
     * const accounts = await prisma.account.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const accountWithIdOnly = await prisma.account.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends AccountFindManyArgs>(
      args?: SelectSubset<T, AccountFindManyArgs>
    ): CheckSelect<T, PrismaPromise<Array<Account>>, PrismaPromise<Array<AccountGetPayload<T>>>>

    /**
     * Create a Account.
     * @param {AccountCreateArgs} args - Arguments to create a Account.
     * @example
     * // Create one Account
     * const Account = await prisma.account.create({
     *   data: {
     *     // ... data to create a Account
     *   }
     * })
     * 
    **/
    create<T extends AccountCreateArgs>(
      args: SelectSubset<T, AccountCreateArgs>
    ): CheckSelect<T, Prisma__AccountClient<Account>, Prisma__AccountClient<AccountGetPayload<T>>>

    /**
     * Create many Accounts.
     *     @param {AccountCreateManyArgs} args - Arguments to create many Accounts.
     *     @example
     *     // Create many Accounts
     *     const account = await prisma.account.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends AccountCreateManyArgs>(
      args?: SelectSubset<T, AccountCreateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Delete a Account.
     * @param {AccountDeleteArgs} args - Arguments to delete one Account.
     * @example
     * // Delete one Account
     * const Account = await prisma.account.delete({
     *   where: {
     *     // ... filter to delete one Account
     *   }
     * })
     * 
    **/
    delete<T extends AccountDeleteArgs>(
      args: SelectSubset<T, AccountDeleteArgs>
    ): CheckSelect<T, Prisma__AccountClient<Account>, Prisma__AccountClient<AccountGetPayload<T>>>

    /**
     * Update one Account.
     * @param {AccountUpdateArgs} args - Arguments to update one Account.
     * @example
     * // Update one Account
     * const account = await prisma.account.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends AccountUpdateArgs>(
      args: SelectSubset<T, AccountUpdateArgs>
    ): CheckSelect<T, Prisma__AccountClient<Account>, Prisma__AccountClient<AccountGetPayload<T>>>

    /**
     * Delete zero or more Accounts.
     * @param {AccountDeleteManyArgs} args - Arguments to filter Accounts to delete.
     * @example
     * // Delete a few Accounts
     * const { count } = await prisma.account.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends AccountDeleteManyArgs>(
      args?: SelectSubset<T, AccountDeleteManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Update zero or more Accounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Accounts
     * const account = await prisma.account.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends AccountUpdateManyArgs>(
      args: SelectSubset<T, AccountUpdateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Create or update one Account.
     * @param {AccountUpsertArgs} args - Arguments to update or create a Account.
     * @example
     * // Update or create a Account
     * const account = await prisma.account.upsert({
     *   create: {
     *     // ... data to create a Account
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Account we want to update
     *   }
     * })
    **/
    upsert<T extends AccountUpsertArgs>(
      args: SelectSubset<T, AccountUpsertArgs>
    ): CheckSelect<T, Prisma__AccountClient<Account>, Prisma__AccountClient<AccountGetPayload<T>>>

    /**
     * Find one Account that matches the filter or throw
     * `NotFoundError` if no matches were found.
     * @param {AccountFindUniqueOrThrowArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends AccountFindUniqueOrThrowArgs>(
      args?: SelectSubset<T, AccountFindUniqueOrThrowArgs>
    ): CheckSelect<T, Prisma__AccountClient<Account>, Prisma__AccountClient<AccountGetPayload<T>>>

    /**
     * Find the first Account that matches the filter or
     * throw `NotFoundError` if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountFindFirstOrThrowArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends AccountFindFirstOrThrowArgs>(
      args?: SelectSubset<T, AccountFindFirstOrThrowArgs>
    ): CheckSelect<T, Prisma__AccountClient<Account>, Prisma__AccountClient<AccountGetPayload<T>>>

    /**
     * Count the number of Accounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountCountArgs} args - Arguments to filter Accounts to count.
     * @example
     * // Count the number of Accounts
     * const count = await prisma.account.count({
     *   where: {
     *     // ... the filter for the Accounts we want to count
     *   }
     * })
    **/
    count<T extends AccountCountArgs>(
      args?: Subset<T, AccountCountArgs>,
    ): PrismaPromise<
      T extends _Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AccountCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Account.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AccountAggregateArgs>(args: Subset<T, AccountAggregateArgs>): PrismaPromise<GetAccountAggregateType<T>>

    /**
     * Group by Account.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AccountGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AccountGroupByArgs['orderBy'] }
        : { orderBy?: AccountGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends TupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AccountGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAccountGroupByPayload<T> : PrismaPromise<InputErrors>
  }

  /**
   * The delegate class that acts as a "Promise-like" for Account.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__AccountClient<T> implements PrismaPromise<T> {
    [prisma]: true;
    private readonly _dmmf;
    private readonly _fetcher;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    constructor(_dmmf: runtime.DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
    readonly [Symbol.toStringTag]: 'PrismaClientPromise';

    user<T extends UserArgs = {}>(args?: Subset<T, UserArgs>): CheckSelect<T, Prisma__UserClient<User | null >, Prisma__UserClient<UserGetPayload<T> | null >>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }

  // Custom InputTypes

  /**
   * Account base type for findUnique actions
   */
  export type AccountFindUniqueArgsBase = {
    /**
     * Select specific fields to fetch from the Account
     * 
    **/
    select?: AccountSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AccountInclude | null
    /**
     * Filter, which Account to fetch.
     * 
    **/
    where: AccountWhereUniqueInput
  }

  /**
   * Account: findUnique
   */
  export interface AccountFindUniqueArgs extends AccountFindUniqueArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findUniqueOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * Account base type for findFirst actions
   */
  export type AccountFindFirstArgsBase = {
    /**
     * Select specific fields to fetch from the Account
     * 
    **/
    select?: AccountSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AccountInclude | null
    /**
     * Filter, which Account to fetch.
     * 
    **/
    where?: AccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Accounts to fetch.
     * 
    **/
    orderBy?: Enumerable<AccountOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Accounts.
     * 
    **/
    cursor?: AccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Accounts from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Accounts.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Accounts.
     * 
    **/
    distinct?: Enumerable<AccountScalarFieldEnum>
  }

  /**
   * Account: findFirst
   */
  export interface AccountFindFirstArgs extends AccountFindFirstArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findFirstOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * Account findMany
   */
  export type AccountFindManyArgs = {
    /**
     * Select specific fields to fetch from the Account
     * 
    **/
    select?: AccountSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AccountInclude | null
    /**
     * Filter, which Accounts to fetch.
     * 
    **/
    where?: AccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Accounts to fetch.
     * 
    **/
    orderBy?: Enumerable<AccountOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Accounts.
     * 
    **/
    cursor?: AccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Accounts from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Accounts.
     * 
    **/
    skip?: number
    distinct?: Enumerable<AccountScalarFieldEnum>
  }


  /**
   * Account create
   */
  export type AccountCreateArgs = {
    /**
     * Select specific fields to fetch from the Account
     * 
    **/
    select?: AccountSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AccountInclude | null
    /**
     * The data needed to create a Account.
     * 
    **/
    data: XOR<AccountCreateInput, AccountUncheckedCreateInput>
  }


  /**
   * Account createMany
   */
  export type AccountCreateManyArgs = {
    /**
     * The data used to create many Accounts.
     * 
    **/
    data: Enumerable<AccountCreateManyInput>
    skipDuplicates?: boolean
  }


  /**
   * Account update
   */
  export type AccountUpdateArgs = {
    /**
     * Select specific fields to fetch from the Account
     * 
    **/
    select?: AccountSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AccountInclude | null
    /**
     * The data needed to update a Account.
     * 
    **/
    data: XOR<AccountUpdateInput, AccountUncheckedUpdateInput>
    /**
     * Choose, which Account to update.
     * 
    **/
    where: AccountWhereUniqueInput
  }


  /**
   * Account updateMany
   */
  export type AccountUpdateManyArgs = {
    /**
     * The data used to update Accounts.
     * 
    **/
    data: XOR<AccountUpdateManyMutationInput, AccountUncheckedUpdateManyInput>
    /**
     * Filter which Accounts to update
     * 
    **/
    where?: AccountWhereInput
  }


  /**
   * Account upsert
   */
  export type AccountUpsertArgs = {
    /**
     * Select specific fields to fetch from the Account
     * 
    **/
    select?: AccountSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AccountInclude | null
    /**
     * The filter to search for the Account to update in case it exists.
     * 
    **/
    where: AccountWhereUniqueInput
    /**
     * In case the Account found by the `where` argument doesn't exist, create a new Account with this data.
     * 
    **/
    create: XOR<AccountCreateInput, AccountUncheckedCreateInput>
    /**
     * In case the Account was found with the provided `where` argument, update it with this data.
     * 
    **/
    update: XOR<AccountUpdateInput, AccountUncheckedUpdateInput>
  }


  /**
   * Account delete
   */
  export type AccountDeleteArgs = {
    /**
     * Select specific fields to fetch from the Account
     * 
    **/
    select?: AccountSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AccountInclude | null
    /**
     * Filter which Account to delete.
     * 
    **/
    where: AccountWhereUniqueInput
  }


  /**
   * Account deleteMany
   */
  export type AccountDeleteManyArgs = {
    /**
     * Filter which Accounts to delete
     * 
    **/
    where?: AccountWhereInput
  }


  /**
   * Account: findUniqueOrThrow
   */
  export type AccountFindUniqueOrThrowArgs = AccountFindUniqueArgsBase
      

  /**
   * Account: findFirstOrThrow
   */
  export type AccountFindFirstOrThrowArgs = AccountFindFirstArgsBase
      

  /**
   * Account without action
   */
  export type AccountArgs = {
    /**
     * Select specific fields to fetch from the Account
     * 
    **/
    select?: AccountSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AccountInclude | null
  }



  /**
   * Model User
   */


  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    isActive: boolean | null
    isAAI: boolean | null
    email: string | null
    shortname: string | null
    password: string | null
    salt: string | null
    description: string | null
    lastLoginAt: Date | null
    deletionToken: string | null
    deletionRequestedAt: Date | null
    role: UserRole | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    isActive: boolean | null
    isAAI: boolean | null
    email: string | null
    shortname: string | null
    password: string | null
    salt: string | null
    description: string | null
    lastLoginAt: Date | null
    deletionToken: string | null
    deletionRequestedAt: Date | null
    role: UserRole | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    isActive: number
    isAAI: number
    email: number
    shortname: number
    password: number
    salt: number
    description: number
    lastLoginAt: number
    deletionToken: number
    deletionRequestedAt: number
    role: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    isActive?: true
    isAAI?: true
    email?: true
    shortname?: true
    password?: true
    salt?: true
    description?: true
    lastLoginAt?: true
    deletionToken?: true
    deletionRequestedAt?: true
    role?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    isActive?: true
    isAAI?: true
    email?: true
    shortname?: true
    password?: true
    salt?: true
    description?: true
    lastLoginAt?: true
    deletionToken?: true
    deletionRequestedAt?: true
    role?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    isActive?: true
    isAAI?: true
    email?: true
    shortname?: true
    password?: true
    salt?: true
    description?: true
    lastLoginAt?: true
    deletionToken?: true
    deletionRequestedAt?: true
    role?: true
    _all?: true
  }

  export type UserAggregateArgs = {
    /**
     * Filter which User to aggregate.
     * 
    **/
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     * 
    **/
    orderBy?: Enumerable<UserOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     * 
    **/
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs = {
    where?: UserWhereInput
    orderBy?: Enumerable<UserOrderByWithAggregationInput>
    by: Array<UserScalarFieldEnum>
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }


  export type UserGroupByOutputType = {
    id: string
    isActive: boolean
    isAAI: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description: string | null
    lastLoginAt: Date | null
    deletionToken: string | null
    deletionRequestedAt: Date | null
    role: UserRole
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = PrismaPromise<
    Array<
      PickArray<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect = {
    id?: boolean
    isActive?: boolean
    isAAI?: boolean
    email?: boolean
    shortname?: boolean
    password?: boolean
    salt?: boolean
    description?: boolean
    lastLoginAt?: boolean
    deletionToken?: boolean
    deletionRequestedAt?: boolean
    role?: boolean
    accounts?: boolean | AccountFindManyArgs
    courses?: boolean | CourseFindManyArgs
    questions?: boolean | QuestionFindManyArgs
    attachments?: boolean | AttachmentFindManyArgs
    tags?: boolean | TagFindManyArgs
    questionInstances?: boolean | QuestionInstanceFindManyArgs
    sessions?: boolean | SessionFindManyArgs
    learningElements?: boolean | LearningElementFindManyArgs
    microSessions?: boolean | MicroSessionFindManyArgs
    _count?: boolean | UserCountOutputTypeArgs
  }

  export type UserInclude = {
    accounts?: boolean | AccountFindManyArgs
    courses?: boolean | CourseFindManyArgs
    questions?: boolean | QuestionFindManyArgs
    attachments?: boolean | AttachmentFindManyArgs
    tags?: boolean | TagFindManyArgs
    questionInstances?: boolean | QuestionInstanceFindManyArgs
    sessions?: boolean | SessionFindManyArgs
    learningElements?: boolean | LearningElementFindManyArgs
    microSessions?: boolean | MicroSessionFindManyArgs
    _count?: boolean | UserCountOutputTypeArgs
  }

  export type UserGetPayload<
    S extends boolean | null | undefined | UserArgs,
    U = keyof S
      > = S extends true
        ? User
    : S extends undefined
    ? never
    : S extends UserArgs | UserFindManyArgs
    ?'include' extends U
    ? User  & {
    [P in TrueKeys<S['include']>]:
        P extends 'accounts' ? Array < AccountGetPayload<S['include'][P]>>  :
        P extends 'courses' ? Array < CourseGetPayload<S['include'][P]>>  :
        P extends 'questions' ? Array < QuestionGetPayload<S['include'][P]>>  :
        P extends 'attachments' ? Array < AttachmentGetPayload<S['include'][P]>>  :
        P extends 'tags' ? Array < TagGetPayload<S['include'][P]>>  :
        P extends 'questionInstances' ? Array < QuestionInstanceGetPayload<S['include'][P]>>  :
        P extends 'sessions' ? Array < SessionGetPayload<S['include'][P]>>  :
        P extends 'learningElements' ? Array < LearningElementGetPayload<S['include'][P]>>  :
        P extends 'microSessions' ? Array < MicroSessionGetPayload<S['include'][P]>>  :
        P extends '_count' ? UserCountOutputTypeGetPayload<S['include'][P]> :  never
  } 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
        P extends 'accounts' ? Array < AccountGetPayload<S['select'][P]>>  :
        P extends 'courses' ? Array < CourseGetPayload<S['select'][P]>>  :
        P extends 'questions' ? Array < QuestionGetPayload<S['select'][P]>>  :
        P extends 'attachments' ? Array < AttachmentGetPayload<S['select'][P]>>  :
        P extends 'tags' ? Array < TagGetPayload<S['select'][P]>>  :
        P extends 'questionInstances' ? Array < QuestionInstanceGetPayload<S['select'][P]>>  :
        P extends 'sessions' ? Array < SessionGetPayload<S['select'][P]>>  :
        P extends 'learningElements' ? Array < LearningElementGetPayload<S['select'][P]>>  :
        P extends 'microSessions' ? Array < MicroSessionGetPayload<S['select'][P]>>  :
        P extends '_count' ? UserCountOutputTypeGetPayload<S['select'][P]> :  P extends keyof User ? User[P] : never
  } 
    : User
  : User


  type UserCountArgs = Merge<
    Omit<UserFindManyArgs, 'select' | 'include'> & {
      select?: UserCountAggregateInputType | true
    }
  >

  export interface UserDelegate<GlobalRejectSettings> {
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends UserFindUniqueArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args: SelectSubset<T, UserFindUniqueArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findUnique', 'User'> extends True ? CheckSelect<T, Prisma__UserClient<User>, Prisma__UserClient<UserGetPayload<T>>> : CheckSelect<T, Prisma__UserClient<User | null >, Prisma__UserClient<UserGetPayload<T> | null >>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends UserFindFirstArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args?: SelectSubset<T, UserFindFirstArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findFirst', 'User'> extends True ? CheckSelect<T, Prisma__UserClient<User>, Prisma__UserClient<UserGetPayload<T>>> : CheckSelect<T, Prisma__UserClient<User | null >, Prisma__UserClient<UserGetPayload<T> | null >>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends UserFindManyArgs>(
      args?: SelectSubset<T, UserFindManyArgs>
    ): CheckSelect<T, PrismaPromise<Array<User>>, PrismaPromise<Array<UserGetPayload<T>>>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
    **/
    create<T extends UserCreateArgs>(
      args: SelectSubset<T, UserCreateArgs>
    ): CheckSelect<T, Prisma__UserClient<User>, Prisma__UserClient<UserGetPayload<T>>>

    /**
     * Create many Users.
     *     @param {UserCreateManyArgs} args - Arguments to create many Users.
     *     @example
     *     // Create many Users
     *     const user = await prisma.user.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends UserCreateManyArgs>(
      args?: SelectSubset<T, UserCreateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
    **/
    delete<T extends UserDeleteArgs>(
      args: SelectSubset<T, UserDeleteArgs>
    ): CheckSelect<T, Prisma__UserClient<User>, Prisma__UserClient<UserGetPayload<T>>>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends UserUpdateArgs>(
      args: SelectSubset<T, UserUpdateArgs>
    ): CheckSelect<T, Prisma__UserClient<User>, Prisma__UserClient<UserGetPayload<T>>>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends UserDeleteManyArgs>(
      args?: SelectSubset<T, UserDeleteManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends UserUpdateManyArgs>(
      args: SelectSubset<T, UserUpdateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
    **/
    upsert<T extends UserUpsertArgs>(
      args: SelectSubset<T, UserUpsertArgs>
    ): CheckSelect<T, Prisma__UserClient<User>, Prisma__UserClient<UserGetPayload<T>>>

    /**
     * Find one User that matches the filter or throw
     * `NotFoundError` if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(
      args?: SelectSubset<T, UserFindUniqueOrThrowArgs>
    ): CheckSelect<T, Prisma__UserClient<User>, Prisma__UserClient<UserGetPayload<T>>>

    /**
     * Find the first User that matches the filter or
     * throw `NotFoundError` if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(
      args?: SelectSubset<T, UserFindFirstOrThrowArgs>
    ): CheckSelect<T, Prisma__UserClient<User>, Prisma__UserClient<UserGetPayload<T>>>

    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): PrismaPromise<
      T extends _Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends TupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : PrismaPromise<InputErrors>
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__UserClient<T> implements PrismaPromise<T> {
    [prisma]: true;
    private readonly _dmmf;
    private readonly _fetcher;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    constructor(_dmmf: runtime.DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
    readonly [Symbol.toStringTag]: 'PrismaClientPromise';

    accounts<T extends AccountFindManyArgs = {}>(args?: Subset<T, AccountFindManyArgs>): CheckSelect<T, PrismaPromise<Array<Account>>, PrismaPromise<Array<AccountGetPayload<T>>>>;

    courses<T extends CourseFindManyArgs = {}>(args?: Subset<T, CourseFindManyArgs>): CheckSelect<T, PrismaPromise<Array<Course>>, PrismaPromise<Array<CourseGetPayload<T>>>>;

    questions<T extends QuestionFindManyArgs = {}>(args?: Subset<T, QuestionFindManyArgs>): CheckSelect<T, PrismaPromise<Array<Question>>, PrismaPromise<Array<QuestionGetPayload<T>>>>;

    attachments<T extends AttachmentFindManyArgs = {}>(args?: Subset<T, AttachmentFindManyArgs>): CheckSelect<T, PrismaPromise<Array<Attachment>>, PrismaPromise<Array<AttachmentGetPayload<T>>>>;

    tags<T extends TagFindManyArgs = {}>(args?: Subset<T, TagFindManyArgs>): CheckSelect<T, PrismaPromise<Array<Tag>>, PrismaPromise<Array<TagGetPayload<T>>>>;

    questionInstances<T extends QuestionInstanceFindManyArgs = {}>(args?: Subset<T, QuestionInstanceFindManyArgs>): CheckSelect<T, PrismaPromise<Array<QuestionInstance>>, PrismaPromise<Array<QuestionInstanceGetPayload<T>>>>;

    sessions<T extends SessionFindManyArgs = {}>(args?: Subset<T, SessionFindManyArgs>): CheckSelect<T, PrismaPromise<Array<Session>>, PrismaPromise<Array<SessionGetPayload<T>>>>;

    learningElements<T extends LearningElementFindManyArgs = {}>(args?: Subset<T, LearningElementFindManyArgs>): CheckSelect<T, PrismaPromise<Array<LearningElement>>, PrismaPromise<Array<LearningElementGetPayload<T>>>>;

    microSessions<T extends MicroSessionFindManyArgs = {}>(args?: Subset<T, MicroSessionFindManyArgs>): CheckSelect<T, PrismaPromise<Array<MicroSession>>, PrismaPromise<Array<MicroSessionGetPayload<T>>>>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }

  // Custom InputTypes

  /**
   * User base type for findUnique actions
   */
  export type UserFindUniqueArgsBase = {
    /**
     * Select specific fields to fetch from the User
     * 
    **/
    select?: UserSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: UserInclude | null
    /**
     * Filter, which User to fetch.
     * 
    **/
    where: UserWhereUniqueInput
  }

  /**
   * User: findUnique
   */
  export interface UserFindUniqueArgs extends UserFindUniqueArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findUniqueOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * User base type for findFirst actions
   */
  export type UserFindFirstArgsBase = {
    /**
     * Select specific fields to fetch from the User
     * 
    **/
    select?: UserSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: UserInclude | null
    /**
     * Filter, which User to fetch.
     * 
    **/
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     * 
    **/
    orderBy?: Enumerable<UserOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     * 
    **/
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     * 
    **/
    distinct?: Enumerable<UserScalarFieldEnum>
  }

  /**
   * User: findFirst
   */
  export interface UserFindFirstArgs extends UserFindFirstArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findFirstOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * User findMany
   */
  export type UserFindManyArgs = {
    /**
     * Select specific fields to fetch from the User
     * 
    **/
    select?: UserSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: UserInclude | null
    /**
     * Filter, which Users to fetch.
     * 
    **/
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     * 
    **/
    orderBy?: Enumerable<UserOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     * 
    **/
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     * 
    **/
    skip?: number
    distinct?: Enumerable<UserScalarFieldEnum>
  }


  /**
   * User create
   */
  export type UserCreateArgs = {
    /**
     * Select specific fields to fetch from the User
     * 
    **/
    select?: UserSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: UserInclude | null
    /**
     * The data needed to create a User.
     * 
    **/
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }


  /**
   * User createMany
   */
  export type UserCreateManyArgs = {
    /**
     * The data used to create many Users.
     * 
    **/
    data: Enumerable<UserCreateManyInput>
    skipDuplicates?: boolean
  }


  /**
   * User update
   */
  export type UserUpdateArgs = {
    /**
     * Select specific fields to fetch from the User
     * 
    **/
    select?: UserSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: UserInclude | null
    /**
     * The data needed to update a User.
     * 
    **/
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     * 
    **/
    where: UserWhereUniqueInput
  }


  /**
   * User updateMany
   */
  export type UserUpdateManyArgs = {
    /**
     * The data used to update Users.
     * 
    **/
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     * 
    **/
    where?: UserWhereInput
  }


  /**
   * User upsert
   */
  export type UserUpsertArgs = {
    /**
     * Select specific fields to fetch from the User
     * 
    **/
    select?: UserSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: UserInclude | null
    /**
     * The filter to search for the User to update in case it exists.
     * 
    **/
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     * 
    **/
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     * 
    **/
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }


  /**
   * User delete
   */
  export type UserDeleteArgs = {
    /**
     * Select specific fields to fetch from the User
     * 
    **/
    select?: UserSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: UserInclude | null
    /**
     * Filter which User to delete.
     * 
    **/
    where: UserWhereUniqueInput
  }


  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs = {
    /**
     * Filter which Users to delete
     * 
    **/
    where?: UserWhereInput
  }


  /**
   * User: findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs = UserFindUniqueArgsBase
      

  /**
   * User: findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs = UserFindFirstArgsBase
      

  /**
   * User without action
   */
  export type UserArgs = {
    /**
     * Select specific fields to fetch from the User
     * 
    **/
    select?: UserSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: UserInclude | null
  }



  /**
   * Model Attachment
   */


  export type AggregateAttachment = {
    _count: AttachmentCountAggregateOutputType | null
    _min: AttachmentMinAggregateOutputType | null
    _max: AttachmentMaxAggregateOutputType | null
  }

  export type AttachmentMinAggregateOutputType = {
    id: string | null
    name: string | null
    originalName: string | null
    description: string | null
    type: AttachmentType | null
    questionId: string | null
    ownerId: string | null
  }

  export type AttachmentMaxAggregateOutputType = {
    id: string | null
    name: string | null
    originalName: string | null
    description: string | null
    type: AttachmentType | null
    questionId: string | null
    ownerId: string | null
  }

  export type AttachmentCountAggregateOutputType = {
    id: number
    name: number
    originalName: number
    description: number
    type: number
    questionId: number
    ownerId: number
    _all: number
  }


  export type AttachmentMinAggregateInputType = {
    id?: true
    name?: true
    originalName?: true
    description?: true
    type?: true
    questionId?: true
    ownerId?: true
  }

  export type AttachmentMaxAggregateInputType = {
    id?: true
    name?: true
    originalName?: true
    description?: true
    type?: true
    questionId?: true
    ownerId?: true
  }

  export type AttachmentCountAggregateInputType = {
    id?: true
    name?: true
    originalName?: true
    description?: true
    type?: true
    questionId?: true
    ownerId?: true
    _all?: true
  }

  export type AttachmentAggregateArgs = {
    /**
     * Filter which Attachment to aggregate.
     * 
    **/
    where?: AttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Attachments to fetch.
     * 
    **/
    orderBy?: Enumerable<AttachmentOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     * 
    **/
    cursor?: AttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Attachments from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Attachments.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Attachments
    **/
    _count?: true | AttachmentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AttachmentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AttachmentMaxAggregateInputType
  }

  export type GetAttachmentAggregateType<T extends AttachmentAggregateArgs> = {
        [P in keyof T & keyof AggregateAttachment]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAttachment[P]>
      : GetScalarType<T[P], AggregateAttachment[P]>
  }




  export type AttachmentGroupByArgs = {
    where?: AttachmentWhereInput
    orderBy?: Enumerable<AttachmentOrderByWithAggregationInput>
    by: Array<AttachmentScalarFieldEnum>
    having?: AttachmentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AttachmentCountAggregateInputType | true
    _min?: AttachmentMinAggregateInputType
    _max?: AttachmentMaxAggregateInputType
  }


  export type AttachmentGroupByOutputType = {
    id: string
    name: string
    originalName: string
    description: string | null
    type: AttachmentType
    questionId: string | null
    ownerId: string
    _count: AttachmentCountAggregateOutputType | null
    _min: AttachmentMinAggregateOutputType | null
    _max: AttachmentMaxAggregateOutputType | null
  }

  type GetAttachmentGroupByPayload<T extends AttachmentGroupByArgs> = PrismaPromise<
    Array<
      PickArray<AttachmentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AttachmentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AttachmentGroupByOutputType[P]>
            : GetScalarType<T[P], AttachmentGroupByOutputType[P]>
        }
      >
    >


  export type AttachmentSelect = {
    id?: boolean
    name?: boolean
    originalName?: boolean
    description?: boolean
    type?: boolean
    question?: boolean | QuestionArgs
    questionId?: boolean
    owner?: boolean | UserArgs
    ownerId?: boolean
  }

  export type AttachmentInclude = {
    question?: boolean | QuestionArgs
    owner?: boolean | UserArgs
  }

  export type AttachmentGetPayload<
    S extends boolean | null | undefined | AttachmentArgs,
    U = keyof S
      > = S extends true
        ? Attachment
    : S extends undefined
    ? never
    : S extends AttachmentArgs | AttachmentFindManyArgs
    ?'include' extends U
    ? Attachment  & {
    [P in TrueKeys<S['include']>]:
        P extends 'question' ? QuestionGetPayload<S['include'][P]> | null :
        P extends 'owner' ? UserGetPayload<S['include'][P]> :  never
  } 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
        P extends 'question' ? QuestionGetPayload<S['select'][P]> | null :
        P extends 'owner' ? UserGetPayload<S['select'][P]> :  P extends keyof Attachment ? Attachment[P] : never
  } 
    : Attachment
  : Attachment


  type AttachmentCountArgs = Merge<
    Omit<AttachmentFindManyArgs, 'select' | 'include'> & {
      select?: AttachmentCountAggregateInputType | true
    }
  >

  export interface AttachmentDelegate<GlobalRejectSettings> {
    /**
     * Find zero or one Attachment that matches the filter.
     * @param {AttachmentFindUniqueArgs} args - Arguments to find a Attachment
     * @example
     * // Get one Attachment
     * const attachment = await prisma.attachment.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends AttachmentFindUniqueArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args: SelectSubset<T, AttachmentFindUniqueArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findUnique', 'Attachment'> extends True ? CheckSelect<T, Prisma__AttachmentClient<Attachment>, Prisma__AttachmentClient<AttachmentGetPayload<T>>> : CheckSelect<T, Prisma__AttachmentClient<Attachment | null >, Prisma__AttachmentClient<AttachmentGetPayload<T> | null >>

    /**
     * Find the first Attachment that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AttachmentFindFirstArgs} args - Arguments to find a Attachment
     * @example
     * // Get one Attachment
     * const attachment = await prisma.attachment.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends AttachmentFindFirstArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args?: SelectSubset<T, AttachmentFindFirstArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findFirst', 'Attachment'> extends True ? CheckSelect<T, Prisma__AttachmentClient<Attachment>, Prisma__AttachmentClient<AttachmentGetPayload<T>>> : CheckSelect<T, Prisma__AttachmentClient<Attachment | null >, Prisma__AttachmentClient<AttachmentGetPayload<T> | null >>

    /**
     * Find zero or more Attachments that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AttachmentFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Attachments
     * const attachments = await prisma.attachment.findMany()
     * 
     * // Get first 10 Attachments
     * const attachments = await prisma.attachment.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const attachmentWithIdOnly = await prisma.attachment.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends AttachmentFindManyArgs>(
      args?: SelectSubset<T, AttachmentFindManyArgs>
    ): CheckSelect<T, PrismaPromise<Array<Attachment>>, PrismaPromise<Array<AttachmentGetPayload<T>>>>

    /**
     * Create a Attachment.
     * @param {AttachmentCreateArgs} args - Arguments to create a Attachment.
     * @example
     * // Create one Attachment
     * const Attachment = await prisma.attachment.create({
     *   data: {
     *     // ... data to create a Attachment
     *   }
     * })
     * 
    **/
    create<T extends AttachmentCreateArgs>(
      args: SelectSubset<T, AttachmentCreateArgs>
    ): CheckSelect<T, Prisma__AttachmentClient<Attachment>, Prisma__AttachmentClient<AttachmentGetPayload<T>>>

    /**
     * Create many Attachments.
     *     @param {AttachmentCreateManyArgs} args - Arguments to create many Attachments.
     *     @example
     *     // Create many Attachments
     *     const attachment = await prisma.attachment.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends AttachmentCreateManyArgs>(
      args?: SelectSubset<T, AttachmentCreateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Delete a Attachment.
     * @param {AttachmentDeleteArgs} args - Arguments to delete one Attachment.
     * @example
     * // Delete one Attachment
     * const Attachment = await prisma.attachment.delete({
     *   where: {
     *     // ... filter to delete one Attachment
     *   }
     * })
     * 
    **/
    delete<T extends AttachmentDeleteArgs>(
      args: SelectSubset<T, AttachmentDeleteArgs>
    ): CheckSelect<T, Prisma__AttachmentClient<Attachment>, Prisma__AttachmentClient<AttachmentGetPayload<T>>>

    /**
     * Update one Attachment.
     * @param {AttachmentUpdateArgs} args - Arguments to update one Attachment.
     * @example
     * // Update one Attachment
     * const attachment = await prisma.attachment.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends AttachmentUpdateArgs>(
      args: SelectSubset<T, AttachmentUpdateArgs>
    ): CheckSelect<T, Prisma__AttachmentClient<Attachment>, Prisma__AttachmentClient<AttachmentGetPayload<T>>>

    /**
     * Delete zero or more Attachments.
     * @param {AttachmentDeleteManyArgs} args - Arguments to filter Attachments to delete.
     * @example
     * // Delete a few Attachments
     * const { count } = await prisma.attachment.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends AttachmentDeleteManyArgs>(
      args?: SelectSubset<T, AttachmentDeleteManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Update zero or more Attachments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AttachmentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Attachments
     * const attachment = await prisma.attachment.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends AttachmentUpdateManyArgs>(
      args: SelectSubset<T, AttachmentUpdateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Create or update one Attachment.
     * @param {AttachmentUpsertArgs} args - Arguments to update or create a Attachment.
     * @example
     * // Update or create a Attachment
     * const attachment = await prisma.attachment.upsert({
     *   create: {
     *     // ... data to create a Attachment
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Attachment we want to update
     *   }
     * })
    **/
    upsert<T extends AttachmentUpsertArgs>(
      args: SelectSubset<T, AttachmentUpsertArgs>
    ): CheckSelect<T, Prisma__AttachmentClient<Attachment>, Prisma__AttachmentClient<AttachmentGetPayload<T>>>

    /**
     * Find one Attachment that matches the filter or throw
     * `NotFoundError` if no matches were found.
     * @param {AttachmentFindUniqueOrThrowArgs} args - Arguments to find a Attachment
     * @example
     * // Get one Attachment
     * const attachment = await prisma.attachment.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends AttachmentFindUniqueOrThrowArgs>(
      args?: SelectSubset<T, AttachmentFindUniqueOrThrowArgs>
    ): CheckSelect<T, Prisma__AttachmentClient<Attachment>, Prisma__AttachmentClient<AttachmentGetPayload<T>>>

    /**
     * Find the first Attachment that matches the filter or
     * throw `NotFoundError` if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AttachmentFindFirstOrThrowArgs} args - Arguments to find a Attachment
     * @example
     * // Get one Attachment
     * const attachment = await prisma.attachment.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends AttachmentFindFirstOrThrowArgs>(
      args?: SelectSubset<T, AttachmentFindFirstOrThrowArgs>
    ): CheckSelect<T, Prisma__AttachmentClient<Attachment>, Prisma__AttachmentClient<AttachmentGetPayload<T>>>

    /**
     * Count the number of Attachments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AttachmentCountArgs} args - Arguments to filter Attachments to count.
     * @example
     * // Count the number of Attachments
     * const count = await prisma.attachment.count({
     *   where: {
     *     // ... the filter for the Attachments we want to count
     *   }
     * })
    **/
    count<T extends AttachmentCountArgs>(
      args?: Subset<T, AttachmentCountArgs>,
    ): PrismaPromise<
      T extends _Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AttachmentCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Attachment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AttachmentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AttachmentAggregateArgs>(args: Subset<T, AttachmentAggregateArgs>): PrismaPromise<GetAttachmentAggregateType<T>>

    /**
     * Group by Attachment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AttachmentGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AttachmentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AttachmentGroupByArgs['orderBy'] }
        : { orderBy?: AttachmentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends TupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AttachmentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAttachmentGroupByPayload<T> : PrismaPromise<InputErrors>
  }

  /**
   * The delegate class that acts as a "Promise-like" for Attachment.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__AttachmentClient<T> implements PrismaPromise<T> {
    [prisma]: true;
    private readonly _dmmf;
    private readonly _fetcher;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    constructor(_dmmf: runtime.DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
    readonly [Symbol.toStringTag]: 'PrismaClientPromise';

    question<T extends QuestionArgs = {}>(args?: Subset<T, QuestionArgs>): CheckSelect<T, Prisma__QuestionClient<Question | null >, Prisma__QuestionClient<QuestionGetPayload<T> | null >>;

    owner<T extends UserArgs = {}>(args?: Subset<T, UserArgs>): CheckSelect<T, Prisma__UserClient<User | null >, Prisma__UserClient<UserGetPayload<T> | null >>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }

  // Custom InputTypes

  /**
   * Attachment base type for findUnique actions
   */
  export type AttachmentFindUniqueArgsBase = {
    /**
     * Select specific fields to fetch from the Attachment
     * 
    **/
    select?: AttachmentSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AttachmentInclude | null
    /**
     * Filter, which Attachment to fetch.
     * 
    **/
    where: AttachmentWhereUniqueInput
  }

  /**
   * Attachment: findUnique
   */
  export interface AttachmentFindUniqueArgs extends AttachmentFindUniqueArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findUniqueOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * Attachment base type for findFirst actions
   */
  export type AttachmentFindFirstArgsBase = {
    /**
     * Select specific fields to fetch from the Attachment
     * 
    **/
    select?: AttachmentSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AttachmentInclude | null
    /**
     * Filter, which Attachment to fetch.
     * 
    **/
    where?: AttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Attachments to fetch.
     * 
    **/
    orderBy?: Enumerable<AttachmentOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Attachments.
     * 
    **/
    cursor?: AttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Attachments from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Attachments.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Attachments.
     * 
    **/
    distinct?: Enumerable<AttachmentScalarFieldEnum>
  }

  /**
   * Attachment: findFirst
   */
  export interface AttachmentFindFirstArgs extends AttachmentFindFirstArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findFirstOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * Attachment findMany
   */
  export type AttachmentFindManyArgs = {
    /**
     * Select specific fields to fetch from the Attachment
     * 
    **/
    select?: AttachmentSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AttachmentInclude | null
    /**
     * Filter, which Attachments to fetch.
     * 
    **/
    where?: AttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Attachments to fetch.
     * 
    **/
    orderBy?: Enumerable<AttachmentOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Attachments.
     * 
    **/
    cursor?: AttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Attachments from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Attachments.
     * 
    **/
    skip?: number
    distinct?: Enumerable<AttachmentScalarFieldEnum>
  }


  /**
   * Attachment create
   */
  export type AttachmentCreateArgs = {
    /**
     * Select specific fields to fetch from the Attachment
     * 
    **/
    select?: AttachmentSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AttachmentInclude | null
    /**
     * The data needed to create a Attachment.
     * 
    **/
    data: XOR<AttachmentCreateInput, AttachmentUncheckedCreateInput>
  }


  /**
   * Attachment createMany
   */
  export type AttachmentCreateManyArgs = {
    /**
     * The data used to create many Attachments.
     * 
    **/
    data: Enumerable<AttachmentCreateManyInput>
    skipDuplicates?: boolean
  }


  /**
   * Attachment update
   */
  export type AttachmentUpdateArgs = {
    /**
     * Select specific fields to fetch from the Attachment
     * 
    **/
    select?: AttachmentSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AttachmentInclude | null
    /**
     * The data needed to update a Attachment.
     * 
    **/
    data: XOR<AttachmentUpdateInput, AttachmentUncheckedUpdateInput>
    /**
     * Choose, which Attachment to update.
     * 
    **/
    where: AttachmentWhereUniqueInput
  }


  /**
   * Attachment updateMany
   */
  export type AttachmentUpdateManyArgs = {
    /**
     * The data used to update Attachments.
     * 
    **/
    data: XOR<AttachmentUpdateManyMutationInput, AttachmentUncheckedUpdateManyInput>
    /**
     * Filter which Attachments to update
     * 
    **/
    where?: AttachmentWhereInput
  }


  /**
   * Attachment upsert
   */
  export type AttachmentUpsertArgs = {
    /**
     * Select specific fields to fetch from the Attachment
     * 
    **/
    select?: AttachmentSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AttachmentInclude | null
    /**
     * The filter to search for the Attachment to update in case it exists.
     * 
    **/
    where: AttachmentWhereUniqueInput
    /**
     * In case the Attachment found by the `where` argument doesn't exist, create a new Attachment with this data.
     * 
    **/
    create: XOR<AttachmentCreateInput, AttachmentUncheckedCreateInput>
    /**
     * In case the Attachment was found with the provided `where` argument, update it with this data.
     * 
    **/
    update: XOR<AttachmentUpdateInput, AttachmentUncheckedUpdateInput>
  }


  /**
   * Attachment delete
   */
  export type AttachmentDeleteArgs = {
    /**
     * Select specific fields to fetch from the Attachment
     * 
    **/
    select?: AttachmentSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AttachmentInclude | null
    /**
     * Filter which Attachment to delete.
     * 
    **/
    where: AttachmentWhereUniqueInput
  }


  /**
   * Attachment deleteMany
   */
  export type AttachmentDeleteManyArgs = {
    /**
     * Filter which Attachments to delete
     * 
    **/
    where?: AttachmentWhereInput
  }


  /**
   * Attachment: findUniqueOrThrow
   */
  export type AttachmentFindUniqueOrThrowArgs = AttachmentFindUniqueArgsBase
      

  /**
   * Attachment: findFirstOrThrow
   */
  export type AttachmentFindFirstOrThrowArgs = AttachmentFindFirstArgsBase
      

  /**
   * Attachment without action
   */
  export type AttachmentArgs = {
    /**
     * Select specific fields to fetch from the Attachment
     * 
    **/
    select?: AttachmentSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: AttachmentInclude | null
  }



  /**
   * Model Question
   */


  export type AggregateQuestion = {
    _count: QuestionCountAggregateOutputType | null
    _min: QuestionMinAggregateOutputType | null
    _max: QuestionMaxAggregateOutputType | null
  }

  export type QuestionMinAggregateOutputType = {
    id: string | null
    isArchived: boolean | null
    isDeleted: boolean | null
    name: string | null
    content: string | null
    contentPlain: string | null
    type: QuestionType | null
    ownerId: string | null
  }

  export type QuestionMaxAggregateOutputType = {
    id: string | null
    isArchived: boolean | null
    isDeleted: boolean | null
    name: string | null
    content: string | null
    contentPlain: string | null
    type: QuestionType | null
    ownerId: string | null
  }

  export type QuestionCountAggregateOutputType = {
    id: number
    isArchived: number
    isDeleted: number
    name: number
    content: number
    contentPlain: number
    options: number
    type: number
    ownerId: number
    _all: number
  }


  export type QuestionMinAggregateInputType = {
    id?: true
    isArchived?: true
    isDeleted?: true
    name?: true
    content?: true
    contentPlain?: true
    type?: true
    ownerId?: true
  }

  export type QuestionMaxAggregateInputType = {
    id?: true
    isArchived?: true
    isDeleted?: true
    name?: true
    content?: true
    contentPlain?: true
    type?: true
    ownerId?: true
  }

  export type QuestionCountAggregateInputType = {
    id?: true
    isArchived?: true
    isDeleted?: true
    name?: true
    content?: true
    contentPlain?: true
    options?: true
    type?: true
    ownerId?: true
    _all?: true
  }

  export type QuestionAggregateArgs = {
    /**
     * Filter which Question to aggregate.
     * 
    **/
    where?: QuestionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Questions to fetch.
     * 
    **/
    orderBy?: Enumerable<QuestionOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     * 
    **/
    cursor?: QuestionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Questions from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Questions.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Questions
    **/
    _count?: true | QuestionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: QuestionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: QuestionMaxAggregateInputType
  }

  export type GetQuestionAggregateType<T extends QuestionAggregateArgs> = {
        [P in keyof T & keyof AggregateQuestion]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateQuestion[P]>
      : GetScalarType<T[P], AggregateQuestion[P]>
  }




  export type QuestionGroupByArgs = {
    where?: QuestionWhereInput
    orderBy?: Enumerable<QuestionOrderByWithAggregationInput>
    by: Array<QuestionScalarFieldEnum>
    having?: QuestionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: QuestionCountAggregateInputType | true
    _min?: QuestionMinAggregateInputType
    _max?: QuestionMaxAggregateInputType
  }


  export type QuestionGroupByOutputType = {
    id: string
    isArchived: boolean
    isDeleted: boolean
    name: string
    content: string
    contentPlain: string
    options: JsonValue
    type: QuestionType
    ownerId: string
    _count: QuestionCountAggregateOutputType | null
    _min: QuestionMinAggregateOutputType | null
    _max: QuestionMaxAggregateOutputType | null
  }

  type GetQuestionGroupByPayload<T extends QuestionGroupByArgs> = PrismaPromise<
    Array<
      PickArray<QuestionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof QuestionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], QuestionGroupByOutputType[P]>
            : GetScalarType<T[P], QuestionGroupByOutputType[P]>
        }
      >
    >


  export type QuestionSelect = {
    id?: boolean
    isArchived?: boolean
    isDeleted?: boolean
    name?: boolean
    content?: boolean
    contentPlain?: boolean
    options?: boolean
    type?: boolean
    attachments?: boolean | AttachmentFindManyArgs
    tags?: boolean | TagFindManyArgs
    instances?: boolean | QuestionInstanceFindManyArgs
    owner?: boolean | UserArgs
    ownerId?: boolean
    _count?: boolean | QuestionCountOutputTypeArgs
  }

  export type QuestionInclude = {
    attachments?: boolean | AttachmentFindManyArgs
    tags?: boolean | TagFindManyArgs
    instances?: boolean | QuestionInstanceFindManyArgs
    owner?: boolean | UserArgs
    _count?: boolean | QuestionCountOutputTypeArgs
  }

  export type QuestionGetPayload<
    S extends boolean | null | undefined | QuestionArgs,
    U = keyof S
      > = S extends true
        ? Question
    : S extends undefined
    ? never
    : S extends QuestionArgs | QuestionFindManyArgs
    ?'include' extends U
    ? Question  & {
    [P in TrueKeys<S['include']>]:
        P extends 'attachments' ? Array < AttachmentGetPayload<S['include'][P]>>  :
        P extends 'tags' ? Array < TagGetPayload<S['include'][P]>>  :
        P extends 'instances' ? Array < QuestionInstanceGetPayload<S['include'][P]>>  :
        P extends 'owner' ? UserGetPayload<S['include'][P]> :
        P extends '_count' ? QuestionCountOutputTypeGetPayload<S['include'][P]> :  never
  } 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
        P extends 'attachments' ? Array < AttachmentGetPayload<S['select'][P]>>  :
        P extends 'tags' ? Array < TagGetPayload<S['select'][P]>>  :
        P extends 'instances' ? Array < QuestionInstanceGetPayload<S['select'][P]>>  :
        P extends 'owner' ? UserGetPayload<S['select'][P]> :
        P extends '_count' ? QuestionCountOutputTypeGetPayload<S['select'][P]> :  P extends keyof Question ? Question[P] : never
  } 
    : Question
  : Question


  type QuestionCountArgs = Merge<
    Omit<QuestionFindManyArgs, 'select' | 'include'> & {
      select?: QuestionCountAggregateInputType | true
    }
  >

  export interface QuestionDelegate<GlobalRejectSettings> {
    /**
     * Find zero or one Question that matches the filter.
     * @param {QuestionFindUniqueArgs} args - Arguments to find a Question
     * @example
     * // Get one Question
     * const question = await prisma.question.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends QuestionFindUniqueArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args: SelectSubset<T, QuestionFindUniqueArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findUnique', 'Question'> extends True ? CheckSelect<T, Prisma__QuestionClient<Question>, Prisma__QuestionClient<QuestionGetPayload<T>>> : CheckSelect<T, Prisma__QuestionClient<Question | null >, Prisma__QuestionClient<QuestionGetPayload<T> | null >>

    /**
     * Find the first Question that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuestionFindFirstArgs} args - Arguments to find a Question
     * @example
     * // Get one Question
     * const question = await prisma.question.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends QuestionFindFirstArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args?: SelectSubset<T, QuestionFindFirstArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findFirst', 'Question'> extends True ? CheckSelect<T, Prisma__QuestionClient<Question>, Prisma__QuestionClient<QuestionGetPayload<T>>> : CheckSelect<T, Prisma__QuestionClient<Question | null >, Prisma__QuestionClient<QuestionGetPayload<T> | null >>

    /**
     * Find zero or more Questions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuestionFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Questions
     * const questions = await prisma.question.findMany()
     * 
     * // Get first 10 Questions
     * const questions = await prisma.question.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const questionWithIdOnly = await prisma.question.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends QuestionFindManyArgs>(
      args?: SelectSubset<T, QuestionFindManyArgs>
    ): CheckSelect<T, PrismaPromise<Array<Question>>, PrismaPromise<Array<QuestionGetPayload<T>>>>

    /**
     * Create a Question.
     * @param {QuestionCreateArgs} args - Arguments to create a Question.
     * @example
     * // Create one Question
     * const Question = await prisma.question.create({
     *   data: {
     *     // ... data to create a Question
     *   }
     * })
     * 
    **/
    create<T extends QuestionCreateArgs>(
      args: SelectSubset<T, QuestionCreateArgs>
    ): CheckSelect<T, Prisma__QuestionClient<Question>, Prisma__QuestionClient<QuestionGetPayload<T>>>

    /**
     * Create many Questions.
     *     @param {QuestionCreateManyArgs} args - Arguments to create many Questions.
     *     @example
     *     // Create many Questions
     *     const question = await prisma.question.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends QuestionCreateManyArgs>(
      args?: SelectSubset<T, QuestionCreateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Delete a Question.
     * @param {QuestionDeleteArgs} args - Arguments to delete one Question.
     * @example
     * // Delete one Question
     * const Question = await prisma.question.delete({
     *   where: {
     *     // ... filter to delete one Question
     *   }
     * })
     * 
    **/
    delete<T extends QuestionDeleteArgs>(
      args: SelectSubset<T, QuestionDeleteArgs>
    ): CheckSelect<T, Prisma__QuestionClient<Question>, Prisma__QuestionClient<QuestionGetPayload<T>>>

    /**
     * Update one Question.
     * @param {QuestionUpdateArgs} args - Arguments to update one Question.
     * @example
     * // Update one Question
     * const question = await prisma.question.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends QuestionUpdateArgs>(
      args: SelectSubset<T, QuestionUpdateArgs>
    ): CheckSelect<T, Prisma__QuestionClient<Question>, Prisma__QuestionClient<QuestionGetPayload<T>>>

    /**
     * Delete zero or more Questions.
     * @param {QuestionDeleteManyArgs} args - Arguments to filter Questions to delete.
     * @example
     * // Delete a few Questions
     * const { count } = await prisma.question.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends QuestionDeleteManyArgs>(
      args?: SelectSubset<T, QuestionDeleteManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Update zero or more Questions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuestionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Questions
     * const question = await prisma.question.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends QuestionUpdateManyArgs>(
      args: SelectSubset<T, QuestionUpdateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Create or update one Question.
     * @param {QuestionUpsertArgs} args - Arguments to update or create a Question.
     * @example
     * // Update or create a Question
     * const question = await prisma.question.upsert({
     *   create: {
     *     // ... data to create a Question
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Question we want to update
     *   }
     * })
    **/
    upsert<T extends QuestionUpsertArgs>(
      args: SelectSubset<T, QuestionUpsertArgs>
    ): CheckSelect<T, Prisma__QuestionClient<Question>, Prisma__QuestionClient<QuestionGetPayload<T>>>

    /**
     * Find one Question that matches the filter or throw
     * `NotFoundError` if no matches were found.
     * @param {QuestionFindUniqueOrThrowArgs} args - Arguments to find a Question
     * @example
     * // Get one Question
     * const question = await prisma.question.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends QuestionFindUniqueOrThrowArgs>(
      args?: SelectSubset<T, QuestionFindUniqueOrThrowArgs>
    ): CheckSelect<T, Prisma__QuestionClient<Question>, Prisma__QuestionClient<QuestionGetPayload<T>>>

    /**
     * Find the first Question that matches the filter or
     * throw `NotFoundError` if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuestionFindFirstOrThrowArgs} args - Arguments to find a Question
     * @example
     * // Get one Question
     * const question = await prisma.question.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends QuestionFindFirstOrThrowArgs>(
      args?: SelectSubset<T, QuestionFindFirstOrThrowArgs>
    ): CheckSelect<T, Prisma__QuestionClient<Question>, Prisma__QuestionClient<QuestionGetPayload<T>>>

    /**
     * Count the number of Questions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuestionCountArgs} args - Arguments to filter Questions to count.
     * @example
     * // Count the number of Questions
     * const count = await prisma.question.count({
     *   where: {
     *     // ... the filter for the Questions we want to count
     *   }
     * })
    **/
    count<T extends QuestionCountArgs>(
      args?: Subset<T, QuestionCountArgs>,
    ): PrismaPromise<
      T extends _Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], QuestionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Question.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuestionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends QuestionAggregateArgs>(args: Subset<T, QuestionAggregateArgs>): PrismaPromise<GetQuestionAggregateType<T>>

    /**
     * Group by Question.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuestionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends QuestionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: QuestionGroupByArgs['orderBy'] }
        : { orderBy?: QuestionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends TupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, QuestionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetQuestionGroupByPayload<T> : PrismaPromise<InputErrors>
  }

  /**
   * The delegate class that acts as a "Promise-like" for Question.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__QuestionClient<T> implements PrismaPromise<T> {
    [prisma]: true;
    private readonly _dmmf;
    private readonly _fetcher;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    constructor(_dmmf: runtime.DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
    readonly [Symbol.toStringTag]: 'PrismaClientPromise';

    attachments<T extends AttachmentFindManyArgs = {}>(args?: Subset<T, AttachmentFindManyArgs>): CheckSelect<T, PrismaPromise<Array<Attachment>>, PrismaPromise<Array<AttachmentGetPayload<T>>>>;

    tags<T extends TagFindManyArgs = {}>(args?: Subset<T, TagFindManyArgs>): CheckSelect<T, PrismaPromise<Array<Tag>>, PrismaPromise<Array<TagGetPayload<T>>>>;

    instances<T extends QuestionInstanceFindManyArgs = {}>(args?: Subset<T, QuestionInstanceFindManyArgs>): CheckSelect<T, PrismaPromise<Array<QuestionInstance>>, PrismaPromise<Array<QuestionInstanceGetPayload<T>>>>;

    owner<T extends UserArgs = {}>(args?: Subset<T, UserArgs>): CheckSelect<T, Prisma__UserClient<User | null >, Prisma__UserClient<UserGetPayload<T> | null >>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }

  // Custom InputTypes

  /**
   * Question base type for findUnique actions
   */
  export type QuestionFindUniqueArgsBase = {
    /**
     * Select specific fields to fetch from the Question
     * 
    **/
    select?: QuestionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInclude | null
    /**
     * Filter, which Question to fetch.
     * 
    **/
    where: QuestionWhereUniqueInput
  }

  /**
   * Question: findUnique
   */
  export interface QuestionFindUniqueArgs extends QuestionFindUniqueArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findUniqueOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * Question base type for findFirst actions
   */
  export type QuestionFindFirstArgsBase = {
    /**
     * Select specific fields to fetch from the Question
     * 
    **/
    select?: QuestionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInclude | null
    /**
     * Filter, which Question to fetch.
     * 
    **/
    where?: QuestionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Questions to fetch.
     * 
    **/
    orderBy?: Enumerable<QuestionOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Questions.
     * 
    **/
    cursor?: QuestionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Questions from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Questions.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Questions.
     * 
    **/
    distinct?: Enumerable<QuestionScalarFieldEnum>
  }

  /**
   * Question: findFirst
   */
  export interface QuestionFindFirstArgs extends QuestionFindFirstArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findFirstOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * Question findMany
   */
  export type QuestionFindManyArgs = {
    /**
     * Select specific fields to fetch from the Question
     * 
    **/
    select?: QuestionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInclude | null
    /**
     * Filter, which Questions to fetch.
     * 
    **/
    where?: QuestionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Questions to fetch.
     * 
    **/
    orderBy?: Enumerable<QuestionOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Questions.
     * 
    **/
    cursor?: QuestionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Questions from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Questions.
     * 
    **/
    skip?: number
    distinct?: Enumerable<QuestionScalarFieldEnum>
  }


  /**
   * Question create
   */
  export type QuestionCreateArgs = {
    /**
     * Select specific fields to fetch from the Question
     * 
    **/
    select?: QuestionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInclude | null
    /**
     * The data needed to create a Question.
     * 
    **/
    data: XOR<QuestionCreateInput, QuestionUncheckedCreateInput>
  }


  /**
   * Question createMany
   */
  export type QuestionCreateManyArgs = {
    /**
     * The data used to create many Questions.
     * 
    **/
    data: Enumerable<QuestionCreateManyInput>
    skipDuplicates?: boolean
  }


  /**
   * Question update
   */
  export type QuestionUpdateArgs = {
    /**
     * Select specific fields to fetch from the Question
     * 
    **/
    select?: QuestionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInclude | null
    /**
     * The data needed to update a Question.
     * 
    **/
    data: XOR<QuestionUpdateInput, QuestionUncheckedUpdateInput>
    /**
     * Choose, which Question to update.
     * 
    **/
    where: QuestionWhereUniqueInput
  }


  /**
   * Question updateMany
   */
  export type QuestionUpdateManyArgs = {
    /**
     * The data used to update Questions.
     * 
    **/
    data: XOR<QuestionUpdateManyMutationInput, QuestionUncheckedUpdateManyInput>
    /**
     * Filter which Questions to update
     * 
    **/
    where?: QuestionWhereInput
  }


  /**
   * Question upsert
   */
  export type QuestionUpsertArgs = {
    /**
     * Select specific fields to fetch from the Question
     * 
    **/
    select?: QuestionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInclude | null
    /**
     * The filter to search for the Question to update in case it exists.
     * 
    **/
    where: QuestionWhereUniqueInput
    /**
     * In case the Question found by the `where` argument doesn't exist, create a new Question with this data.
     * 
    **/
    create: XOR<QuestionCreateInput, QuestionUncheckedCreateInput>
    /**
     * In case the Question was found with the provided `where` argument, update it with this data.
     * 
    **/
    update: XOR<QuestionUpdateInput, QuestionUncheckedUpdateInput>
  }


  /**
   * Question delete
   */
  export type QuestionDeleteArgs = {
    /**
     * Select specific fields to fetch from the Question
     * 
    **/
    select?: QuestionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInclude | null
    /**
     * Filter which Question to delete.
     * 
    **/
    where: QuestionWhereUniqueInput
  }


  /**
   * Question deleteMany
   */
  export type QuestionDeleteManyArgs = {
    /**
     * Filter which Questions to delete
     * 
    **/
    where?: QuestionWhereInput
  }


  /**
   * Question: findUniqueOrThrow
   */
  export type QuestionFindUniqueOrThrowArgs = QuestionFindUniqueArgsBase
      

  /**
   * Question: findFirstOrThrow
   */
  export type QuestionFindFirstOrThrowArgs = QuestionFindFirstArgsBase
      

  /**
   * Question without action
   */
  export type QuestionArgs = {
    /**
     * Select specific fields to fetch from the Question
     * 
    **/
    select?: QuestionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInclude | null
  }



  /**
   * Model Tag
   */


  export type AggregateTag = {
    _count: TagCountAggregateOutputType | null
    _avg: TagAvgAggregateOutputType | null
    _sum: TagSumAggregateOutputType | null
    _min: TagMinAggregateOutputType | null
    _max: TagMaxAggregateOutputType | null
  }

  export type TagAvgAggregateOutputType = {
    id: number | null
  }

  export type TagSumAggregateOutputType = {
    id: number | null
  }

  export type TagMinAggregateOutputType = {
    id: number | null
    ownerId: string | null
  }

  export type TagMaxAggregateOutputType = {
    id: number | null
    ownerId: string | null
  }

  export type TagCountAggregateOutputType = {
    id: number
    ownerId: number
    _all: number
  }


  export type TagAvgAggregateInputType = {
    id?: true
  }

  export type TagSumAggregateInputType = {
    id?: true
  }

  export type TagMinAggregateInputType = {
    id?: true
    ownerId?: true
  }

  export type TagMaxAggregateInputType = {
    id?: true
    ownerId?: true
  }

  export type TagCountAggregateInputType = {
    id?: true
    ownerId?: true
    _all?: true
  }

  export type TagAggregateArgs = {
    /**
     * Filter which Tag to aggregate.
     * 
    **/
    where?: TagWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Tags to fetch.
     * 
    **/
    orderBy?: Enumerable<TagOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     * 
    **/
    cursor?: TagWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Tags from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Tags.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Tags
    **/
    _count?: true | TagCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TagAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TagSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TagMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TagMaxAggregateInputType
  }

  export type GetTagAggregateType<T extends TagAggregateArgs> = {
        [P in keyof T & keyof AggregateTag]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTag[P]>
      : GetScalarType<T[P], AggregateTag[P]>
  }




  export type TagGroupByArgs = {
    where?: TagWhereInput
    orderBy?: Enumerable<TagOrderByWithAggregationInput>
    by: Array<TagScalarFieldEnum>
    having?: TagScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TagCountAggregateInputType | true
    _avg?: TagAvgAggregateInputType
    _sum?: TagSumAggregateInputType
    _min?: TagMinAggregateInputType
    _max?: TagMaxAggregateInputType
  }


  export type TagGroupByOutputType = {
    id: number
    ownerId: string
    _count: TagCountAggregateOutputType | null
    _avg: TagAvgAggregateOutputType | null
    _sum: TagSumAggregateOutputType | null
    _min: TagMinAggregateOutputType | null
    _max: TagMaxAggregateOutputType | null
  }

  type GetTagGroupByPayload<T extends TagGroupByArgs> = PrismaPromise<
    Array<
      PickArray<TagGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TagGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TagGroupByOutputType[P]>
            : GetScalarType<T[P], TagGroupByOutputType[P]>
        }
      >
    >


  export type TagSelect = {
    id?: boolean
    questions?: boolean | QuestionFindManyArgs
    owner?: boolean | UserArgs
    ownerId?: boolean
    _count?: boolean | TagCountOutputTypeArgs
  }

  export type TagInclude = {
    questions?: boolean | QuestionFindManyArgs
    owner?: boolean | UserArgs
    _count?: boolean | TagCountOutputTypeArgs
  }

  export type TagGetPayload<
    S extends boolean | null | undefined | TagArgs,
    U = keyof S
      > = S extends true
        ? Tag
    : S extends undefined
    ? never
    : S extends TagArgs | TagFindManyArgs
    ?'include' extends U
    ? Tag  & {
    [P in TrueKeys<S['include']>]:
        P extends 'questions' ? Array < QuestionGetPayload<S['include'][P]>>  :
        P extends 'owner' ? UserGetPayload<S['include'][P]> :
        P extends '_count' ? TagCountOutputTypeGetPayload<S['include'][P]> :  never
  } 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
        P extends 'questions' ? Array < QuestionGetPayload<S['select'][P]>>  :
        P extends 'owner' ? UserGetPayload<S['select'][P]> :
        P extends '_count' ? TagCountOutputTypeGetPayload<S['select'][P]> :  P extends keyof Tag ? Tag[P] : never
  } 
    : Tag
  : Tag


  type TagCountArgs = Merge<
    Omit<TagFindManyArgs, 'select' | 'include'> & {
      select?: TagCountAggregateInputType | true
    }
  >

  export interface TagDelegate<GlobalRejectSettings> {
    /**
     * Find zero or one Tag that matches the filter.
     * @param {TagFindUniqueArgs} args - Arguments to find a Tag
     * @example
     * // Get one Tag
     * const tag = await prisma.tag.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends TagFindUniqueArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args: SelectSubset<T, TagFindUniqueArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findUnique', 'Tag'> extends True ? CheckSelect<T, Prisma__TagClient<Tag>, Prisma__TagClient<TagGetPayload<T>>> : CheckSelect<T, Prisma__TagClient<Tag | null >, Prisma__TagClient<TagGetPayload<T> | null >>

    /**
     * Find the first Tag that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TagFindFirstArgs} args - Arguments to find a Tag
     * @example
     * // Get one Tag
     * const tag = await prisma.tag.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends TagFindFirstArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args?: SelectSubset<T, TagFindFirstArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findFirst', 'Tag'> extends True ? CheckSelect<T, Prisma__TagClient<Tag>, Prisma__TagClient<TagGetPayload<T>>> : CheckSelect<T, Prisma__TagClient<Tag | null >, Prisma__TagClient<TagGetPayload<T> | null >>

    /**
     * Find zero or more Tags that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TagFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Tags
     * const tags = await prisma.tag.findMany()
     * 
     * // Get first 10 Tags
     * const tags = await prisma.tag.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tagWithIdOnly = await prisma.tag.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends TagFindManyArgs>(
      args?: SelectSubset<T, TagFindManyArgs>
    ): CheckSelect<T, PrismaPromise<Array<Tag>>, PrismaPromise<Array<TagGetPayload<T>>>>

    /**
     * Create a Tag.
     * @param {TagCreateArgs} args - Arguments to create a Tag.
     * @example
     * // Create one Tag
     * const Tag = await prisma.tag.create({
     *   data: {
     *     // ... data to create a Tag
     *   }
     * })
     * 
    **/
    create<T extends TagCreateArgs>(
      args: SelectSubset<T, TagCreateArgs>
    ): CheckSelect<T, Prisma__TagClient<Tag>, Prisma__TagClient<TagGetPayload<T>>>

    /**
     * Create many Tags.
     *     @param {TagCreateManyArgs} args - Arguments to create many Tags.
     *     @example
     *     // Create many Tags
     *     const tag = await prisma.tag.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends TagCreateManyArgs>(
      args?: SelectSubset<T, TagCreateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Delete a Tag.
     * @param {TagDeleteArgs} args - Arguments to delete one Tag.
     * @example
     * // Delete one Tag
     * const Tag = await prisma.tag.delete({
     *   where: {
     *     // ... filter to delete one Tag
     *   }
     * })
     * 
    **/
    delete<T extends TagDeleteArgs>(
      args: SelectSubset<T, TagDeleteArgs>
    ): CheckSelect<T, Prisma__TagClient<Tag>, Prisma__TagClient<TagGetPayload<T>>>

    /**
     * Update one Tag.
     * @param {TagUpdateArgs} args - Arguments to update one Tag.
     * @example
     * // Update one Tag
     * const tag = await prisma.tag.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends TagUpdateArgs>(
      args: SelectSubset<T, TagUpdateArgs>
    ): CheckSelect<T, Prisma__TagClient<Tag>, Prisma__TagClient<TagGetPayload<T>>>

    /**
     * Delete zero or more Tags.
     * @param {TagDeleteManyArgs} args - Arguments to filter Tags to delete.
     * @example
     * // Delete a few Tags
     * const { count } = await prisma.tag.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends TagDeleteManyArgs>(
      args?: SelectSubset<T, TagDeleteManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Update zero or more Tags.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TagUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Tags
     * const tag = await prisma.tag.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends TagUpdateManyArgs>(
      args: SelectSubset<T, TagUpdateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Create or update one Tag.
     * @param {TagUpsertArgs} args - Arguments to update or create a Tag.
     * @example
     * // Update or create a Tag
     * const tag = await prisma.tag.upsert({
     *   create: {
     *     // ... data to create a Tag
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Tag we want to update
     *   }
     * })
    **/
    upsert<T extends TagUpsertArgs>(
      args: SelectSubset<T, TagUpsertArgs>
    ): CheckSelect<T, Prisma__TagClient<Tag>, Prisma__TagClient<TagGetPayload<T>>>

    /**
     * Find one Tag that matches the filter or throw
     * `NotFoundError` if no matches were found.
     * @param {TagFindUniqueOrThrowArgs} args - Arguments to find a Tag
     * @example
     * // Get one Tag
     * const tag = await prisma.tag.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends TagFindUniqueOrThrowArgs>(
      args?: SelectSubset<T, TagFindUniqueOrThrowArgs>
    ): CheckSelect<T, Prisma__TagClient<Tag>, Prisma__TagClient<TagGetPayload<T>>>

    /**
     * Find the first Tag that matches the filter or
     * throw `NotFoundError` if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TagFindFirstOrThrowArgs} args - Arguments to find a Tag
     * @example
     * // Get one Tag
     * const tag = await prisma.tag.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends TagFindFirstOrThrowArgs>(
      args?: SelectSubset<T, TagFindFirstOrThrowArgs>
    ): CheckSelect<T, Prisma__TagClient<Tag>, Prisma__TagClient<TagGetPayload<T>>>

    /**
     * Count the number of Tags.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TagCountArgs} args - Arguments to filter Tags to count.
     * @example
     * // Count the number of Tags
     * const count = await prisma.tag.count({
     *   where: {
     *     // ... the filter for the Tags we want to count
     *   }
     * })
    **/
    count<T extends TagCountArgs>(
      args?: Subset<T, TagCountArgs>,
    ): PrismaPromise<
      T extends _Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TagCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Tag.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TagAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TagAggregateArgs>(args: Subset<T, TagAggregateArgs>): PrismaPromise<GetTagAggregateType<T>>

    /**
     * Group by Tag.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TagGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TagGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TagGroupByArgs['orderBy'] }
        : { orderBy?: TagGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends TupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TagGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTagGroupByPayload<T> : PrismaPromise<InputErrors>
  }

  /**
   * The delegate class that acts as a "Promise-like" for Tag.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__TagClient<T> implements PrismaPromise<T> {
    [prisma]: true;
    private readonly _dmmf;
    private readonly _fetcher;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    constructor(_dmmf: runtime.DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
    readonly [Symbol.toStringTag]: 'PrismaClientPromise';

    questions<T extends QuestionFindManyArgs = {}>(args?: Subset<T, QuestionFindManyArgs>): CheckSelect<T, PrismaPromise<Array<Question>>, PrismaPromise<Array<QuestionGetPayload<T>>>>;

    owner<T extends UserArgs = {}>(args?: Subset<T, UserArgs>): CheckSelect<T, Prisma__UserClient<User | null >, Prisma__UserClient<UserGetPayload<T> | null >>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }

  // Custom InputTypes

  /**
   * Tag base type for findUnique actions
   */
  export type TagFindUniqueArgsBase = {
    /**
     * Select specific fields to fetch from the Tag
     * 
    **/
    select?: TagSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: TagInclude | null
    /**
     * Filter, which Tag to fetch.
     * 
    **/
    where: TagWhereUniqueInput
  }

  /**
   * Tag: findUnique
   */
  export interface TagFindUniqueArgs extends TagFindUniqueArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findUniqueOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * Tag base type for findFirst actions
   */
  export type TagFindFirstArgsBase = {
    /**
     * Select specific fields to fetch from the Tag
     * 
    **/
    select?: TagSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: TagInclude | null
    /**
     * Filter, which Tag to fetch.
     * 
    **/
    where?: TagWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Tags to fetch.
     * 
    **/
    orderBy?: Enumerable<TagOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Tags.
     * 
    **/
    cursor?: TagWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Tags from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Tags.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Tags.
     * 
    **/
    distinct?: Enumerable<TagScalarFieldEnum>
  }

  /**
   * Tag: findFirst
   */
  export interface TagFindFirstArgs extends TagFindFirstArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findFirstOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * Tag findMany
   */
  export type TagFindManyArgs = {
    /**
     * Select specific fields to fetch from the Tag
     * 
    **/
    select?: TagSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: TagInclude | null
    /**
     * Filter, which Tags to fetch.
     * 
    **/
    where?: TagWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Tags to fetch.
     * 
    **/
    orderBy?: Enumerable<TagOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Tags.
     * 
    **/
    cursor?: TagWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Tags from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Tags.
     * 
    **/
    skip?: number
    distinct?: Enumerable<TagScalarFieldEnum>
  }


  /**
   * Tag create
   */
  export type TagCreateArgs = {
    /**
     * Select specific fields to fetch from the Tag
     * 
    **/
    select?: TagSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: TagInclude | null
    /**
     * The data needed to create a Tag.
     * 
    **/
    data: XOR<TagCreateInput, TagUncheckedCreateInput>
  }


  /**
   * Tag createMany
   */
  export type TagCreateManyArgs = {
    /**
     * The data used to create many Tags.
     * 
    **/
    data: Enumerable<TagCreateManyInput>
    skipDuplicates?: boolean
  }


  /**
   * Tag update
   */
  export type TagUpdateArgs = {
    /**
     * Select specific fields to fetch from the Tag
     * 
    **/
    select?: TagSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: TagInclude | null
    /**
     * The data needed to update a Tag.
     * 
    **/
    data: XOR<TagUpdateInput, TagUncheckedUpdateInput>
    /**
     * Choose, which Tag to update.
     * 
    **/
    where: TagWhereUniqueInput
  }


  /**
   * Tag updateMany
   */
  export type TagUpdateManyArgs = {
    /**
     * The data used to update Tags.
     * 
    **/
    data: XOR<TagUpdateManyMutationInput, TagUncheckedUpdateManyInput>
    /**
     * Filter which Tags to update
     * 
    **/
    where?: TagWhereInput
  }


  /**
   * Tag upsert
   */
  export type TagUpsertArgs = {
    /**
     * Select specific fields to fetch from the Tag
     * 
    **/
    select?: TagSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: TagInclude | null
    /**
     * The filter to search for the Tag to update in case it exists.
     * 
    **/
    where: TagWhereUniqueInput
    /**
     * In case the Tag found by the `where` argument doesn't exist, create a new Tag with this data.
     * 
    **/
    create: XOR<TagCreateInput, TagUncheckedCreateInput>
    /**
     * In case the Tag was found with the provided `where` argument, update it with this data.
     * 
    **/
    update: XOR<TagUpdateInput, TagUncheckedUpdateInput>
  }


  /**
   * Tag delete
   */
  export type TagDeleteArgs = {
    /**
     * Select specific fields to fetch from the Tag
     * 
    **/
    select?: TagSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: TagInclude | null
    /**
     * Filter which Tag to delete.
     * 
    **/
    where: TagWhereUniqueInput
  }


  /**
   * Tag deleteMany
   */
  export type TagDeleteManyArgs = {
    /**
     * Filter which Tags to delete
     * 
    **/
    where?: TagWhereInput
  }


  /**
   * Tag: findUniqueOrThrow
   */
  export type TagFindUniqueOrThrowArgs = TagFindUniqueArgsBase
      

  /**
   * Tag: findFirstOrThrow
   */
  export type TagFindFirstOrThrowArgs = TagFindFirstArgsBase
      

  /**
   * Tag without action
   */
  export type TagArgs = {
    /**
     * Select specific fields to fetch from the Tag
     * 
    **/
    select?: TagSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: TagInclude | null
  }



  /**
   * Model QuestionInstance
   */


  export type AggregateQuestionInstance = {
    _count: QuestionInstanceCountAggregateOutputType | null
    _avg: QuestionInstanceAvgAggregateOutputType | null
    _sum: QuestionInstanceSumAggregateOutputType | null
    _min: QuestionInstanceMinAggregateOutputType | null
    _max: QuestionInstanceMaxAggregateOutputType | null
  }

  export type QuestionInstanceAvgAggregateOutputType = {
    sessionBlockId: number | null
  }

  export type QuestionInstanceSumAggregateOutputType = {
    sessionBlockId: number | null
  }

  export type QuestionInstanceMinAggregateOutputType = {
    id: string | null
    sessionBlockId: number | null
    learningElementId: string | null
    microSessionId: string | null
    questionId: string | null
    ownerId: string | null
  }

  export type QuestionInstanceMaxAggregateOutputType = {
    id: string | null
    sessionBlockId: number | null
    learningElementId: string | null
    microSessionId: string | null
    questionId: string | null
    ownerId: string | null
  }

  export type QuestionInstanceCountAggregateOutputType = {
    id: number
    questionData: number
    results: number
    sessionBlockId: number
    learningElementId: number
    microSessionId: number
    questionId: number
    ownerId: number
    _all: number
  }


  export type QuestionInstanceAvgAggregateInputType = {
    sessionBlockId?: true
  }

  export type QuestionInstanceSumAggregateInputType = {
    sessionBlockId?: true
  }

  export type QuestionInstanceMinAggregateInputType = {
    id?: true
    sessionBlockId?: true
    learningElementId?: true
    microSessionId?: true
    questionId?: true
    ownerId?: true
  }

  export type QuestionInstanceMaxAggregateInputType = {
    id?: true
    sessionBlockId?: true
    learningElementId?: true
    microSessionId?: true
    questionId?: true
    ownerId?: true
  }

  export type QuestionInstanceCountAggregateInputType = {
    id?: true
    questionData?: true
    results?: true
    sessionBlockId?: true
    learningElementId?: true
    microSessionId?: true
    questionId?: true
    ownerId?: true
    _all?: true
  }

  export type QuestionInstanceAggregateArgs = {
    /**
     * Filter which QuestionInstance to aggregate.
     * 
    **/
    where?: QuestionInstanceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of QuestionInstances to fetch.
     * 
    **/
    orderBy?: Enumerable<QuestionInstanceOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     * 
    **/
    cursor?: QuestionInstanceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` QuestionInstances from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` QuestionInstances.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned QuestionInstances
    **/
    _count?: true | QuestionInstanceCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: QuestionInstanceAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: QuestionInstanceSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: QuestionInstanceMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: QuestionInstanceMaxAggregateInputType
  }

  export type GetQuestionInstanceAggregateType<T extends QuestionInstanceAggregateArgs> = {
        [P in keyof T & keyof AggregateQuestionInstance]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateQuestionInstance[P]>
      : GetScalarType<T[P], AggregateQuestionInstance[P]>
  }




  export type QuestionInstanceGroupByArgs = {
    where?: QuestionInstanceWhereInput
    orderBy?: Enumerable<QuestionInstanceOrderByWithAggregationInput>
    by: Array<QuestionInstanceScalarFieldEnum>
    having?: QuestionInstanceScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: QuestionInstanceCountAggregateInputType | true
    _avg?: QuestionInstanceAvgAggregateInputType
    _sum?: QuestionInstanceSumAggregateInputType
    _min?: QuestionInstanceMinAggregateInputType
    _max?: QuestionInstanceMaxAggregateInputType
  }


  export type QuestionInstanceGroupByOutputType = {
    id: string
    questionData: JsonValue
    results: JsonValue
    sessionBlockId: number | null
    learningElementId: string | null
    microSessionId: string | null
    questionId: string
    ownerId: string
    _count: QuestionInstanceCountAggregateOutputType | null
    _avg: QuestionInstanceAvgAggregateOutputType | null
    _sum: QuestionInstanceSumAggregateOutputType | null
    _min: QuestionInstanceMinAggregateOutputType | null
    _max: QuestionInstanceMaxAggregateOutputType | null
  }

  type GetQuestionInstanceGroupByPayload<T extends QuestionInstanceGroupByArgs> = PrismaPromise<
    Array<
      PickArray<QuestionInstanceGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof QuestionInstanceGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], QuestionInstanceGroupByOutputType[P]>
            : GetScalarType<T[P], QuestionInstanceGroupByOutputType[P]>
        }
      >
    >


  export type QuestionInstanceSelect = {
    id?: boolean
    questionData?: boolean
    results?: boolean
    sessionBlock?: boolean | SessionBlockArgs
    sessionBlockId?: boolean
    learningElement?: boolean | LearningElementArgs
    learningElementId?: boolean
    microSession?: boolean | MicroSessionArgs
    microSessionId?: boolean
    question?: boolean | QuestionArgs
    questionId?: boolean
    owner?: boolean | UserArgs
    ownerId?: boolean
  }

  export type QuestionInstanceInclude = {
    sessionBlock?: boolean | SessionBlockArgs
    learningElement?: boolean | LearningElementArgs
    microSession?: boolean | MicroSessionArgs
    question?: boolean | QuestionArgs
    owner?: boolean | UserArgs
  }

  export type QuestionInstanceGetPayload<
    S extends boolean | null | undefined | QuestionInstanceArgs,
    U = keyof S
      > = S extends true
        ? QuestionInstance
    : S extends undefined
    ? never
    : S extends QuestionInstanceArgs | QuestionInstanceFindManyArgs
    ?'include' extends U
    ? QuestionInstance  & {
    [P in TrueKeys<S['include']>]:
        P extends 'sessionBlock' ? SessionBlockGetPayload<S['include'][P]> | null :
        P extends 'learningElement' ? LearningElementGetPayload<S['include'][P]> | null :
        P extends 'microSession' ? MicroSessionGetPayload<S['include'][P]> | null :
        P extends 'question' ? QuestionGetPayload<S['include'][P]> :
        P extends 'owner' ? UserGetPayload<S['include'][P]> :  never
  } 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
        P extends 'sessionBlock' ? SessionBlockGetPayload<S['select'][P]> | null :
        P extends 'learningElement' ? LearningElementGetPayload<S['select'][P]> | null :
        P extends 'microSession' ? MicroSessionGetPayload<S['select'][P]> | null :
        P extends 'question' ? QuestionGetPayload<S['select'][P]> :
        P extends 'owner' ? UserGetPayload<S['select'][P]> :  P extends keyof QuestionInstance ? QuestionInstance[P] : never
  } 
    : QuestionInstance
  : QuestionInstance


  type QuestionInstanceCountArgs = Merge<
    Omit<QuestionInstanceFindManyArgs, 'select' | 'include'> & {
      select?: QuestionInstanceCountAggregateInputType | true
    }
  >

  export interface QuestionInstanceDelegate<GlobalRejectSettings> {
    /**
     * Find zero or one QuestionInstance that matches the filter.
     * @param {QuestionInstanceFindUniqueArgs} args - Arguments to find a QuestionInstance
     * @example
     * // Get one QuestionInstance
     * const questionInstance = await prisma.questionInstance.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends QuestionInstanceFindUniqueArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args: SelectSubset<T, QuestionInstanceFindUniqueArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findUnique', 'QuestionInstance'> extends True ? CheckSelect<T, Prisma__QuestionInstanceClient<QuestionInstance>, Prisma__QuestionInstanceClient<QuestionInstanceGetPayload<T>>> : CheckSelect<T, Prisma__QuestionInstanceClient<QuestionInstance | null >, Prisma__QuestionInstanceClient<QuestionInstanceGetPayload<T> | null >>

    /**
     * Find the first QuestionInstance that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuestionInstanceFindFirstArgs} args - Arguments to find a QuestionInstance
     * @example
     * // Get one QuestionInstance
     * const questionInstance = await prisma.questionInstance.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends QuestionInstanceFindFirstArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args?: SelectSubset<T, QuestionInstanceFindFirstArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findFirst', 'QuestionInstance'> extends True ? CheckSelect<T, Prisma__QuestionInstanceClient<QuestionInstance>, Prisma__QuestionInstanceClient<QuestionInstanceGetPayload<T>>> : CheckSelect<T, Prisma__QuestionInstanceClient<QuestionInstance | null >, Prisma__QuestionInstanceClient<QuestionInstanceGetPayload<T> | null >>

    /**
     * Find zero or more QuestionInstances that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuestionInstanceFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all QuestionInstances
     * const questionInstances = await prisma.questionInstance.findMany()
     * 
     * // Get first 10 QuestionInstances
     * const questionInstances = await prisma.questionInstance.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const questionInstanceWithIdOnly = await prisma.questionInstance.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends QuestionInstanceFindManyArgs>(
      args?: SelectSubset<T, QuestionInstanceFindManyArgs>
    ): CheckSelect<T, PrismaPromise<Array<QuestionInstance>>, PrismaPromise<Array<QuestionInstanceGetPayload<T>>>>

    /**
     * Create a QuestionInstance.
     * @param {QuestionInstanceCreateArgs} args - Arguments to create a QuestionInstance.
     * @example
     * // Create one QuestionInstance
     * const QuestionInstance = await prisma.questionInstance.create({
     *   data: {
     *     // ... data to create a QuestionInstance
     *   }
     * })
     * 
    **/
    create<T extends QuestionInstanceCreateArgs>(
      args: SelectSubset<T, QuestionInstanceCreateArgs>
    ): CheckSelect<T, Prisma__QuestionInstanceClient<QuestionInstance>, Prisma__QuestionInstanceClient<QuestionInstanceGetPayload<T>>>

    /**
     * Create many QuestionInstances.
     *     @param {QuestionInstanceCreateManyArgs} args - Arguments to create many QuestionInstances.
     *     @example
     *     // Create many QuestionInstances
     *     const questionInstance = await prisma.questionInstance.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends QuestionInstanceCreateManyArgs>(
      args?: SelectSubset<T, QuestionInstanceCreateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Delete a QuestionInstance.
     * @param {QuestionInstanceDeleteArgs} args - Arguments to delete one QuestionInstance.
     * @example
     * // Delete one QuestionInstance
     * const QuestionInstance = await prisma.questionInstance.delete({
     *   where: {
     *     // ... filter to delete one QuestionInstance
     *   }
     * })
     * 
    **/
    delete<T extends QuestionInstanceDeleteArgs>(
      args: SelectSubset<T, QuestionInstanceDeleteArgs>
    ): CheckSelect<T, Prisma__QuestionInstanceClient<QuestionInstance>, Prisma__QuestionInstanceClient<QuestionInstanceGetPayload<T>>>

    /**
     * Update one QuestionInstance.
     * @param {QuestionInstanceUpdateArgs} args - Arguments to update one QuestionInstance.
     * @example
     * // Update one QuestionInstance
     * const questionInstance = await prisma.questionInstance.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends QuestionInstanceUpdateArgs>(
      args: SelectSubset<T, QuestionInstanceUpdateArgs>
    ): CheckSelect<T, Prisma__QuestionInstanceClient<QuestionInstance>, Prisma__QuestionInstanceClient<QuestionInstanceGetPayload<T>>>

    /**
     * Delete zero or more QuestionInstances.
     * @param {QuestionInstanceDeleteManyArgs} args - Arguments to filter QuestionInstances to delete.
     * @example
     * // Delete a few QuestionInstances
     * const { count } = await prisma.questionInstance.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends QuestionInstanceDeleteManyArgs>(
      args?: SelectSubset<T, QuestionInstanceDeleteManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Update zero or more QuestionInstances.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuestionInstanceUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many QuestionInstances
     * const questionInstance = await prisma.questionInstance.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends QuestionInstanceUpdateManyArgs>(
      args: SelectSubset<T, QuestionInstanceUpdateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Create or update one QuestionInstance.
     * @param {QuestionInstanceUpsertArgs} args - Arguments to update or create a QuestionInstance.
     * @example
     * // Update or create a QuestionInstance
     * const questionInstance = await prisma.questionInstance.upsert({
     *   create: {
     *     // ... data to create a QuestionInstance
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the QuestionInstance we want to update
     *   }
     * })
    **/
    upsert<T extends QuestionInstanceUpsertArgs>(
      args: SelectSubset<T, QuestionInstanceUpsertArgs>
    ): CheckSelect<T, Prisma__QuestionInstanceClient<QuestionInstance>, Prisma__QuestionInstanceClient<QuestionInstanceGetPayload<T>>>

    /**
     * Find one QuestionInstance that matches the filter or throw
     * `NotFoundError` if no matches were found.
     * @param {QuestionInstanceFindUniqueOrThrowArgs} args - Arguments to find a QuestionInstance
     * @example
     * // Get one QuestionInstance
     * const questionInstance = await prisma.questionInstance.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends QuestionInstanceFindUniqueOrThrowArgs>(
      args?: SelectSubset<T, QuestionInstanceFindUniqueOrThrowArgs>
    ): CheckSelect<T, Prisma__QuestionInstanceClient<QuestionInstance>, Prisma__QuestionInstanceClient<QuestionInstanceGetPayload<T>>>

    /**
     * Find the first QuestionInstance that matches the filter or
     * throw `NotFoundError` if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuestionInstanceFindFirstOrThrowArgs} args - Arguments to find a QuestionInstance
     * @example
     * // Get one QuestionInstance
     * const questionInstance = await prisma.questionInstance.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends QuestionInstanceFindFirstOrThrowArgs>(
      args?: SelectSubset<T, QuestionInstanceFindFirstOrThrowArgs>
    ): CheckSelect<T, Prisma__QuestionInstanceClient<QuestionInstance>, Prisma__QuestionInstanceClient<QuestionInstanceGetPayload<T>>>

    /**
     * Count the number of QuestionInstances.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuestionInstanceCountArgs} args - Arguments to filter QuestionInstances to count.
     * @example
     * // Count the number of QuestionInstances
     * const count = await prisma.questionInstance.count({
     *   where: {
     *     // ... the filter for the QuestionInstances we want to count
     *   }
     * })
    **/
    count<T extends QuestionInstanceCountArgs>(
      args?: Subset<T, QuestionInstanceCountArgs>,
    ): PrismaPromise<
      T extends _Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], QuestionInstanceCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a QuestionInstance.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuestionInstanceAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends QuestionInstanceAggregateArgs>(args: Subset<T, QuestionInstanceAggregateArgs>): PrismaPromise<GetQuestionInstanceAggregateType<T>>

    /**
     * Group by QuestionInstance.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuestionInstanceGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends QuestionInstanceGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: QuestionInstanceGroupByArgs['orderBy'] }
        : { orderBy?: QuestionInstanceGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends TupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, QuestionInstanceGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetQuestionInstanceGroupByPayload<T> : PrismaPromise<InputErrors>
  }

  /**
   * The delegate class that acts as a "Promise-like" for QuestionInstance.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__QuestionInstanceClient<T> implements PrismaPromise<T> {
    [prisma]: true;
    private readonly _dmmf;
    private readonly _fetcher;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    constructor(_dmmf: runtime.DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
    readonly [Symbol.toStringTag]: 'PrismaClientPromise';

    sessionBlock<T extends SessionBlockArgs = {}>(args?: Subset<T, SessionBlockArgs>): CheckSelect<T, Prisma__SessionBlockClient<SessionBlock | null >, Prisma__SessionBlockClient<SessionBlockGetPayload<T> | null >>;

    learningElement<T extends LearningElementArgs = {}>(args?: Subset<T, LearningElementArgs>): CheckSelect<T, Prisma__LearningElementClient<LearningElement | null >, Prisma__LearningElementClient<LearningElementGetPayload<T> | null >>;

    microSession<T extends MicroSessionArgs = {}>(args?: Subset<T, MicroSessionArgs>): CheckSelect<T, Prisma__MicroSessionClient<MicroSession | null >, Prisma__MicroSessionClient<MicroSessionGetPayload<T> | null >>;

    question<T extends QuestionArgs = {}>(args?: Subset<T, QuestionArgs>): CheckSelect<T, Prisma__QuestionClient<Question | null >, Prisma__QuestionClient<QuestionGetPayload<T> | null >>;

    owner<T extends UserArgs = {}>(args?: Subset<T, UserArgs>): CheckSelect<T, Prisma__UserClient<User | null >, Prisma__UserClient<UserGetPayload<T> | null >>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }

  // Custom InputTypes

  /**
   * QuestionInstance base type for findUnique actions
   */
  export type QuestionInstanceFindUniqueArgsBase = {
    /**
     * Select specific fields to fetch from the QuestionInstance
     * 
    **/
    select?: QuestionInstanceSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInstanceInclude | null
    /**
     * Filter, which QuestionInstance to fetch.
     * 
    **/
    where: QuestionInstanceWhereUniqueInput
  }

  /**
   * QuestionInstance: findUnique
   */
  export interface QuestionInstanceFindUniqueArgs extends QuestionInstanceFindUniqueArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findUniqueOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * QuestionInstance base type for findFirst actions
   */
  export type QuestionInstanceFindFirstArgsBase = {
    /**
     * Select specific fields to fetch from the QuestionInstance
     * 
    **/
    select?: QuestionInstanceSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInstanceInclude | null
    /**
     * Filter, which QuestionInstance to fetch.
     * 
    **/
    where?: QuestionInstanceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of QuestionInstances to fetch.
     * 
    **/
    orderBy?: Enumerable<QuestionInstanceOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for QuestionInstances.
     * 
    **/
    cursor?: QuestionInstanceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` QuestionInstances from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` QuestionInstances.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of QuestionInstances.
     * 
    **/
    distinct?: Enumerable<QuestionInstanceScalarFieldEnum>
  }

  /**
   * QuestionInstance: findFirst
   */
  export interface QuestionInstanceFindFirstArgs extends QuestionInstanceFindFirstArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findFirstOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * QuestionInstance findMany
   */
  export type QuestionInstanceFindManyArgs = {
    /**
     * Select specific fields to fetch from the QuestionInstance
     * 
    **/
    select?: QuestionInstanceSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInstanceInclude | null
    /**
     * Filter, which QuestionInstances to fetch.
     * 
    **/
    where?: QuestionInstanceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of QuestionInstances to fetch.
     * 
    **/
    orderBy?: Enumerable<QuestionInstanceOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing QuestionInstances.
     * 
    **/
    cursor?: QuestionInstanceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` QuestionInstances from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` QuestionInstances.
     * 
    **/
    skip?: number
    distinct?: Enumerable<QuestionInstanceScalarFieldEnum>
  }


  /**
   * QuestionInstance create
   */
  export type QuestionInstanceCreateArgs = {
    /**
     * Select specific fields to fetch from the QuestionInstance
     * 
    **/
    select?: QuestionInstanceSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInstanceInclude | null
    /**
     * The data needed to create a QuestionInstance.
     * 
    **/
    data: XOR<QuestionInstanceCreateInput, QuestionInstanceUncheckedCreateInput>
  }


  /**
   * QuestionInstance createMany
   */
  export type QuestionInstanceCreateManyArgs = {
    /**
     * The data used to create many QuestionInstances.
     * 
    **/
    data: Enumerable<QuestionInstanceCreateManyInput>
    skipDuplicates?: boolean
  }


  /**
   * QuestionInstance update
   */
  export type QuestionInstanceUpdateArgs = {
    /**
     * Select specific fields to fetch from the QuestionInstance
     * 
    **/
    select?: QuestionInstanceSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInstanceInclude | null
    /**
     * The data needed to update a QuestionInstance.
     * 
    **/
    data: XOR<QuestionInstanceUpdateInput, QuestionInstanceUncheckedUpdateInput>
    /**
     * Choose, which QuestionInstance to update.
     * 
    **/
    where: QuestionInstanceWhereUniqueInput
  }


  /**
   * QuestionInstance updateMany
   */
  export type QuestionInstanceUpdateManyArgs = {
    /**
     * The data used to update QuestionInstances.
     * 
    **/
    data: XOR<QuestionInstanceUpdateManyMutationInput, QuestionInstanceUncheckedUpdateManyInput>
    /**
     * Filter which QuestionInstances to update
     * 
    **/
    where?: QuestionInstanceWhereInput
  }


  /**
   * QuestionInstance upsert
   */
  export type QuestionInstanceUpsertArgs = {
    /**
     * Select specific fields to fetch from the QuestionInstance
     * 
    **/
    select?: QuestionInstanceSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInstanceInclude | null
    /**
     * The filter to search for the QuestionInstance to update in case it exists.
     * 
    **/
    where: QuestionInstanceWhereUniqueInput
    /**
     * In case the QuestionInstance found by the `where` argument doesn't exist, create a new QuestionInstance with this data.
     * 
    **/
    create: XOR<QuestionInstanceCreateInput, QuestionInstanceUncheckedCreateInput>
    /**
     * In case the QuestionInstance was found with the provided `where` argument, update it with this data.
     * 
    **/
    update: XOR<QuestionInstanceUpdateInput, QuestionInstanceUncheckedUpdateInput>
  }


  /**
   * QuestionInstance delete
   */
  export type QuestionInstanceDeleteArgs = {
    /**
     * Select specific fields to fetch from the QuestionInstance
     * 
    **/
    select?: QuestionInstanceSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInstanceInclude | null
    /**
     * Filter which QuestionInstance to delete.
     * 
    **/
    where: QuestionInstanceWhereUniqueInput
  }


  /**
   * QuestionInstance deleteMany
   */
  export type QuestionInstanceDeleteManyArgs = {
    /**
     * Filter which QuestionInstances to delete
     * 
    **/
    where?: QuestionInstanceWhereInput
  }


  /**
   * QuestionInstance: findUniqueOrThrow
   */
  export type QuestionInstanceFindUniqueOrThrowArgs = QuestionInstanceFindUniqueArgsBase
      

  /**
   * QuestionInstance: findFirstOrThrow
   */
  export type QuestionInstanceFindFirstOrThrowArgs = QuestionInstanceFindFirstArgsBase
      

  /**
   * QuestionInstance without action
   */
  export type QuestionInstanceArgs = {
    /**
     * Select specific fields to fetch from the QuestionInstance
     * 
    **/
    select?: QuestionInstanceSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: QuestionInstanceInclude | null
  }



  /**
   * Model Course
   */


  export type AggregateCourse = {
    _count: CourseCountAggregateOutputType | null
    _min: CourseMinAggregateOutputType | null
    _max: CourseMaxAggregateOutputType | null
  }

  export type CourseMinAggregateOutputType = {
    id: string | null
    isArchived: boolean | null
    name: string | null
    displayName: string | null
    description: string | null
    ownerId: string | null
  }

  export type CourseMaxAggregateOutputType = {
    id: string | null
    isArchived: boolean | null
    name: string | null
    displayName: string | null
    description: string | null
    ownerId: string | null
  }

  export type CourseCountAggregateOutputType = {
    id: number
    isArchived: number
    name: number
    displayName: number
    description: number
    ownerId: number
    _all: number
  }


  export type CourseMinAggregateInputType = {
    id?: true
    isArchived?: true
    name?: true
    displayName?: true
    description?: true
    ownerId?: true
  }

  export type CourseMaxAggregateInputType = {
    id?: true
    isArchived?: true
    name?: true
    displayName?: true
    description?: true
    ownerId?: true
  }

  export type CourseCountAggregateInputType = {
    id?: true
    isArchived?: true
    name?: true
    displayName?: true
    description?: true
    ownerId?: true
    _all?: true
  }

  export type CourseAggregateArgs = {
    /**
     * Filter which Course to aggregate.
     * 
    **/
    where?: CourseWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Courses to fetch.
     * 
    **/
    orderBy?: Enumerable<CourseOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     * 
    **/
    cursor?: CourseWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Courses from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Courses.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Courses
    **/
    _count?: true | CourseCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CourseMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CourseMaxAggregateInputType
  }

  export type GetCourseAggregateType<T extends CourseAggregateArgs> = {
        [P in keyof T & keyof AggregateCourse]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCourse[P]>
      : GetScalarType<T[P], AggregateCourse[P]>
  }




  export type CourseGroupByArgs = {
    where?: CourseWhereInput
    orderBy?: Enumerable<CourseOrderByWithAggregationInput>
    by: Array<CourseScalarFieldEnum>
    having?: CourseScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CourseCountAggregateInputType | true
    _min?: CourseMinAggregateInputType
    _max?: CourseMaxAggregateInputType
  }


  export type CourseGroupByOutputType = {
    id: string
    isArchived: boolean
    name: string
    displayName: string
    description: string | null
    ownerId: string
    _count: CourseCountAggregateOutputType | null
    _min: CourseMinAggregateOutputType | null
    _max: CourseMaxAggregateOutputType | null
  }

  type GetCourseGroupByPayload<T extends CourseGroupByArgs> = PrismaPromise<
    Array<
      PickArray<CourseGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CourseGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CourseGroupByOutputType[P]>
            : GetScalarType<T[P], CourseGroupByOutputType[P]>
        }
      >
    >


  export type CourseSelect = {
    id?: boolean
    isArchived?: boolean
    name?: boolean
    displayName?: boolean
    description?: boolean
    sessions?: boolean | SessionFindManyArgs
    learningElements?: boolean | LearningElementFindManyArgs
    microSessions?: boolean | MicroSessionFindManyArgs
    owner?: boolean | UserArgs
    ownerId?: boolean
    _count?: boolean | CourseCountOutputTypeArgs
  }

  export type CourseInclude = {
    sessions?: boolean | SessionFindManyArgs
    learningElements?: boolean | LearningElementFindManyArgs
    microSessions?: boolean | MicroSessionFindManyArgs
    owner?: boolean | UserArgs
    _count?: boolean | CourseCountOutputTypeArgs
  }

  export type CourseGetPayload<
    S extends boolean | null | undefined | CourseArgs,
    U = keyof S
      > = S extends true
        ? Course
    : S extends undefined
    ? never
    : S extends CourseArgs | CourseFindManyArgs
    ?'include' extends U
    ? Course  & {
    [P in TrueKeys<S['include']>]:
        P extends 'sessions' ? Array < SessionGetPayload<S['include'][P]>>  :
        P extends 'learningElements' ? Array < LearningElementGetPayload<S['include'][P]>>  :
        P extends 'microSessions' ? Array < MicroSessionGetPayload<S['include'][P]>>  :
        P extends 'owner' ? UserGetPayload<S['include'][P]> :
        P extends '_count' ? CourseCountOutputTypeGetPayload<S['include'][P]> :  never
  } 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
        P extends 'sessions' ? Array < SessionGetPayload<S['select'][P]>>  :
        P extends 'learningElements' ? Array < LearningElementGetPayload<S['select'][P]>>  :
        P extends 'microSessions' ? Array < MicroSessionGetPayload<S['select'][P]>>  :
        P extends 'owner' ? UserGetPayload<S['select'][P]> :
        P extends '_count' ? CourseCountOutputTypeGetPayload<S['select'][P]> :  P extends keyof Course ? Course[P] : never
  } 
    : Course
  : Course


  type CourseCountArgs = Merge<
    Omit<CourseFindManyArgs, 'select' | 'include'> & {
      select?: CourseCountAggregateInputType | true
    }
  >

  export interface CourseDelegate<GlobalRejectSettings> {
    /**
     * Find zero or one Course that matches the filter.
     * @param {CourseFindUniqueArgs} args - Arguments to find a Course
     * @example
     * // Get one Course
     * const course = await prisma.course.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends CourseFindUniqueArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args: SelectSubset<T, CourseFindUniqueArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findUnique', 'Course'> extends True ? CheckSelect<T, Prisma__CourseClient<Course>, Prisma__CourseClient<CourseGetPayload<T>>> : CheckSelect<T, Prisma__CourseClient<Course | null >, Prisma__CourseClient<CourseGetPayload<T> | null >>

    /**
     * Find the first Course that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CourseFindFirstArgs} args - Arguments to find a Course
     * @example
     * // Get one Course
     * const course = await prisma.course.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends CourseFindFirstArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args?: SelectSubset<T, CourseFindFirstArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findFirst', 'Course'> extends True ? CheckSelect<T, Prisma__CourseClient<Course>, Prisma__CourseClient<CourseGetPayload<T>>> : CheckSelect<T, Prisma__CourseClient<Course | null >, Prisma__CourseClient<CourseGetPayload<T> | null >>

    /**
     * Find zero or more Courses that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CourseFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Courses
     * const courses = await prisma.course.findMany()
     * 
     * // Get first 10 Courses
     * const courses = await prisma.course.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const courseWithIdOnly = await prisma.course.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends CourseFindManyArgs>(
      args?: SelectSubset<T, CourseFindManyArgs>
    ): CheckSelect<T, PrismaPromise<Array<Course>>, PrismaPromise<Array<CourseGetPayload<T>>>>

    /**
     * Create a Course.
     * @param {CourseCreateArgs} args - Arguments to create a Course.
     * @example
     * // Create one Course
     * const Course = await prisma.course.create({
     *   data: {
     *     // ... data to create a Course
     *   }
     * })
     * 
    **/
    create<T extends CourseCreateArgs>(
      args: SelectSubset<T, CourseCreateArgs>
    ): CheckSelect<T, Prisma__CourseClient<Course>, Prisma__CourseClient<CourseGetPayload<T>>>

    /**
     * Create many Courses.
     *     @param {CourseCreateManyArgs} args - Arguments to create many Courses.
     *     @example
     *     // Create many Courses
     *     const course = await prisma.course.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends CourseCreateManyArgs>(
      args?: SelectSubset<T, CourseCreateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Delete a Course.
     * @param {CourseDeleteArgs} args - Arguments to delete one Course.
     * @example
     * // Delete one Course
     * const Course = await prisma.course.delete({
     *   where: {
     *     // ... filter to delete one Course
     *   }
     * })
     * 
    **/
    delete<T extends CourseDeleteArgs>(
      args: SelectSubset<T, CourseDeleteArgs>
    ): CheckSelect<T, Prisma__CourseClient<Course>, Prisma__CourseClient<CourseGetPayload<T>>>

    /**
     * Update one Course.
     * @param {CourseUpdateArgs} args - Arguments to update one Course.
     * @example
     * // Update one Course
     * const course = await prisma.course.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends CourseUpdateArgs>(
      args: SelectSubset<T, CourseUpdateArgs>
    ): CheckSelect<T, Prisma__CourseClient<Course>, Prisma__CourseClient<CourseGetPayload<T>>>

    /**
     * Delete zero or more Courses.
     * @param {CourseDeleteManyArgs} args - Arguments to filter Courses to delete.
     * @example
     * // Delete a few Courses
     * const { count } = await prisma.course.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends CourseDeleteManyArgs>(
      args?: SelectSubset<T, CourseDeleteManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Update zero or more Courses.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CourseUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Courses
     * const course = await prisma.course.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends CourseUpdateManyArgs>(
      args: SelectSubset<T, CourseUpdateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Create or update one Course.
     * @param {CourseUpsertArgs} args - Arguments to update or create a Course.
     * @example
     * // Update or create a Course
     * const course = await prisma.course.upsert({
     *   create: {
     *     // ... data to create a Course
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Course we want to update
     *   }
     * })
    **/
    upsert<T extends CourseUpsertArgs>(
      args: SelectSubset<T, CourseUpsertArgs>
    ): CheckSelect<T, Prisma__CourseClient<Course>, Prisma__CourseClient<CourseGetPayload<T>>>

    /**
     * Find one Course that matches the filter or throw
     * `NotFoundError` if no matches were found.
     * @param {CourseFindUniqueOrThrowArgs} args - Arguments to find a Course
     * @example
     * // Get one Course
     * const course = await prisma.course.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends CourseFindUniqueOrThrowArgs>(
      args?: SelectSubset<T, CourseFindUniqueOrThrowArgs>
    ): CheckSelect<T, Prisma__CourseClient<Course>, Prisma__CourseClient<CourseGetPayload<T>>>

    /**
     * Find the first Course that matches the filter or
     * throw `NotFoundError` if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CourseFindFirstOrThrowArgs} args - Arguments to find a Course
     * @example
     * // Get one Course
     * const course = await prisma.course.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends CourseFindFirstOrThrowArgs>(
      args?: SelectSubset<T, CourseFindFirstOrThrowArgs>
    ): CheckSelect<T, Prisma__CourseClient<Course>, Prisma__CourseClient<CourseGetPayload<T>>>

    /**
     * Count the number of Courses.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CourseCountArgs} args - Arguments to filter Courses to count.
     * @example
     * // Count the number of Courses
     * const count = await prisma.course.count({
     *   where: {
     *     // ... the filter for the Courses we want to count
     *   }
     * })
    **/
    count<T extends CourseCountArgs>(
      args?: Subset<T, CourseCountArgs>,
    ): PrismaPromise<
      T extends _Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CourseCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Course.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CourseAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CourseAggregateArgs>(args: Subset<T, CourseAggregateArgs>): PrismaPromise<GetCourseAggregateType<T>>

    /**
     * Group by Course.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CourseGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CourseGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CourseGroupByArgs['orderBy'] }
        : { orderBy?: CourseGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends TupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CourseGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCourseGroupByPayload<T> : PrismaPromise<InputErrors>
  }

  /**
   * The delegate class that acts as a "Promise-like" for Course.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__CourseClient<T> implements PrismaPromise<T> {
    [prisma]: true;
    private readonly _dmmf;
    private readonly _fetcher;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    constructor(_dmmf: runtime.DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
    readonly [Symbol.toStringTag]: 'PrismaClientPromise';

    sessions<T extends SessionFindManyArgs = {}>(args?: Subset<T, SessionFindManyArgs>): CheckSelect<T, PrismaPromise<Array<Session>>, PrismaPromise<Array<SessionGetPayload<T>>>>;

    learningElements<T extends LearningElementFindManyArgs = {}>(args?: Subset<T, LearningElementFindManyArgs>): CheckSelect<T, PrismaPromise<Array<LearningElement>>, PrismaPromise<Array<LearningElementGetPayload<T>>>>;

    microSessions<T extends MicroSessionFindManyArgs = {}>(args?: Subset<T, MicroSessionFindManyArgs>): CheckSelect<T, PrismaPromise<Array<MicroSession>>, PrismaPromise<Array<MicroSessionGetPayload<T>>>>;

    owner<T extends UserArgs = {}>(args?: Subset<T, UserArgs>): CheckSelect<T, Prisma__UserClient<User | null >, Prisma__UserClient<UserGetPayload<T> | null >>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }

  // Custom InputTypes

  /**
   * Course base type for findUnique actions
   */
  export type CourseFindUniqueArgsBase = {
    /**
     * Select specific fields to fetch from the Course
     * 
    **/
    select?: CourseSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: CourseInclude | null
    /**
     * Filter, which Course to fetch.
     * 
    **/
    where: CourseWhereUniqueInput
  }

  /**
   * Course: findUnique
   */
  export interface CourseFindUniqueArgs extends CourseFindUniqueArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findUniqueOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * Course base type for findFirst actions
   */
  export type CourseFindFirstArgsBase = {
    /**
     * Select specific fields to fetch from the Course
     * 
    **/
    select?: CourseSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: CourseInclude | null
    /**
     * Filter, which Course to fetch.
     * 
    **/
    where?: CourseWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Courses to fetch.
     * 
    **/
    orderBy?: Enumerable<CourseOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Courses.
     * 
    **/
    cursor?: CourseWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Courses from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Courses.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Courses.
     * 
    **/
    distinct?: Enumerable<CourseScalarFieldEnum>
  }

  /**
   * Course: findFirst
   */
  export interface CourseFindFirstArgs extends CourseFindFirstArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findFirstOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * Course findMany
   */
  export type CourseFindManyArgs = {
    /**
     * Select specific fields to fetch from the Course
     * 
    **/
    select?: CourseSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: CourseInclude | null
    /**
     * Filter, which Courses to fetch.
     * 
    **/
    where?: CourseWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Courses to fetch.
     * 
    **/
    orderBy?: Enumerable<CourseOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Courses.
     * 
    **/
    cursor?: CourseWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Courses from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Courses.
     * 
    **/
    skip?: number
    distinct?: Enumerable<CourseScalarFieldEnum>
  }


  /**
   * Course create
   */
  export type CourseCreateArgs = {
    /**
     * Select specific fields to fetch from the Course
     * 
    **/
    select?: CourseSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: CourseInclude | null
    /**
     * The data needed to create a Course.
     * 
    **/
    data: XOR<CourseCreateInput, CourseUncheckedCreateInput>
  }


  /**
   * Course createMany
   */
  export type CourseCreateManyArgs = {
    /**
     * The data used to create many Courses.
     * 
    **/
    data: Enumerable<CourseCreateManyInput>
    skipDuplicates?: boolean
  }


  /**
   * Course update
   */
  export type CourseUpdateArgs = {
    /**
     * Select specific fields to fetch from the Course
     * 
    **/
    select?: CourseSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: CourseInclude | null
    /**
     * The data needed to update a Course.
     * 
    **/
    data: XOR<CourseUpdateInput, CourseUncheckedUpdateInput>
    /**
     * Choose, which Course to update.
     * 
    **/
    where: CourseWhereUniqueInput
  }


  /**
   * Course updateMany
   */
  export type CourseUpdateManyArgs = {
    /**
     * The data used to update Courses.
     * 
    **/
    data: XOR<CourseUpdateManyMutationInput, CourseUncheckedUpdateManyInput>
    /**
     * Filter which Courses to update
     * 
    **/
    where?: CourseWhereInput
  }


  /**
   * Course upsert
   */
  export type CourseUpsertArgs = {
    /**
     * Select specific fields to fetch from the Course
     * 
    **/
    select?: CourseSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: CourseInclude | null
    /**
     * The filter to search for the Course to update in case it exists.
     * 
    **/
    where: CourseWhereUniqueInput
    /**
     * In case the Course found by the `where` argument doesn't exist, create a new Course with this data.
     * 
    **/
    create: XOR<CourseCreateInput, CourseUncheckedCreateInput>
    /**
     * In case the Course was found with the provided `where` argument, update it with this data.
     * 
    **/
    update: XOR<CourseUpdateInput, CourseUncheckedUpdateInput>
  }


  /**
   * Course delete
   */
  export type CourseDeleteArgs = {
    /**
     * Select specific fields to fetch from the Course
     * 
    **/
    select?: CourseSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: CourseInclude | null
    /**
     * Filter which Course to delete.
     * 
    **/
    where: CourseWhereUniqueInput
  }


  /**
   * Course deleteMany
   */
  export type CourseDeleteManyArgs = {
    /**
     * Filter which Courses to delete
     * 
    **/
    where?: CourseWhereInput
  }


  /**
   * Course: findUniqueOrThrow
   */
  export type CourseFindUniqueOrThrowArgs = CourseFindUniqueArgsBase
      

  /**
   * Course: findFirstOrThrow
   */
  export type CourseFindFirstOrThrowArgs = CourseFindFirstArgsBase
      

  /**
   * Course without action
   */
  export type CourseArgs = {
    /**
     * Select specific fields to fetch from the Course
     * 
    **/
    select?: CourseSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: CourseInclude | null
  }



  /**
   * Model Session
   */


  export type AggregateSession = {
    _count: SessionCountAggregateOutputType | null
    _avg: SessionAvgAggregateOutputType | null
    _sum: SessionSumAggregateOutputType | null
    _min: SessionMinAggregateOutputType | null
    _max: SessionMaxAggregateOutputType | null
  }

  export type SessionAvgAggregateOutputType = {
    execution: number | null
  }

  export type SessionSumAggregateOutputType = {
    execution: number | null
  }

  export type SessionMinAggregateOutputType = {
    id: string | null
    namespace: string | null
    execution: number | null
    name: string | null
    displayName: string | null
    startedAt: Date | null
    finishedAt: Date | null
    accessMode: AccessMode | null
    status: SessionStatus | null
    ownerId: string | null
    courseId: string | null
  }

  export type SessionMaxAggregateOutputType = {
    id: string | null
    namespace: string | null
    execution: number | null
    name: string | null
    displayName: string | null
    startedAt: Date | null
    finishedAt: Date | null
    accessMode: AccessMode | null
    status: SessionStatus | null
    ownerId: string | null
    courseId: string | null
  }

  export type SessionCountAggregateOutputType = {
    id: number
    namespace: number
    execution: number
    name: number
    displayName: number
    settings: number
    startedAt: number
    finishedAt: number
    accessMode: number
    status: number
    ownerId: number
    courseId: number
    _all: number
  }


  export type SessionAvgAggregateInputType = {
    execution?: true
  }

  export type SessionSumAggregateInputType = {
    execution?: true
  }

  export type SessionMinAggregateInputType = {
    id?: true
    namespace?: true
    execution?: true
    name?: true
    displayName?: true
    startedAt?: true
    finishedAt?: true
    accessMode?: true
    status?: true
    ownerId?: true
    courseId?: true
  }

  export type SessionMaxAggregateInputType = {
    id?: true
    namespace?: true
    execution?: true
    name?: true
    displayName?: true
    startedAt?: true
    finishedAt?: true
    accessMode?: true
    status?: true
    ownerId?: true
    courseId?: true
  }

  export type SessionCountAggregateInputType = {
    id?: true
    namespace?: true
    execution?: true
    name?: true
    displayName?: true
    settings?: true
    startedAt?: true
    finishedAt?: true
    accessMode?: true
    status?: true
    ownerId?: true
    courseId?: true
    _all?: true
  }

  export type SessionAggregateArgs = {
    /**
     * Filter which Session to aggregate.
     * 
    **/
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     * 
    **/
    orderBy?: Enumerable<SessionOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     * 
    **/
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Sessions
    **/
    _count?: true | SessionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: SessionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: SessionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SessionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SessionMaxAggregateInputType
  }

  export type GetSessionAggregateType<T extends SessionAggregateArgs> = {
        [P in keyof T & keyof AggregateSession]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSession[P]>
      : GetScalarType<T[P], AggregateSession[P]>
  }




  export type SessionGroupByArgs = {
    where?: SessionWhereInput
    orderBy?: Enumerable<SessionOrderByWithAggregationInput>
    by: Array<SessionScalarFieldEnum>
    having?: SessionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SessionCountAggregateInputType | true
    _avg?: SessionAvgAggregateInputType
    _sum?: SessionSumAggregateInputType
    _min?: SessionMinAggregateInputType
    _max?: SessionMaxAggregateInputType
  }


  export type SessionGroupByOutputType = {
    id: string
    namespace: string
    execution: number
    name: string
    displayName: string
    settings: JsonValue
    startedAt: Date
    finishedAt: Date
    accessMode: AccessMode
    status: SessionStatus
    ownerId: string
    courseId: string
    _count: SessionCountAggregateOutputType | null
    _avg: SessionAvgAggregateOutputType | null
    _sum: SessionSumAggregateOutputType | null
    _min: SessionMinAggregateOutputType | null
    _max: SessionMaxAggregateOutputType | null
  }

  type GetSessionGroupByPayload<T extends SessionGroupByArgs> = PrismaPromise<
    Array<
      PickArray<SessionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SessionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SessionGroupByOutputType[P]>
            : GetScalarType<T[P], SessionGroupByOutputType[P]>
        }
      >
    >


  export type SessionSelect = {
    id?: boolean
    namespace?: boolean
    execution?: boolean
    name?: boolean
    displayName?: boolean
    settings?: boolean
    startedAt?: boolean
    finishedAt?: boolean
    accessMode?: boolean
    status?: boolean
    blocks?: boolean | SessionBlockFindManyArgs
    owner?: boolean | UserArgs
    ownerId?: boolean
    course?: boolean | CourseArgs
    courseId?: boolean
    _count?: boolean | SessionCountOutputTypeArgs
  }

  export type SessionInclude = {
    blocks?: boolean | SessionBlockFindManyArgs
    owner?: boolean | UserArgs
    course?: boolean | CourseArgs
    _count?: boolean | SessionCountOutputTypeArgs
  }

  export type SessionGetPayload<
    S extends boolean | null | undefined | SessionArgs,
    U = keyof S
      > = S extends true
        ? Session
    : S extends undefined
    ? never
    : S extends SessionArgs | SessionFindManyArgs
    ?'include' extends U
    ? Session  & {
    [P in TrueKeys<S['include']>]:
        P extends 'blocks' ? Array < SessionBlockGetPayload<S['include'][P]>>  :
        P extends 'owner' ? UserGetPayload<S['include'][P]> :
        P extends 'course' ? CourseGetPayload<S['include'][P]> :
        P extends '_count' ? SessionCountOutputTypeGetPayload<S['include'][P]> :  never
  } 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
        P extends 'blocks' ? Array < SessionBlockGetPayload<S['select'][P]>>  :
        P extends 'owner' ? UserGetPayload<S['select'][P]> :
        P extends 'course' ? CourseGetPayload<S['select'][P]> :
        P extends '_count' ? SessionCountOutputTypeGetPayload<S['select'][P]> :  P extends keyof Session ? Session[P] : never
  } 
    : Session
  : Session


  type SessionCountArgs = Merge<
    Omit<SessionFindManyArgs, 'select' | 'include'> & {
      select?: SessionCountAggregateInputType | true
    }
  >

  export interface SessionDelegate<GlobalRejectSettings> {
    /**
     * Find zero or one Session that matches the filter.
     * @param {SessionFindUniqueArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends SessionFindUniqueArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args: SelectSubset<T, SessionFindUniqueArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findUnique', 'Session'> extends True ? CheckSelect<T, Prisma__SessionClient<Session>, Prisma__SessionClient<SessionGetPayload<T>>> : CheckSelect<T, Prisma__SessionClient<Session | null >, Prisma__SessionClient<SessionGetPayload<T> | null >>

    /**
     * Find the first Session that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindFirstArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends SessionFindFirstArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args?: SelectSubset<T, SessionFindFirstArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findFirst', 'Session'> extends True ? CheckSelect<T, Prisma__SessionClient<Session>, Prisma__SessionClient<SessionGetPayload<T>>> : CheckSelect<T, Prisma__SessionClient<Session | null >, Prisma__SessionClient<SessionGetPayload<T> | null >>

    /**
     * Find zero or more Sessions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Sessions
     * const sessions = await prisma.session.findMany()
     * 
     * // Get first 10 Sessions
     * const sessions = await prisma.session.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const sessionWithIdOnly = await prisma.session.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends SessionFindManyArgs>(
      args?: SelectSubset<T, SessionFindManyArgs>
    ): CheckSelect<T, PrismaPromise<Array<Session>>, PrismaPromise<Array<SessionGetPayload<T>>>>

    /**
     * Create a Session.
     * @param {SessionCreateArgs} args - Arguments to create a Session.
     * @example
     * // Create one Session
     * const Session = await prisma.session.create({
     *   data: {
     *     // ... data to create a Session
     *   }
     * })
     * 
    **/
    create<T extends SessionCreateArgs>(
      args: SelectSubset<T, SessionCreateArgs>
    ): CheckSelect<T, Prisma__SessionClient<Session>, Prisma__SessionClient<SessionGetPayload<T>>>

    /**
     * Create many Sessions.
     *     @param {SessionCreateManyArgs} args - Arguments to create many Sessions.
     *     @example
     *     // Create many Sessions
     *     const session = await prisma.session.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends SessionCreateManyArgs>(
      args?: SelectSubset<T, SessionCreateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Delete a Session.
     * @param {SessionDeleteArgs} args - Arguments to delete one Session.
     * @example
     * // Delete one Session
     * const Session = await prisma.session.delete({
     *   where: {
     *     // ... filter to delete one Session
     *   }
     * })
     * 
    **/
    delete<T extends SessionDeleteArgs>(
      args: SelectSubset<T, SessionDeleteArgs>
    ): CheckSelect<T, Prisma__SessionClient<Session>, Prisma__SessionClient<SessionGetPayload<T>>>

    /**
     * Update one Session.
     * @param {SessionUpdateArgs} args - Arguments to update one Session.
     * @example
     * // Update one Session
     * const session = await prisma.session.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends SessionUpdateArgs>(
      args: SelectSubset<T, SessionUpdateArgs>
    ): CheckSelect<T, Prisma__SessionClient<Session>, Prisma__SessionClient<SessionGetPayload<T>>>

    /**
     * Delete zero or more Sessions.
     * @param {SessionDeleteManyArgs} args - Arguments to filter Sessions to delete.
     * @example
     * // Delete a few Sessions
     * const { count } = await prisma.session.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends SessionDeleteManyArgs>(
      args?: SelectSubset<T, SessionDeleteManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Update zero or more Sessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Sessions
     * const session = await prisma.session.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends SessionUpdateManyArgs>(
      args: SelectSubset<T, SessionUpdateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Create or update one Session.
     * @param {SessionUpsertArgs} args - Arguments to update or create a Session.
     * @example
     * // Update or create a Session
     * const session = await prisma.session.upsert({
     *   create: {
     *     // ... data to create a Session
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Session we want to update
     *   }
     * })
    **/
    upsert<T extends SessionUpsertArgs>(
      args: SelectSubset<T, SessionUpsertArgs>
    ): CheckSelect<T, Prisma__SessionClient<Session>, Prisma__SessionClient<SessionGetPayload<T>>>

    /**
     * Find one Session that matches the filter or throw
     * `NotFoundError` if no matches were found.
     * @param {SessionFindUniqueOrThrowArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends SessionFindUniqueOrThrowArgs>(
      args?: SelectSubset<T, SessionFindUniqueOrThrowArgs>
    ): CheckSelect<T, Prisma__SessionClient<Session>, Prisma__SessionClient<SessionGetPayload<T>>>

    /**
     * Find the first Session that matches the filter or
     * throw `NotFoundError` if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindFirstOrThrowArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends SessionFindFirstOrThrowArgs>(
      args?: SelectSubset<T, SessionFindFirstOrThrowArgs>
    ): CheckSelect<T, Prisma__SessionClient<Session>, Prisma__SessionClient<SessionGetPayload<T>>>

    /**
     * Count the number of Sessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionCountArgs} args - Arguments to filter Sessions to count.
     * @example
     * // Count the number of Sessions
     * const count = await prisma.session.count({
     *   where: {
     *     // ... the filter for the Sessions we want to count
     *   }
     * })
    **/
    count<T extends SessionCountArgs>(
      args?: Subset<T, SessionCountArgs>,
    ): PrismaPromise<
      T extends _Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SessionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Session.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SessionAggregateArgs>(args: Subset<T, SessionAggregateArgs>): PrismaPromise<GetSessionAggregateType<T>>

    /**
     * Group by Session.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SessionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SessionGroupByArgs['orderBy'] }
        : { orderBy?: SessionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends TupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SessionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSessionGroupByPayload<T> : PrismaPromise<InputErrors>
  }

  /**
   * The delegate class that acts as a "Promise-like" for Session.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__SessionClient<T> implements PrismaPromise<T> {
    [prisma]: true;
    private readonly _dmmf;
    private readonly _fetcher;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    constructor(_dmmf: runtime.DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
    readonly [Symbol.toStringTag]: 'PrismaClientPromise';

    blocks<T extends SessionBlockFindManyArgs = {}>(args?: Subset<T, SessionBlockFindManyArgs>): CheckSelect<T, PrismaPromise<Array<SessionBlock>>, PrismaPromise<Array<SessionBlockGetPayload<T>>>>;

    owner<T extends UserArgs = {}>(args?: Subset<T, UserArgs>): CheckSelect<T, Prisma__UserClient<User | null >, Prisma__UserClient<UserGetPayload<T> | null >>;

    course<T extends CourseArgs = {}>(args?: Subset<T, CourseArgs>): CheckSelect<T, Prisma__CourseClient<Course | null >, Prisma__CourseClient<CourseGetPayload<T> | null >>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }

  // Custom InputTypes

  /**
   * Session base type for findUnique actions
   */
  export type SessionFindUniqueArgsBase = {
    /**
     * Select specific fields to fetch from the Session
     * 
    **/
    select?: SessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionInclude | null
    /**
     * Filter, which Session to fetch.
     * 
    **/
    where: SessionWhereUniqueInput
  }

  /**
   * Session: findUnique
   */
  export interface SessionFindUniqueArgs extends SessionFindUniqueArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findUniqueOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * Session base type for findFirst actions
   */
  export type SessionFindFirstArgsBase = {
    /**
     * Select specific fields to fetch from the Session
     * 
    **/
    select?: SessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionInclude | null
    /**
     * Filter, which Session to fetch.
     * 
    **/
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     * 
    **/
    orderBy?: Enumerable<SessionOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Sessions.
     * 
    **/
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Sessions.
     * 
    **/
    distinct?: Enumerable<SessionScalarFieldEnum>
  }

  /**
   * Session: findFirst
   */
  export interface SessionFindFirstArgs extends SessionFindFirstArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findFirstOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * Session findMany
   */
  export type SessionFindManyArgs = {
    /**
     * Select specific fields to fetch from the Session
     * 
    **/
    select?: SessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionInclude | null
    /**
     * Filter, which Sessions to fetch.
     * 
    **/
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     * 
    **/
    orderBy?: Enumerable<SessionOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Sessions.
     * 
    **/
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     * 
    **/
    skip?: number
    distinct?: Enumerable<SessionScalarFieldEnum>
  }


  /**
   * Session create
   */
  export type SessionCreateArgs = {
    /**
     * Select specific fields to fetch from the Session
     * 
    **/
    select?: SessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionInclude | null
    /**
     * The data needed to create a Session.
     * 
    **/
    data: XOR<SessionCreateInput, SessionUncheckedCreateInput>
  }


  /**
   * Session createMany
   */
  export type SessionCreateManyArgs = {
    /**
     * The data used to create many Sessions.
     * 
    **/
    data: Enumerable<SessionCreateManyInput>
    skipDuplicates?: boolean
  }


  /**
   * Session update
   */
  export type SessionUpdateArgs = {
    /**
     * Select specific fields to fetch from the Session
     * 
    **/
    select?: SessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionInclude | null
    /**
     * The data needed to update a Session.
     * 
    **/
    data: XOR<SessionUpdateInput, SessionUncheckedUpdateInput>
    /**
     * Choose, which Session to update.
     * 
    **/
    where: SessionWhereUniqueInput
  }


  /**
   * Session updateMany
   */
  export type SessionUpdateManyArgs = {
    /**
     * The data used to update Sessions.
     * 
    **/
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyInput>
    /**
     * Filter which Sessions to update
     * 
    **/
    where?: SessionWhereInput
  }


  /**
   * Session upsert
   */
  export type SessionUpsertArgs = {
    /**
     * Select specific fields to fetch from the Session
     * 
    **/
    select?: SessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionInclude | null
    /**
     * The filter to search for the Session to update in case it exists.
     * 
    **/
    where: SessionWhereUniqueInput
    /**
     * In case the Session found by the `where` argument doesn't exist, create a new Session with this data.
     * 
    **/
    create: XOR<SessionCreateInput, SessionUncheckedCreateInput>
    /**
     * In case the Session was found with the provided `where` argument, update it with this data.
     * 
    **/
    update: XOR<SessionUpdateInput, SessionUncheckedUpdateInput>
  }


  /**
   * Session delete
   */
  export type SessionDeleteArgs = {
    /**
     * Select specific fields to fetch from the Session
     * 
    **/
    select?: SessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionInclude | null
    /**
     * Filter which Session to delete.
     * 
    **/
    where: SessionWhereUniqueInput
  }


  /**
   * Session deleteMany
   */
  export type SessionDeleteManyArgs = {
    /**
     * Filter which Sessions to delete
     * 
    **/
    where?: SessionWhereInput
  }


  /**
   * Session: findUniqueOrThrow
   */
  export type SessionFindUniqueOrThrowArgs = SessionFindUniqueArgsBase
      

  /**
   * Session: findFirstOrThrow
   */
  export type SessionFindFirstOrThrowArgs = SessionFindFirstArgsBase
      

  /**
   * Session without action
   */
  export type SessionArgs = {
    /**
     * Select specific fields to fetch from the Session
     * 
    **/
    select?: SessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionInclude | null
  }



  /**
   * Model SessionBlock
   */


  export type AggregateSessionBlock = {
    _count: SessionBlockCountAggregateOutputType | null
    _avg: SessionBlockAvgAggregateOutputType | null
    _sum: SessionBlockSumAggregateOutputType | null
    _min: SessionBlockMinAggregateOutputType | null
    _max: SessionBlockMaxAggregateOutputType | null
  }

  export type SessionBlockAvgAggregateOutputType = {
    id: number | null
    timeLimit: number | null
    randomSelection: number | null
  }

  export type SessionBlockSumAggregateOutputType = {
    id: number | null
    timeLimit: number | null
    randomSelection: number | null
  }

  export type SessionBlockMinAggregateOutputType = {
    id: number | null
    expiresAt: Date | null
    timeLimit: number | null
    randomSelection: number | null
    sessionId: string | null
  }

  export type SessionBlockMaxAggregateOutputType = {
    id: number | null
    expiresAt: Date | null
    timeLimit: number | null
    randomSelection: number | null
    sessionId: string | null
  }

  export type SessionBlockCountAggregateOutputType = {
    id: number
    expiresAt: number
    timeLimit: number
    randomSelection: number
    sessionId: number
    _all: number
  }


  export type SessionBlockAvgAggregateInputType = {
    id?: true
    timeLimit?: true
    randomSelection?: true
  }

  export type SessionBlockSumAggregateInputType = {
    id?: true
    timeLimit?: true
    randomSelection?: true
  }

  export type SessionBlockMinAggregateInputType = {
    id?: true
    expiresAt?: true
    timeLimit?: true
    randomSelection?: true
    sessionId?: true
  }

  export type SessionBlockMaxAggregateInputType = {
    id?: true
    expiresAt?: true
    timeLimit?: true
    randomSelection?: true
    sessionId?: true
  }

  export type SessionBlockCountAggregateInputType = {
    id?: true
    expiresAt?: true
    timeLimit?: true
    randomSelection?: true
    sessionId?: true
    _all?: true
  }

  export type SessionBlockAggregateArgs = {
    /**
     * Filter which SessionBlock to aggregate.
     * 
    **/
    where?: SessionBlockWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SessionBlocks to fetch.
     * 
    **/
    orderBy?: Enumerable<SessionBlockOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     * 
    **/
    cursor?: SessionBlockWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SessionBlocks from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SessionBlocks.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SessionBlocks
    **/
    _count?: true | SessionBlockCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: SessionBlockAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: SessionBlockSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SessionBlockMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SessionBlockMaxAggregateInputType
  }

  export type GetSessionBlockAggregateType<T extends SessionBlockAggregateArgs> = {
        [P in keyof T & keyof AggregateSessionBlock]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSessionBlock[P]>
      : GetScalarType<T[P], AggregateSessionBlock[P]>
  }




  export type SessionBlockGroupByArgs = {
    where?: SessionBlockWhereInput
    orderBy?: Enumerable<SessionBlockOrderByWithAggregationInput>
    by: Array<SessionBlockScalarFieldEnum>
    having?: SessionBlockScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SessionBlockCountAggregateInputType | true
    _avg?: SessionBlockAvgAggregateInputType
    _sum?: SessionBlockSumAggregateInputType
    _min?: SessionBlockMinAggregateInputType
    _max?: SessionBlockMaxAggregateInputType
  }


  export type SessionBlockGroupByOutputType = {
    id: number
    expiresAt: Date | null
    timeLimit: number | null
    randomSelection: number | null
    sessionId: string
    _count: SessionBlockCountAggregateOutputType | null
    _avg: SessionBlockAvgAggregateOutputType | null
    _sum: SessionBlockSumAggregateOutputType | null
    _min: SessionBlockMinAggregateOutputType | null
    _max: SessionBlockMaxAggregateOutputType | null
  }

  type GetSessionBlockGroupByPayload<T extends SessionBlockGroupByArgs> = PrismaPromise<
    Array<
      PickArray<SessionBlockGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SessionBlockGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SessionBlockGroupByOutputType[P]>
            : GetScalarType<T[P], SessionBlockGroupByOutputType[P]>
        }
      >
    >


  export type SessionBlockSelect = {
    id?: boolean
    expiresAt?: boolean
    timeLimit?: boolean
    randomSelection?: boolean
    instances?: boolean | QuestionInstanceFindManyArgs
    session?: boolean | SessionArgs
    sessionId?: boolean
    _count?: boolean | SessionBlockCountOutputTypeArgs
  }

  export type SessionBlockInclude = {
    instances?: boolean | QuestionInstanceFindManyArgs
    session?: boolean | SessionArgs
    _count?: boolean | SessionBlockCountOutputTypeArgs
  }

  export type SessionBlockGetPayload<
    S extends boolean | null | undefined | SessionBlockArgs,
    U = keyof S
      > = S extends true
        ? SessionBlock
    : S extends undefined
    ? never
    : S extends SessionBlockArgs | SessionBlockFindManyArgs
    ?'include' extends U
    ? SessionBlock  & {
    [P in TrueKeys<S['include']>]:
        P extends 'instances' ? Array < QuestionInstanceGetPayload<S['include'][P]>>  :
        P extends 'session' ? SessionGetPayload<S['include'][P]> :
        P extends '_count' ? SessionBlockCountOutputTypeGetPayload<S['include'][P]> :  never
  } 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
        P extends 'instances' ? Array < QuestionInstanceGetPayload<S['select'][P]>>  :
        P extends 'session' ? SessionGetPayload<S['select'][P]> :
        P extends '_count' ? SessionBlockCountOutputTypeGetPayload<S['select'][P]> :  P extends keyof SessionBlock ? SessionBlock[P] : never
  } 
    : SessionBlock
  : SessionBlock


  type SessionBlockCountArgs = Merge<
    Omit<SessionBlockFindManyArgs, 'select' | 'include'> & {
      select?: SessionBlockCountAggregateInputType | true
    }
  >

  export interface SessionBlockDelegate<GlobalRejectSettings> {
    /**
     * Find zero or one SessionBlock that matches the filter.
     * @param {SessionBlockFindUniqueArgs} args - Arguments to find a SessionBlock
     * @example
     * // Get one SessionBlock
     * const sessionBlock = await prisma.sessionBlock.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends SessionBlockFindUniqueArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args: SelectSubset<T, SessionBlockFindUniqueArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findUnique', 'SessionBlock'> extends True ? CheckSelect<T, Prisma__SessionBlockClient<SessionBlock>, Prisma__SessionBlockClient<SessionBlockGetPayload<T>>> : CheckSelect<T, Prisma__SessionBlockClient<SessionBlock | null >, Prisma__SessionBlockClient<SessionBlockGetPayload<T> | null >>

    /**
     * Find the first SessionBlock that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionBlockFindFirstArgs} args - Arguments to find a SessionBlock
     * @example
     * // Get one SessionBlock
     * const sessionBlock = await prisma.sessionBlock.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends SessionBlockFindFirstArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args?: SelectSubset<T, SessionBlockFindFirstArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findFirst', 'SessionBlock'> extends True ? CheckSelect<T, Prisma__SessionBlockClient<SessionBlock>, Prisma__SessionBlockClient<SessionBlockGetPayload<T>>> : CheckSelect<T, Prisma__SessionBlockClient<SessionBlock | null >, Prisma__SessionBlockClient<SessionBlockGetPayload<T> | null >>

    /**
     * Find zero or more SessionBlocks that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionBlockFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SessionBlocks
     * const sessionBlocks = await prisma.sessionBlock.findMany()
     * 
     * // Get first 10 SessionBlocks
     * const sessionBlocks = await prisma.sessionBlock.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const sessionBlockWithIdOnly = await prisma.sessionBlock.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends SessionBlockFindManyArgs>(
      args?: SelectSubset<T, SessionBlockFindManyArgs>
    ): CheckSelect<T, PrismaPromise<Array<SessionBlock>>, PrismaPromise<Array<SessionBlockGetPayload<T>>>>

    /**
     * Create a SessionBlock.
     * @param {SessionBlockCreateArgs} args - Arguments to create a SessionBlock.
     * @example
     * // Create one SessionBlock
     * const SessionBlock = await prisma.sessionBlock.create({
     *   data: {
     *     // ... data to create a SessionBlock
     *   }
     * })
     * 
    **/
    create<T extends SessionBlockCreateArgs>(
      args: SelectSubset<T, SessionBlockCreateArgs>
    ): CheckSelect<T, Prisma__SessionBlockClient<SessionBlock>, Prisma__SessionBlockClient<SessionBlockGetPayload<T>>>

    /**
     * Create many SessionBlocks.
     *     @param {SessionBlockCreateManyArgs} args - Arguments to create many SessionBlocks.
     *     @example
     *     // Create many SessionBlocks
     *     const sessionBlock = await prisma.sessionBlock.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends SessionBlockCreateManyArgs>(
      args?: SelectSubset<T, SessionBlockCreateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Delete a SessionBlock.
     * @param {SessionBlockDeleteArgs} args - Arguments to delete one SessionBlock.
     * @example
     * // Delete one SessionBlock
     * const SessionBlock = await prisma.sessionBlock.delete({
     *   where: {
     *     // ... filter to delete one SessionBlock
     *   }
     * })
     * 
    **/
    delete<T extends SessionBlockDeleteArgs>(
      args: SelectSubset<T, SessionBlockDeleteArgs>
    ): CheckSelect<T, Prisma__SessionBlockClient<SessionBlock>, Prisma__SessionBlockClient<SessionBlockGetPayload<T>>>

    /**
     * Update one SessionBlock.
     * @param {SessionBlockUpdateArgs} args - Arguments to update one SessionBlock.
     * @example
     * // Update one SessionBlock
     * const sessionBlock = await prisma.sessionBlock.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends SessionBlockUpdateArgs>(
      args: SelectSubset<T, SessionBlockUpdateArgs>
    ): CheckSelect<T, Prisma__SessionBlockClient<SessionBlock>, Prisma__SessionBlockClient<SessionBlockGetPayload<T>>>

    /**
     * Delete zero or more SessionBlocks.
     * @param {SessionBlockDeleteManyArgs} args - Arguments to filter SessionBlocks to delete.
     * @example
     * // Delete a few SessionBlocks
     * const { count } = await prisma.sessionBlock.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends SessionBlockDeleteManyArgs>(
      args?: SelectSubset<T, SessionBlockDeleteManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Update zero or more SessionBlocks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionBlockUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SessionBlocks
     * const sessionBlock = await prisma.sessionBlock.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends SessionBlockUpdateManyArgs>(
      args: SelectSubset<T, SessionBlockUpdateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Create or update one SessionBlock.
     * @param {SessionBlockUpsertArgs} args - Arguments to update or create a SessionBlock.
     * @example
     * // Update or create a SessionBlock
     * const sessionBlock = await prisma.sessionBlock.upsert({
     *   create: {
     *     // ... data to create a SessionBlock
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SessionBlock we want to update
     *   }
     * })
    **/
    upsert<T extends SessionBlockUpsertArgs>(
      args: SelectSubset<T, SessionBlockUpsertArgs>
    ): CheckSelect<T, Prisma__SessionBlockClient<SessionBlock>, Prisma__SessionBlockClient<SessionBlockGetPayload<T>>>

    /**
     * Find one SessionBlock that matches the filter or throw
     * `NotFoundError` if no matches were found.
     * @param {SessionBlockFindUniqueOrThrowArgs} args - Arguments to find a SessionBlock
     * @example
     * // Get one SessionBlock
     * const sessionBlock = await prisma.sessionBlock.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends SessionBlockFindUniqueOrThrowArgs>(
      args?: SelectSubset<T, SessionBlockFindUniqueOrThrowArgs>
    ): CheckSelect<T, Prisma__SessionBlockClient<SessionBlock>, Prisma__SessionBlockClient<SessionBlockGetPayload<T>>>

    /**
     * Find the first SessionBlock that matches the filter or
     * throw `NotFoundError` if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionBlockFindFirstOrThrowArgs} args - Arguments to find a SessionBlock
     * @example
     * // Get one SessionBlock
     * const sessionBlock = await prisma.sessionBlock.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends SessionBlockFindFirstOrThrowArgs>(
      args?: SelectSubset<T, SessionBlockFindFirstOrThrowArgs>
    ): CheckSelect<T, Prisma__SessionBlockClient<SessionBlock>, Prisma__SessionBlockClient<SessionBlockGetPayload<T>>>

    /**
     * Count the number of SessionBlocks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionBlockCountArgs} args - Arguments to filter SessionBlocks to count.
     * @example
     * // Count the number of SessionBlocks
     * const count = await prisma.sessionBlock.count({
     *   where: {
     *     // ... the filter for the SessionBlocks we want to count
     *   }
     * })
    **/
    count<T extends SessionBlockCountArgs>(
      args?: Subset<T, SessionBlockCountArgs>,
    ): PrismaPromise<
      T extends _Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SessionBlockCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SessionBlock.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionBlockAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SessionBlockAggregateArgs>(args: Subset<T, SessionBlockAggregateArgs>): PrismaPromise<GetSessionBlockAggregateType<T>>

    /**
     * Group by SessionBlock.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionBlockGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SessionBlockGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SessionBlockGroupByArgs['orderBy'] }
        : { orderBy?: SessionBlockGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends TupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SessionBlockGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSessionBlockGroupByPayload<T> : PrismaPromise<InputErrors>
  }

  /**
   * The delegate class that acts as a "Promise-like" for SessionBlock.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__SessionBlockClient<T> implements PrismaPromise<T> {
    [prisma]: true;
    private readonly _dmmf;
    private readonly _fetcher;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    constructor(_dmmf: runtime.DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
    readonly [Symbol.toStringTag]: 'PrismaClientPromise';

    instances<T extends QuestionInstanceFindManyArgs = {}>(args?: Subset<T, QuestionInstanceFindManyArgs>): CheckSelect<T, PrismaPromise<Array<QuestionInstance>>, PrismaPromise<Array<QuestionInstanceGetPayload<T>>>>;

    session<T extends SessionArgs = {}>(args?: Subset<T, SessionArgs>): CheckSelect<T, Prisma__SessionClient<Session | null >, Prisma__SessionClient<SessionGetPayload<T> | null >>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }

  // Custom InputTypes

  /**
   * SessionBlock base type for findUnique actions
   */
  export type SessionBlockFindUniqueArgsBase = {
    /**
     * Select specific fields to fetch from the SessionBlock
     * 
    **/
    select?: SessionBlockSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionBlockInclude | null
    /**
     * Filter, which SessionBlock to fetch.
     * 
    **/
    where: SessionBlockWhereUniqueInput
  }

  /**
   * SessionBlock: findUnique
   */
  export interface SessionBlockFindUniqueArgs extends SessionBlockFindUniqueArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findUniqueOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * SessionBlock base type for findFirst actions
   */
  export type SessionBlockFindFirstArgsBase = {
    /**
     * Select specific fields to fetch from the SessionBlock
     * 
    **/
    select?: SessionBlockSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionBlockInclude | null
    /**
     * Filter, which SessionBlock to fetch.
     * 
    **/
    where?: SessionBlockWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SessionBlocks to fetch.
     * 
    **/
    orderBy?: Enumerable<SessionBlockOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SessionBlocks.
     * 
    **/
    cursor?: SessionBlockWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SessionBlocks from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SessionBlocks.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SessionBlocks.
     * 
    **/
    distinct?: Enumerable<SessionBlockScalarFieldEnum>
  }

  /**
   * SessionBlock: findFirst
   */
  export interface SessionBlockFindFirstArgs extends SessionBlockFindFirstArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findFirstOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * SessionBlock findMany
   */
  export type SessionBlockFindManyArgs = {
    /**
     * Select specific fields to fetch from the SessionBlock
     * 
    **/
    select?: SessionBlockSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionBlockInclude | null
    /**
     * Filter, which SessionBlocks to fetch.
     * 
    **/
    where?: SessionBlockWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SessionBlocks to fetch.
     * 
    **/
    orderBy?: Enumerable<SessionBlockOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SessionBlocks.
     * 
    **/
    cursor?: SessionBlockWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SessionBlocks from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SessionBlocks.
     * 
    **/
    skip?: number
    distinct?: Enumerable<SessionBlockScalarFieldEnum>
  }


  /**
   * SessionBlock create
   */
  export type SessionBlockCreateArgs = {
    /**
     * Select specific fields to fetch from the SessionBlock
     * 
    **/
    select?: SessionBlockSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionBlockInclude | null
    /**
     * The data needed to create a SessionBlock.
     * 
    **/
    data: XOR<SessionBlockCreateInput, SessionBlockUncheckedCreateInput>
  }


  /**
   * SessionBlock createMany
   */
  export type SessionBlockCreateManyArgs = {
    /**
     * The data used to create many SessionBlocks.
     * 
    **/
    data: Enumerable<SessionBlockCreateManyInput>
    skipDuplicates?: boolean
  }


  /**
   * SessionBlock update
   */
  export type SessionBlockUpdateArgs = {
    /**
     * Select specific fields to fetch from the SessionBlock
     * 
    **/
    select?: SessionBlockSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionBlockInclude | null
    /**
     * The data needed to update a SessionBlock.
     * 
    **/
    data: XOR<SessionBlockUpdateInput, SessionBlockUncheckedUpdateInput>
    /**
     * Choose, which SessionBlock to update.
     * 
    **/
    where: SessionBlockWhereUniqueInput
  }


  /**
   * SessionBlock updateMany
   */
  export type SessionBlockUpdateManyArgs = {
    /**
     * The data used to update SessionBlocks.
     * 
    **/
    data: XOR<SessionBlockUpdateManyMutationInput, SessionBlockUncheckedUpdateManyInput>
    /**
     * Filter which SessionBlocks to update
     * 
    **/
    where?: SessionBlockWhereInput
  }


  /**
   * SessionBlock upsert
   */
  export type SessionBlockUpsertArgs = {
    /**
     * Select specific fields to fetch from the SessionBlock
     * 
    **/
    select?: SessionBlockSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionBlockInclude | null
    /**
     * The filter to search for the SessionBlock to update in case it exists.
     * 
    **/
    where: SessionBlockWhereUniqueInput
    /**
     * In case the SessionBlock found by the `where` argument doesn't exist, create a new SessionBlock with this data.
     * 
    **/
    create: XOR<SessionBlockCreateInput, SessionBlockUncheckedCreateInput>
    /**
     * In case the SessionBlock was found with the provided `where` argument, update it with this data.
     * 
    **/
    update: XOR<SessionBlockUpdateInput, SessionBlockUncheckedUpdateInput>
  }


  /**
   * SessionBlock delete
   */
  export type SessionBlockDeleteArgs = {
    /**
     * Select specific fields to fetch from the SessionBlock
     * 
    **/
    select?: SessionBlockSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionBlockInclude | null
    /**
     * Filter which SessionBlock to delete.
     * 
    **/
    where: SessionBlockWhereUniqueInput
  }


  /**
   * SessionBlock deleteMany
   */
  export type SessionBlockDeleteManyArgs = {
    /**
     * Filter which SessionBlocks to delete
     * 
    **/
    where?: SessionBlockWhereInput
  }


  /**
   * SessionBlock: findUniqueOrThrow
   */
  export type SessionBlockFindUniqueOrThrowArgs = SessionBlockFindUniqueArgsBase
      

  /**
   * SessionBlock: findFirstOrThrow
   */
  export type SessionBlockFindFirstOrThrowArgs = SessionBlockFindFirstArgsBase
      

  /**
   * SessionBlock without action
   */
  export type SessionBlockArgs = {
    /**
     * Select specific fields to fetch from the SessionBlock
     * 
    **/
    select?: SessionBlockSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: SessionBlockInclude | null
  }



  /**
   * Model LearningElement
   */


  export type AggregateLearningElement = {
    _count: LearningElementCountAggregateOutputType | null
    _min: LearningElementMinAggregateOutputType | null
    _max: LearningElementMaxAggregateOutputType | null
  }

  export type LearningElementMinAggregateOutputType = {
    id: string | null
    ownerId: string | null
    courseId: string | null
  }

  export type LearningElementMaxAggregateOutputType = {
    id: string | null
    ownerId: string | null
    courseId: string | null
  }

  export type LearningElementCountAggregateOutputType = {
    id: number
    ownerId: number
    courseId: number
    _all: number
  }


  export type LearningElementMinAggregateInputType = {
    id?: true
    ownerId?: true
    courseId?: true
  }

  export type LearningElementMaxAggregateInputType = {
    id?: true
    ownerId?: true
    courseId?: true
  }

  export type LearningElementCountAggregateInputType = {
    id?: true
    ownerId?: true
    courseId?: true
    _all?: true
  }

  export type LearningElementAggregateArgs = {
    /**
     * Filter which LearningElement to aggregate.
     * 
    **/
    where?: LearningElementWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LearningElements to fetch.
     * 
    **/
    orderBy?: Enumerable<LearningElementOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     * 
    **/
    cursor?: LearningElementWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LearningElements from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LearningElements.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned LearningElements
    **/
    _count?: true | LearningElementCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: LearningElementMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: LearningElementMaxAggregateInputType
  }

  export type GetLearningElementAggregateType<T extends LearningElementAggregateArgs> = {
        [P in keyof T & keyof AggregateLearningElement]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateLearningElement[P]>
      : GetScalarType<T[P], AggregateLearningElement[P]>
  }




  export type LearningElementGroupByArgs = {
    where?: LearningElementWhereInput
    orderBy?: Enumerable<LearningElementOrderByWithAggregationInput>
    by: Array<LearningElementScalarFieldEnum>
    having?: LearningElementScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: LearningElementCountAggregateInputType | true
    _min?: LearningElementMinAggregateInputType
    _max?: LearningElementMaxAggregateInputType
  }


  export type LearningElementGroupByOutputType = {
    id: string
    ownerId: string
    courseId: string
    _count: LearningElementCountAggregateOutputType | null
    _min: LearningElementMinAggregateOutputType | null
    _max: LearningElementMaxAggregateOutputType | null
  }

  type GetLearningElementGroupByPayload<T extends LearningElementGroupByArgs> = PrismaPromise<
    Array<
      PickArray<LearningElementGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof LearningElementGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], LearningElementGroupByOutputType[P]>
            : GetScalarType<T[P], LearningElementGroupByOutputType[P]>
        }
      >
    >


  export type LearningElementSelect = {
    id?: boolean
    instances?: boolean | QuestionInstanceFindManyArgs
    owner?: boolean | UserArgs
    ownerId?: boolean
    course?: boolean | CourseArgs
    courseId?: boolean
    _count?: boolean | LearningElementCountOutputTypeArgs
  }

  export type LearningElementInclude = {
    instances?: boolean | QuestionInstanceFindManyArgs
    owner?: boolean | UserArgs
    course?: boolean | CourseArgs
    _count?: boolean | LearningElementCountOutputTypeArgs
  }

  export type LearningElementGetPayload<
    S extends boolean | null | undefined | LearningElementArgs,
    U = keyof S
      > = S extends true
        ? LearningElement
    : S extends undefined
    ? never
    : S extends LearningElementArgs | LearningElementFindManyArgs
    ?'include' extends U
    ? LearningElement  & {
    [P in TrueKeys<S['include']>]:
        P extends 'instances' ? Array < QuestionInstanceGetPayload<S['include'][P]>>  :
        P extends 'owner' ? UserGetPayload<S['include'][P]> :
        P extends 'course' ? CourseGetPayload<S['include'][P]> :
        P extends '_count' ? LearningElementCountOutputTypeGetPayload<S['include'][P]> :  never
  } 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
        P extends 'instances' ? Array < QuestionInstanceGetPayload<S['select'][P]>>  :
        P extends 'owner' ? UserGetPayload<S['select'][P]> :
        P extends 'course' ? CourseGetPayload<S['select'][P]> :
        P extends '_count' ? LearningElementCountOutputTypeGetPayload<S['select'][P]> :  P extends keyof LearningElement ? LearningElement[P] : never
  } 
    : LearningElement
  : LearningElement


  type LearningElementCountArgs = Merge<
    Omit<LearningElementFindManyArgs, 'select' | 'include'> & {
      select?: LearningElementCountAggregateInputType | true
    }
  >

  export interface LearningElementDelegate<GlobalRejectSettings> {
    /**
     * Find zero or one LearningElement that matches the filter.
     * @param {LearningElementFindUniqueArgs} args - Arguments to find a LearningElement
     * @example
     * // Get one LearningElement
     * const learningElement = await prisma.learningElement.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends LearningElementFindUniqueArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args: SelectSubset<T, LearningElementFindUniqueArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findUnique', 'LearningElement'> extends True ? CheckSelect<T, Prisma__LearningElementClient<LearningElement>, Prisma__LearningElementClient<LearningElementGetPayload<T>>> : CheckSelect<T, Prisma__LearningElementClient<LearningElement | null >, Prisma__LearningElementClient<LearningElementGetPayload<T> | null >>

    /**
     * Find the first LearningElement that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LearningElementFindFirstArgs} args - Arguments to find a LearningElement
     * @example
     * // Get one LearningElement
     * const learningElement = await prisma.learningElement.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends LearningElementFindFirstArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args?: SelectSubset<T, LearningElementFindFirstArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findFirst', 'LearningElement'> extends True ? CheckSelect<T, Prisma__LearningElementClient<LearningElement>, Prisma__LearningElementClient<LearningElementGetPayload<T>>> : CheckSelect<T, Prisma__LearningElementClient<LearningElement | null >, Prisma__LearningElementClient<LearningElementGetPayload<T> | null >>

    /**
     * Find zero or more LearningElements that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LearningElementFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all LearningElements
     * const learningElements = await prisma.learningElement.findMany()
     * 
     * // Get first 10 LearningElements
     * const learningElements = await prisma.learningElement.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const learningElementWithIdOnly = await prisma.learningElement.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends LearningElementFindManyArgs>(
      args?: SelectSubset<T, LearningElementFindManyArgs>
    ): CheckSelect<T, PrismaPromise<Array<LearningElement>>, PrismaPromise<Array<LearningElementGetPayload<T>>>>

    /**
     * Create a LearningElement.
     * @param {LearningElementCreateArgs} args - Arguments to create a LearningElement.
     * @example
     * // Create one LearningElement
     * const LearningElement = await prisma.learningElement.create({
     *   data: {
     *     // ... data to create a LearningElement
     *   }
     * })
     * 
    **/
    create<T extends LearningElementCreateArgs>(
      args: SelectSubset<T, LearningElementCreateArgs>
    ): CheckSelect<T, Prisma__LearningElementClient<LearningElement>, Prisma__LearningElementClient<LearningElementGetPayload<T>>>

    /**
     * Create many LearningElements.
     *     @param {LearningElementCreateManyArgs} args - Arguments to create many LearningElements.
     *     @example
     *     // Create many LearningElements
     *     const learningElement = await prisma.learningElement.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends LearningElementCreateManyArgs>(
      args?: SelectSubset<T, LearningElementCreateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Delete a LearningElement.
     * @param {LearningElementDeleteArgs} args - Arguments to delete one LearningElement.
     * @example
     * // Delete one LearningElement
     * const LearningElement = await prisma.learningElement.delete({
     *   where: {
     *     // ... filter to delete one LearningElement
     *   }
     * })
     * 
    **/
    delete<T extends LearningElementDeleteArgs>(
      args: SelectSubset<T, LearningElementDeleteArgs>
    ): CheckSelect<T, Prisma__LearningElementClient<LearningElement>, Prisma__LearningElementClient<LearningElementGetPayload<T>>>

    /**
     * Update one LearningElement.
     * @param {LearningElementUpdateArgs} args - Arguments to update one LearningElement.
     * @example
     * // Update one LearningElement
     * const learningElement = await prisma.learningElement.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends LearningElementUpdateArgs>(
      args: SelectSubset<T, LearningElementUpdateArgs>
    ): CheckSelect<T, Prisma__LearningElementClient<LearningElement>, Prisma__LearningElementClient<LearningElementGetPayload<T>>>

    /**
     * Delete zero or more LearningElements.
     * @param {LearningElementDeleteManyArgs} args - Arguments to filter LearningElements to delete.
     * @example
     * // Delete a few LearningElements
     * const { count } = await prisma.learningElement.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends LearningElementDeleteManyArgs>(
      args?: SelectSubset<T, LearningElementDeleteManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Update zero or more LearningElements.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LearningElementUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many LearningElements
     * const learningElement = await prisma.learningElement.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends LearningElementUpdateManyArgs>(
      args: SelectSubset<T, LearningElementUpdateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Create or update one LearningElement.
     * @param {LearningElementUpsertArgs} args - Arguments to update or create a LearningElement.
     * @example
     * // Update or create a LearningElement
     * const learningElement = await prisma.learningElement.upsert({
     *   create: {
     *     // ... data to create a LearningElement
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the LearningElement we want to update
     *   }
     * })
    **/
    upsert<T extends LearningElementUpsertArgs>(
      args: SelectSubset<T, LearningElementUpsertArgs>
    ): CheckSelect<T, Prisma__LearningElementClient<LearningElement>, Prisma__LearningElementClient<LearningElementGetPayload<T>>>

    /**
     * Find one LearningElement that matches the filter or throw
     * `NotFoundError` if no matches were found.
     * @param {LearningElementFindUniqueOrThrowArgs} args - Arguments to find a LearningElement
     * @example
     * // Get one LearningElement
     * const learningElement = await prisma.learningElement.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends LearningElementFindUniqueOrThrowArgs>(
      args?: SelectSubset<T, LearningElementFindUniqueOrThrowArgs>
    ): CheckSelect<T, Prisma__LearningElementClient<LearningElement>, Prisma__LearningElementClient<LearningElementGetPayload<T>>>

    /**
     * Find the first LearningElement that matches the filter or
     * throw `NotFoundError` if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LearningElementFindFirstOrThrowArgs} args - Arguments to find a LearningElement
     * @example
     * // Get one LearningElement
     * const learningElement = await prisma.learningElement.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends LearningElementFindFirstOrThrowArgs>(
      args?: SelectSubset<T, LearningElementFindFirstOrThrowArgs>
    ): CheckSelect<T, Prisma__LearningElementClient<LearningElement>, Prisma__LearningElementClient<LearningElementGetPayload<T>>>

    /**
     * Count the number of LearningElements.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LearningElementCountArgs} args - Arguments to filter LearningElements to count.
     * @example
     * // Count the number of LearningElements
     * const count = await prisma.learningElement.count({
     *   where: {
     *     // ... the filter for the LearningElements we want to count
     *   }
     * })
    **/
    count<T extends LearningElementCountArgs>(
      args?: Subset<T, LearningElementCountArgs>,
    ): PrismaPromise<
      T extends _Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], LearningElementCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a LearningElement.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LearningElementAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends LearningElementAggregateArgs>(args: Subset<T, LearningElementAggregateArgs>): PrismaPromise<GetLearningElementAggregateType<T>>

    /**
     * Group by LearningElement.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LearningElementGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends LearningElementGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: LearningElementGroupByArgs['orderBy'] }
        : { orderBy?: LearningElementGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends TupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, LearningElementGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetLearningElementGroupByPayload<T> : PrismaPromise<InputErrors>
  }

  /**
   * The delegate class that acts as a "Promise-like" for LearningElement.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__LearningElementClient<T> implements PrismaPromise<T> {
    [prisma]: true;
    private readonly _dmmf;
    private readonly _fetcher;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    constructor(_dmmf: runtime.DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
    readonly [Symbol.toStringTag]: 'PrismaClientPromise';

    instances<T extends QuestionInstanceFindManyArgs = {}>(args?: Subset<T, QuestionInstanceFindManyArgs>): CheckSelect<T, PrismaPromise<Array<QuestionInstance>>, PrismaPromise<Array<QuestionInstanceGetPayload<T>>>>;

    owner<T extends UserArgs = {}>(args?: Subset<T, UserArgs>): CheckSelect<T, Prisma__UserClient<User | null >, Prisma__UserClient<UserGetPayload<T> | null >>;

    course<T extends CourseArgs = {}>(args?: Subset<T, CourseArgs>): CheckSelect<T, Prisma__CourseClient<Course | null >, Prisma__CourseClient<CourseGetPayload<T> | null >>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }

  // Custom InputTypes

  /**
   * LearningElement base type for findUnique actions
   */
  export type LearningElementFindUniqueArgsBase = {
    /**
     * Select specific fields to fetch from the LearningElement
     * 
    **/
    select?: LearningElementSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: LearningElementInclude | null
    /**
     * Filter, which LearningElement to fetch.
     * 
    **/
    where: LearningElementWhereUniqueInput
  }

  /**
   * LearningElement: findUnique
   */
  export interface LearningElementFindUniqueArgs extends LearningElementFindUniqueArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findUniqueOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * LearningElement base type for findFirst actions
   */
  export type LearningElementFindFirstArgsBase = {
    /**
     * Select specific fields to fetch from the LearningElement
     * 
    **/
    select?: LearningElementSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: LearningElementInclude | null
    /**
     * Filter, which LearningElement to fetch.
     * 
    **/
    where?: LearningElementWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LearningElements to fetch.
     * 
    **/
    orderBy?: Enumerable<LearningElementOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for LearningElements.
     * 
    **/
    cursor?: LearningElementWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LearningElements from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LearningElements.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of LearningElements.
     * 
    **/
    distinct?: Enumerable<LearningElementScalarFieldEnum>
  }

  /**
   * LearningElement: findFirst
   */
  export interface LearningElementFindFirstArgs extends LearningElementFindFirstArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findFirstOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * LearningElement findMany
   */
  export type LearningElementFindManyArgs = {
    /**
     * Select specific fields to fetch from the LearningElement
     * 
    **/
    select?: LearningElementSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: LearningElementInclude | null
    /**
     * Filter, which LearningElements to fetch.
     * 
    **/
    where?: LearningElementWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LearningElements to fetch.
     * 
    **/
    orderBy?: Enumerable<LearningElementOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing LearningElements.
     * 
    **/
    cursor?: LearningElementWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LearningElements from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LearningElements.
     * 
    **/
    skip?: number
    distinct?: Enumerable<LearningElementScalarFieldEnum>
  }


  /**
   * LearningElement create
   */
  export type LearningElementCreateArgs = {
    /**
     * Select specific fields to fetch from the LearningElement
     * 
    **/
    select?: LearningElementSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: LearningElementInclude | null
    /**
     * The data needed to create a LearningElement.
     * 
    **/
    data: XOR<LearningElementCreateInput, LearningElementUncheckedCreateInput>
  }


  /**
   * LearningElement createMany
   */
  export type LearningElementCreateManyArgs = {
    /**
     * The data used to create many LearningElements.
     * 
    **/
    data: Enumerable<LearningElementCreateManyInput>
    skipDuplicates?: boolean
  }


  /**
   * LearningElement update
   */
  export type LearningElementUpdateArgs = {
    /**
     * Select specific fields to fetch from the LearningElement
     * 
    **/
    select?: LearningElementSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: LearningElementInclude | null
    /**
     * The data needed to update a LearningElement.
     * 
    **/
    data: XOR<LearningElementUpdateInput, LearningElementUncheckedUpdateInput>
    /**
     * Choose, which LearningElement to update.
     * 
    **/
    where: LearningElementWhereUniqueInput
  }


  /**
   * LearningElement updateMany
   */
  export type LearningElementUpdateManyArgs = {
    /**
     * The data used to update LearningElements.
     * 
    **/
    data: XOR<LearningElementUpdateManyMutationInput, LearningElementUncheckedUpdateManyInput>
    /**
     * Filter which LearningElements to update
     * 
    **/
    where?: LearningElementWhereInput
  }


  /**
   * LearningElement upsert
   */
  export type LearningElementUpsertArgs = {
    /**
     * Select specific fields to fetch from the LearningElement
     * 
    **/
    select?: LearningElementSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: LearningElementInclude | null
    /**
     * The filter to search for the LearningElement to update in case it exists.
     * 
    **/
    where: LearningElementWhereUniqueInput
    /**
     * In case the LearningElement found by the `where` argument doesn't exist, create a new LearningElement with this data.
     * 
    **/
    create: XOR<LearningElementCreateInput, LearningElementUncheckedCreateInput>
    /**
     * In case the LearningElement was found with the provided `where` argument, update it with this data.
     * 
    **/
    update: XOR<LearningElementUpdateInput, LearningElementUncheckedUpdateInput>
  }


  /**
   * LearningElement delete
   */
  export type LearningElementDeleteArgs = {
    /**
     * Select specific fields to fetch from the LearningElement
     * 
    **/
    select?: LearningElementSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: LearningElementInclude | null
    /**
     * Filter which LearningElement to delete.
     * 
    **/
    where: LearningElementWhereUniqueInput
  }


  /**
   * LearningElement deleteMany
   */
  export type LearningElementDeleteManyArgs = {
    /**
     * Filter which LearningElements to delete
     * 
    **/
    where?: LearningElementWhereInput
  }


  /**
   * LearningElement: findUniqueOrThrow
   */
  export type LearningElementFindUniqueOrThrowArgs = LearningElementFindUniqueArgsBase
      

  /**
   * LearningElement: findFirstOrThrow
   */
  export type LearningElementFindFirstOrThrowArgs = LearningElementFindFirstArgsBase
      

  /**
   * LearningElement without action
   */
  export type LearningElementArgs = {
    /**
     * Select specific fields to fetch from the LearningElement
     * 
    **/
    select?: LearningElementSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: LearningElementInclude | null
  }



  /**
   * Model MicroSession
   */


  export type AggregateMicroSession = {
    _count: MicroSessionCountAggregateOutputType | null
    _min: MicroSessionMinAggregateOutputType | null
    _max: MicroSessionMaxAggregateOutputType | null
  }

  export type MicroSessionMinAggregateOutputType = {
    id: string | null
    scheduledStartAt: Date | null
    scheduledEndAt: Date | null
    ownerId: string | null
    courseId: string | null
  }

  export type MicroSessionMaxAggregateOutputType = {
    id: string | null
    scheduledStartAt: Date | null
    scheduledEndAt: Date | null
    ownerId: string | null
    courseId: string | null
  }

  export type MicroSessionCountAggregateOutputType = {
    id: number
    scheduledStartAt: number
    scheduledEndAt: number
    ownerId: number
    courseId: number
    _all: number
  }


  export type MicroSessionMinAggregateInputType = {
    id?: true
    scheduledStartAt?: true
    scheduledEndAt?: true
    ownerId?: true
    courseId?: true
  }

  export type MicroSessionMaxAggregateInputType = {
    id?: true
    scheduledStartAt?: true
    scheduledEndAt?: true
    ownerId?: true
    courseId?: true
  }

  export type MicroSessionCountAggregateInputType = {
    id?: true
    scheduledStartAt?: true
    scheduledEndAt?: true
    ownerId?: true
    courseId?: true
    _all?: true
  }

  export type MicroSessionAggregateArgs = {
    /**
     * Filter which MicroSession to aggregate.
     * 
    **/
    where?: MicroSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MicroSessions to fetch.
     * 
    **/
    orderBy?: Enumerable<MicroSessionOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     * 
    **/
    cursor?: MicroSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MicroSessions from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MicroSessions.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MicroSessions
    **/
    _count?: true | MicroSessionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MicroSessionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MicroSessionMaxAggregateInputType
  }

  export type GetMicroSessionAggregateType<T extends MicroSessionAggregateArgs> = {
        [P in keyof T & keyof AggregateMicroSession]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMicroSession[P]>
      : GetScalarType<T[P], AggregateMicroSession[P]>
  }




  export type MicroSessionGroupByArgs = {
    where?: MicroSessionWhereInput
    orderBy?: Enumerable<MicroSessionOrderByWithAggregationInput>
    by: Array<MicroSessionScalarFieldEnum>
    having?: MicroSessionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MicroSessionCountAggregateInputType | true
    _min?: MicroSessionMinAggregateInputType
    _max?: MicroSessionMaxAggregateInputType
  }


  export type MicroSessionGroupByOutputType = {
    id: string
    scheduledStartAt: Date
    scheduledEndAt: Date
    ownerId: string
    courseId: string
    _count: MicroSessionCountAggregateOutputType | null
    _min: MicroSessionMinAggregateOutputType | null
    _max: MicroSessionMaxAggregateOutputType | null
  }

  type GetMicroSessionGroupByPayload<T extends MicroSessionGroupByArgs> = PrismaPromise<
    Array<
      PickArray<MicroSessionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MicroSessionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MicroSessionGroupByOutputType[P]>
            : GetScalarType<T[P], MicroSessionGroupByOutputType[P]>
        }
      >
    >


  export type MicroSessionSelect = {
    id?: boolean
    scheduledStartAt?: boolean
    scheduledEndAt?: boolean
    instances?: boolean | QuestionInstanceFindManyArgs
    owner?: boolean | UserArgs
    ownerId?: boolean
    course?: boolean | CourseArgs
    courseId?: boolean
    _count?: boolean | MicroSessionCountOutputTypeArgs
  }

  export type MicroSessionInclude = {
    instances?: boolean | QuestionInstanceFindManyArgs
    owner?: boolean | UserArgs
    course?: boolean | CourseArgs
    _count?: boolean | MicroSessionCountOutputTypeArgs
  }

  export type MicroSessionGetPayload<
    S extends boolean | null | undefined | MicroSessionArgs,
    U = keyof S
      > = S extends true
        ? MicroSession
    : S extends undefined
    ? never
    : S extends MicroSessionArgs | MicroSessionFindManyArgs
    ?'include' extends U
    ? MicroSession  & {
    [P in TrueKeys<S['include']>]:
        P extends 'instances' ? Array < QuestionInstanceGetPayload<S['include'][P]>>  :
        P extends 'owner' ? UserGetPayload<S['include'][P]> :
        P extends 'course' ? CourseGetPayload<S['include'][P]> :
        P extends '_count' ? MicroSessionCountOutputTypeGetPayload<S['include'][P]> :  never
  } 
    : 'select' extends U
    ? {
    [P in TrueKeys<S['select']>]:
        P extends 'instances' ? Array < QuestionInstanceGetPayload<S['select'][P]>>  :
        P extends 'owner' ? UserGetPayload<S['select'][P]> :
        P extends 'course' ? CourseGetPayload<S['select'][P]> :
        P extends '_count' ? MicroSessionCountOutputTypeGetPayload<S['select'][P]> :  P extends keyof MicroSession ? MicroSession[P] : never
  } 
    : MicroSession
  : MicroSession


  type MicroSessionCountArgs = Merge<
    Omit<MicroSessionFindManyArgs, 'select' | 'include'> & {
      select?: MicroSessionCountAggregateInputType | true
    }
  >

  export interface MicroSessionDelegate<GlobalRejectSettings> {
    /**
     * Find zero or one MicroSession that matches the filter.
     * @param {MicroSessionFindUniqueArgs} args - Arguments to find a MicroSession
     * @example
     * // Get one MicroSession
     * const microSession = await prisma.microSession.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends MicroSessionFindUniqueArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args: SelectSubset<T, MicroSessionFindUniqueArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findUnique', 'MicroSession'> extends True ? CheckSelect<T, Prisma__MicroSessionClient<MicroSession>, Prisma__MicroSessionClient<MicroSessionGetPayload<T>>> : CheckSelect<T, Prisma__MicroSessionClient<MicroSession | null >, Prisma__MicroSessionClient<MicroSessionGetPayload<T> | null >>

    /**
     * Find the first MicroSession that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MicroSessionFindFirstArgs} args - Arguments to find a MicroSession
     * @example
     * // Get one MicroSession
     * const microSession = await prisma.microSession.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends MicroSessionFindFirstArgs,  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>(
      args?: SelectSubset<T, MicroSessionFindFirstArgs>
    ): HasReject<GlobalRejectSettings, LocalRejectSettings, 'findFirst', 'MicroSession'> extends True ? CheckSelect<T, Prisma__MicroSessionClient<MicroSession>, Prisma__MicroSessionClient<MicroSessionGetPayload<T>>> : CheckSelect<T, Prisma__MicroSessionClient<MicroSession | null >, Prisma__MicroSessionClient<MicroSessionGetPayload<T> | null >>

    /**
     * Find zero or more MicroSessions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MicroSessionFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MicroSessions
     * const microSessions = await prisma.microSession.findMany()
     * 
     * // Get first 10 MicroSessions
     * const microSessions = await prisma.microSession.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const microSessionWithIdOnly = await prisma.microSession.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends MicroSessionFindManyArgs>(
      args?: SelectSubset<T, MicroSessionFindManyArgs>
    ): CheckSelect<T, PrismaPromise<Array<MicroSession>>, PrismaPromise<Array<MicroSessionGetPayload<T>>>>

    /**
     * Create a MicroSession.
     * @param {MicroSessionCreateArgs} args - Arguments to create a MicroSession.
     * @example
     * // Create one MicroSession
     * const MicroSession = await prisma.microSession.create({
     *   data: {
     *     // ... data to create a MicroSession
     *   }
     * })
     * 
    **/
    create<T extends MicroSessionCreateArgs>(
      args: SelectSubset<T, MicroSessionCreateArgs>
    ): CheckSelect<T, Prisma__MicroSessionClient<MicroSession>, Prisma__MicroSessionClient<MicroSessionGetPayload<T>>>

    /**
     * Create many MicroSessions.
     *     @param {MicroSessionCreateManyArgs} args - Arguments to create many MicroSessions.
     *     @example
     *     // Create many MicroSessions
     *     const microSession = await prisma.microSession.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends MicroSessionCreateManyArgs>(
      args?: SelectSubset<T, MicroSessionCreateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Delete a MicroSession.
     * @param {MicroSessionDeleteArgs} args - Arguments to delete one MicroSession.
     * @example
     * // Delete one MicroSession
     * const MicroSession = await prisma.microSession.delete({
     *   where: {
     *     // ... filter to delete one MicroSession
     *   }
     * })
     * 
    **/
    delete<T extends MicroSessionDeleteArgs>(
      args: SelectSubset<T, MicroSessionDeleteArgs>
    ): CheckSelect<T, Prisma__MicroSessionClient<MicroSession>, Prisma__MicroSessionClient<MicroSessionGetPayload<T>>>

    /**
     * Update one MicroSession.
     * @param {MicroSessionUpdateArgs} args - Arguments to update one MicroSession.
     * @example
     * // Update one MicroSession
     * const microSession = await prisma.microSession.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends MicroSessionUpdateArgs>(
      args: SelectSubset<T, MicroSessionUpdateArgs>
    ): CheckSelect<T, Prisma__MicroSessionClient<MicroSession>, Prisma__MicroSessionClient<MicroSessionGetPayload<T>>>

    /**
     * Delete zero or more MicroSessions.
     * @param {MicroSessionDeleteManyArgs} args - Arguments to filter MicroSessions to delete.
     * @example
     * // Delete a few MicroSessions
     * const { count } = await prisma.microSession.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends MicroSessionDeleteManyArgs>(
      args?: SelectSubset<T, MicroSessionDeleteManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Update zero or more MicroSessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MicroSessionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MicroSessions
     * const microSession = await prisma.microSession.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends MicroSessionUpdateManyArgs>(
      args: SelectSubset<T, MicroSessionUpdateManyArgs>
    ): PrismaPromise<BatchPayload>

    /**
     * Create or update one MicroSession.
     * @param {MicroSessionUpsertArgs} args - Arguments to update or create a MicroSession.
     * @example
     * // Update or create a MicroSession
     * const microSession = await prisma.microSession.upsert({
     *   create: {
     *     // ... data to create a MicroSession
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MicroSession we want to update
     *   }
     * })
    **/
    upsert<T extends MicroSessionUpsertArgs>(
      args: SelectSubset<T, MicroSessionUpsertArgs>
    ): CheckSelect<T, Prisma__MicroSessionClient<MicroSession>, Prisma__MicroSessionClient<MicroSessionGetPayload<T>>>

    /**
     * Find one MicroSession that matches the filter or throw
     * `NotFoundError` if no matches were found.
     * @param {MicroSessionFindUniqueOrThrowArgs} args - Arguments to find a MicroSession
     * @example
     * // Get one MicroSession
     * const microSession = await prisma.microSession.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends MicroSessionFindUniqueOrThrowArgs>(
      args?: SelectSubset<T, MicroSessionFindUniqueOrThrowArgs>
    ): CheckSelect<T, Prisma__MicroSessionClient<MicroSession>, Prisma__MicroSessionClient<MicroSessionGetPayload<T>>>

    /**
     * Find the first MicroSession that matches the filter or
     * throw `NotFoundError` if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MicroSessionFindFirstOrThrowArgs} args - Arguments to find a MicroSession
     * @example
     * // Get one MicroSession
     * const microSession = await prisma.microSession.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends MicroSessionFindFirstOrThrowArgs>(
      args?: SelectSubset<T, MicroSessionFindFirstOrThrowArgs>
    ): CheckSelect<T, Prisma__MicroSessionClient<MicroSession>, Prisma__MicroSessionClient<MicroSessionGetPayload<T>>>

    /**
     * Count the number of MicroSessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MicroSessionCountArgs} args - Arguments to filter MicroSessions to count.
     * @example
     * // Count the number of MicroSessions
     * const count = await prisma.microSession.count({
     *   where: {
     *     // ... the filter for the MicroSessions we want to count
     *   }
     * })
    **/
    count<T extends MicroSessionCountArgs>(
      args?: Subset<T, MicroSessionCountArgs>,
    ): PrismaPromise<
      T extends _Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MicroSessionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MicroSession.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MicroSessionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MicroSessionAggregateArgs>(args: Subset<T, MicroSessionAggregateArgs>): PrismaPromise<GetMicroSessionAggregateType<T>>

    /**
     * Group by MicroSession.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MicroSessionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MicroSessionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MicroSessionGroupByArgs['orderBy'] }
        : { orderBy?: MicroSessionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends TupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MicroSessionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMicroSessionGroupByPayload<T> : PrismaPromise<InputErrors>
  }

  /**
   * The delegate class that acts as a "Promise-like" for MicroSession.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__MicroSessionClient<T> implements PrismaPromise<T> {
    [prisma]: true;
    private readonly _dmmf;
    private readonly _fetcher;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    constructor(_dmmf: runtime.DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
    readonly [Symbol.toStringTag]: 'PrismaClientPromise';

    instances<T extends QuestionInstanceFindManyArgs = {}>(args?: Subset<T, QuestionInstanceFindManyArgs>): CheckSelect<T, PrismaPromise<Array<QuestionInstance>>, PrismaPromise<Array<QuestionInstanceGetPayload<T>>>>;

    owner<T extends UserArgs = {}>(args?: Subset<T, UserArgs>): CheckSelect<T, Prisma__UserClient<User | null >, Prisma__UserClient<UserGetPayload<T> | null >>;

    course<T extends CourseArgs = {}>(args?: Subset<T, CourseArgs>): CheckSelect<T, Prisma__CourseClient<Course | null >, Prisma__CourseClient<CourseGetPayload<T> | null >>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }

  // Custom InputTypes

  /**
   * MicroSession base type for findUnique actions
   */
  export type MicroSessionFindUniqueArgsBase = {
    /**
     * Select specific fields to fetch from the MicroSession
     * 
    **/
    select?: MicroSessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: MicroSessionInclude | null
    /**
     * Filter, which MicroSession to fetch.
     * 
    **/
    where: MicroSessionWhereUniqueInput
  }

  /**
   * MicroSession: findUnique
   */
  export interface MicroSessionFindUniqueArgs extends MicroSessionFindUniqueArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findUniqueOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * MicroSession base type for findFirst actions
   */
  export type MicroSessionFindFirstArgsBase = {
    /**
     * Select specific fields to fetch from the MicroSession
     * 
    **/
    select?: MicroSessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: MicroSessionInclude | null
    /**
     * Filter, which MicroSession to fetch.
     * 
    **/
    where?: MicroSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MicroSessions to fetch.
     * 
    **/
    orderBy?: Enumerable<MicroSessionOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MicroSessions.
     * 
    **/
    cursor?: MicroSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MicroSessions from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MicroSessions.
     * 
    **/
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MicroSessions.
     * 
    **/
    distinct?: Enumerable<MicroSessionScalarFieldEnum>
  }

  /**
   * MicroSession: findFirst
   */
  export interface MicroSessionFindFirstArgs extends MicroSessionFindFirstArgsBase {
   /**
    * Throw an Error if query returns no results
    * @deprecated since 4.0.0: use `findFirstOrThrow` method instead
    */
    rejectOnNotFound?: RejectOnNotFound
  }
      

  /**
   * MicroSession findMany
   */
  export type MicroSessionFindManyArgs = {
    /**
     * Select specific fields to fetch from the MicroSession
     * 
    **/
    select?: MicroSessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: MicroSessionInclude | null
    /**
     * Filter, which MicroSessions to fetch.
     * 
    **/
    where?: MicroSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MicroSessions to fetch.
     * 
    **/
    orderBy?: Enumerable<MicroSessionOrderByWithRelationInput>
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MicroSessions.
     * 
    **/
    cursor?: MicroSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MicroSessions from the position of the cursor.
     * 
    **/
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MicroSessions.
     * 
    **/
    skip?: number
    distinct?: Enumerable<MicroSessionScalarFieldEnum>
  }


  /**
   * MicroSession create
   */
  export type MicroSessionCreateArgs = {
    /**
     * Select specific fields to fetch from the MicroSession
     * 
    **/
    select?: MicroSessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: MicroSessionInclude | null
    /**
     * The data needed to create a MicroSession.
     * 
    **/
    data: XOR<MicroSessionCreateInput, MicroSessionUncheckedCreateInput>
  }


  /**
   * MicroSession createMany
   */
  export type MicroSessionCreateManyArgs = {
    /**
     * The data used to create many MicroSessions.
     * 
    **/
    data: Enumerable<MicroSessionCreateManyInput>
    skipDuplicates?: boolean
  }


  /**
   * MicroSession update
   */
  export type MicroSessionUpdateArgs = {
    /**
     * Select specific fields to fetch from the MicroSession
     * 
    **/
    select?: MicroSessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: MicroSessionInclude | null
    /**
     * The data needed to update a MicroSession.
     * 
    **/
    data: XOR<MicroSessionUpdateInput, MicroSessionUncheckedUpdateInput>
    /**
     * Choose, which MicroSession to update.
     * 
    **/
    where: MicroSessionWhereUniqueInput
  }


  /**
   * MicroSession updateMany
   */
  export type MicroSessionUpdateManyArgs = {
    /**
     * The data used to update MicroSessions.
     * 
    **/
    data: XOR<MicroSessionUpdateManyMutationInput, MicroSessionUncheckedUpdateManyInput>
    /**
     * Filter which MicroSessions to update
     * 
    **/
    where?: MicroSessionWhereInput
  }


  /**
   * MicroSession upsert
   */
  export type MicroSessionUpsertArgs = {
    /**
     * Select specific fields to fetch from the MicroSession
     * 
    **/
    select?: MicroSessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: MicroSessionInclude | null
    /**
     * The filter to search for the MicroSession to update in case it exists.
     * 
    **/
    where: MicroSessionWhereUniqueInput
    /**
     * In case the MicroSession found by the `where` argument doesn't exist, create a new MicroSession with this data.
     * 
    **/
    create: XOR<MicroSessionCreateInput, MicroSessionUncheckedCreateInput>
    /**
     * In case the MicroSession was found with the provided `where` argument, update it with this data.
     * 
    **/
    update: XOR<MicroSessionUpdateInput, MicroSessionUncheckedUpdateInput>
  }


  /**
   * MicroSession delete
   */
  export type MicroSessionDeleteArgs = {
    /**
     * Select specific fields to fetch from the MicroSession
     * 
    **/
    select?: MicroSessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: MicroSessionInclude | null
    /**
     * Filter which MicroSession to delete.
     * 
    **/
    where: MicroSessionWhereUniqueInput
  }


  /**
   * MicroSession deleteMany
   */
  export type MicroSessionDeleteManyArgs = {
    /**
     * Filter which MicroSessions to delete
     * 
    **/
    where?: MicroSessionWhereInput
  }


  /**
   * MicroSession: findUniqueOrThrow
   */
  export type MicroSessionFindUniqueOrThrowArgs = MicroSessionFindUniqueArgsBase
      

  /**
   * MicroSession: findFirstOrThrow
   */
  export type MicroSessionFindFirstOrThrowArgs = MicroSessionFindFirstArgsBase
      

  /**
   * MicroSession without action
   */
  export type MicroSessionArgs = {
    /**
     * Select specific fields to fetch from the MicroSession
     * 
    **/
    select?: MicroSessionSelect | null
    /**
     * Choose, which related nodes to fetch as well.
     * 
    **/
    include?: MicroSessionInclude | null
  }



  /**
   * Enums
   */

  // Based on
  // https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275

  export const AccountScalarFieldEnum: {
    id: 'id',
    ssoType: 'ssoType',
    ssoId: 'ssoId',
    userId: 'userId'
  };

  export type AccountScalarFieldEnum = (typeof AccountScalarFieldEnum)[keyof typeof AccountScalarFieldEnum]


  export const AttachmentScalarFieldEnum: {
    id: 'id',
    name: 'name',
    originalName: 'originalName',
    description: 'description',
    type: 'type',
    questionId: 'questionId',
    ownerId: 'ownerId'
  };

  export type AttachmentScalarFieldEnum = (typeof AttachmentScalarFieldEnum)[keyof typeof AttachmentScalarFieldEnum]


  export const CourseScalarFieldEnum: {
    id: 'id',
    isArchived: 'isArchived',
    name: 'name',
    displayName: 'displayName',
    description: 'description',
    ownerId: 'ownerId'
  };

  export type CourseScalarFieldEnum = (typeof CourseScalarFieldEnum)[keyof typeof CourseScalarFieldEnum]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const LearningElementScalarFieldEnum: {
    id: 'id',
    ownerId: 'ownerId',
    courseId: 'courseId'
  };

  export type LearningElementScalarFieldEnum = (typeof LearningElementScalarFieldEnum)[keyof typeof LearningElementScalarFieldEnum]


  export const MicroSessionScalarFieldEnum: {
    id: 'id',
    scheduledStartAt: 'scheduledStartAt',
    scheduledEndAt: 'scheduledEndAt',
    ownerId: 'ownerId',
    courseId: 'courseId'
  };

  export type MicroSessionScalarFieldEnum = (typeof MicroSessionScalarFieldEnum)[keyof typeof MicroSessionScalarFieldEnum]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const QuestionInstanceScalarFieldEnum: {
    id: 'id',
    questionData: 'questionData',
    results: 'results',
    sessionBlockId: 'sessionBlockId',
    learningElementId: 'learningElementId',
    microSessionId: 'microSessionId',
    questionId: 'questionId',
    ownerId: 'ownerId'
  };

  export type QuestionInstanceScalarFieldEnum = (typeof QuestionInstanceScalarFieldEnum)[keyof typeof QuestionInstanceScalarFieldEnum]


  export const QuestionScalarFieldEnum: {
    id: 'id',
    isArchived: 'isArchived',
    isDeleted: 'isDeleted',
    name: 'name',
    content: 'content',
    contentPlain: 'contentPlain',
    options: 'options',
    type: 'type',
    ownerId: 'ownerId'
  };

  export type QuestionScalarFieldEnum = (typeof QuestionScalarFieldEnum)[keyof typeof QuestionScalarFieldEnum]


  export const SessionBlockScalarFieldEnum: {
    id: 'id',
    expiresAt: 'expiresAt',
    timeLimit: 'timeLimit',
    randomSelection: 'randomSelection',
    sessionId: 'sessionId'
  };

  export type SessionBlockScalarFieldEnum = (typeof SessionBlockScalarFieldEnum)[keyof typeof SessionBlockScalarFieldEnum]


  export const SessionScalarFieldEnum: {
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
  };

  export type SessionScalarFieldEnum = (typeof SessionScalarFieldEnum)[keyof typeof SessionScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const TagScalarFieldEnum: {
    id: 'id',
    ownerId: 'ownerId'
  };

  export type TagScalarFieldEnum = (typeof TagScalarFieldEnum)[keyof typeof TagScalarFieldEnum]


  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
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
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  /**
   * Deep Input Types
   */


  export type AccountWhereInput = {
    AND?: Enumerable<AccountWhereInput>
    OR?: Enumerable<AccountWhereInput>
    NOT?: Enumerable<AccountWhereInput>
    id?: StringFilter | string
    ssoType?: StringFilter | string
    ssoId?: StringFilter | string
    user?: XOR<UserRelationFilter, UserWhereInput>
    userId?: StringFilter | string
  }

  export type AccountOrderByWithRelationInput = {
    id?: SortOrder
    ssoType?: SortOrder
    ssoId?: SortOrder
    user?: UserOrderByWithRelationInput
    userId?: SortOrder
  }

  export type AccountWhereUniqueInput = {
    id?: string
  }

  export type AccountOrderByWithAggregationInput = {
    id?: SortOrder
    ssoType?: SortOrder
    ssoId?: SortOrder
    userId?: SortOrder
    _count?: AccountCountOrderByAggregateInput
    _max?: AccountMaxOrderByAggregateInput
    _min?: AccountMinOrderByAggregateInput
  }

  export type AccountScalarWhereWithAggregatesInput = {
    AND?: Enumerable<AccountScalarWhereWithAggregatesInput>
    OR?: Enumerable<AccountScalarWhereWithAggregatesInput>
    NOT?: Enumerable<AccountScalarWhereWithAggregatesInput>
    id?: StringWithAggregatesFilter | string
    ssoType?: StringWithAggregatesFilter | string
    ssoId?: StringWithAggregatesFilter | string
    userId?: StringWithAggregatesFilter | string
  }

  export type UserWhereInput = {
    AND?: Enumerable<UserWhereInput>
    OR?: Enumerable<UserWhereInput>
    NOT?: Enumerable<UserWhereInput>
    id?: StringFilter | string
    isActive?: BoolFilter | boolean
    isAAI?: BoolFilter | boolean
    email?: StringFilter | string
    shortname?: StringFilter | string
    password?: StringFilter | string
    salt?: StringFilter | string
    description?: StringNullableFilter | string | null
    lastLoginAt?: DateTimeNullableFilter | Date | string | null
    deletionToken?: StringNullableFilter | string | null
    deletionRequestedAt?: DateTimeNullableFilter | Date | string | null
    role?: EnumUserRoleFilter | UserRole
    accounts?: AccountListRelationFilter
    courses?: CourseListRelationFilter
    questions?: QuestionListRelationFilter
    attachments?: AttachmentListRelationFilter
    tags?: TagListRelationFilter
    questionInstances?: QuestionInstanceListRelationFilter
    sessions?: SessionListRelationFilter
    learningElements?: LearningElementListRelationFilter
    microSessions?: MicroSessionListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    isActive?: SortOrder
    isAAI?: SortOrder
    email?: SortOrder
    shortname?: SortOrder
    password?: SortOrder
    salt?: SortOrder
    description?: SortOrder
    lastLoginAt?: SortOrder
    deletionToken?: SortOrder
    deletionRequestedAt?: SortOrder
    role?: SortOrder
    accounts?: AccountOrderByRelationAggregateInput
    courses?: CourseOrderByRelationAggregateInput
    questions?: QuestionOrderByRelationAggregateInput
    attachments?: AttachmentOrderByRelationAggregateInput
    tags?: TagOrderByRelationAggregateInput
    questionInstances?: QuestionInstanceOrderByRelationAggregateInput
    sessions?: SessionOrderByRelationAggregateInput
    learningElements?: LearningElementOrderByRelationAggregateInput
    microSessions?: MicroSessionOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = {
    id?: string
    email?: string
    shortname?: string
  }

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    isActive?: SortOrder
    isAAI?: SortOrder
    email?: SortOrder
    shortname?: SortOrder
    password?: SortOrder
    salt?: SortOrder
    description?: SortOrder
    lastLoginAt?: SortOrder
    deletionToken?: SortOrder
    deletionRequestedAt?: SortOrder
    role?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: Enumerable<UserScalarWhereWithAggregatesInput>
    OR?: Enumerable<UserScalarWhereWithAggregatesInput>
    NOT?: Enumerable<UserScalarWhereWithAggregatesInput>
    id?: StringWithAggregatesFilter | string
    isActive?: BoolWithAggregatesFilter | boolean
    isAAI?: BoolWithAggregatesFilter | boolean
    email?: StringWithAggregatesFilter | string
    shortname?: StringWithAggregatesFilter | string
    password?: StringWithAggregatesFilter | string
    salt?: StringWithAggregatesFilter | string
    description?: StringNullableWithAggregatesFilter | string | null
    lastLoginAt?: DateTimeNullableWithAggregatesFilter | Date | string | null
    deletionToken?: StringNullableWithAggregatesFilter | string | null
    deletionRequestedAt?: DateTimeNullableWithAggregatesFilter | Date | string | null
    role?: EnumUserRoleWithAggregatesFilter | UserRole
  }

  export type AttachmentWhereInput = {
    AND?: Enumerable<AttachmentWhereInput>
    OR?: Enumerable<AttachmentWhereInput>
    NOT?: Enumerable<AttachmentWhereInput>
    id?: StringFilter | string
    name?: StringFilter | string
    originalName?: StringFilter | string
    description?: StringNullableFilter | string | null
    type?: EnumAttachmentTypeFilter | AttachmentType
    question?: XOR<QuestionRelationFilter, QuestionWhereInput> | null
    questionId?: StringNullableFilter | string | null
    owner?: XOR<UserRelationFilter, UserWhereInput>
    ownerId?: StringFilter | string
  }

  export type AttachmentOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    originalName?: SortOrder
    description?: SortOrder
    type?: SortOrder
    question?: QuestionOrderByWithRelationInput
    questionId?: SortOrder
    owner?: UserOrderByWithRelationInput
    ownerId?: SortOrder
  }

  export type AttachmentWhereUniqueInput = {
    id?: string
  }

  export type AttachmentOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    originalName?: SortOrder
    description?: SortOrder
    type?: SortOrder
    questionId?: SortOrder
    ownerId?: SortOrder
    _count?: AttachmentCountOrderByAggregateInput
    _max?: AttachmentMaxOrderByAggregateInput
    _min?: AttachmentMinOrderByAggregateInput
  }

  export type AttachmentScalarWhereWithAggregatesInput = {
    AND?: Enumerable<AttachmentScalarWhereWithAggregatesInput>
    OR?: Enumerable<AttachmentScalarWhereWithAggregatesInput>
    NOT?: Enumerable<AttachmentScalarWhereWithAggregatesInput>
    id?: StringWithAggregatesFilter | string
    name?: StringWithAggregatesFilter | string
    originalName?: StringWithAggregatesFilter | string
    description?: StringNullableWithAggregatesFilter | string | null
    type?: EnumAttachmentTypeWithAggregatesFilter | AttachmentType
    questionId?: StringNullableWithAggregatesFilter | string | null
    ownerId?: StringWithAggregatesFilter | string
  }

  export type QuestionWhereInput = {
    AND?: Enumerable<QuestionWhereInput>
    OR?: Enumerable<QuestionWhereInput>
    NOT?: Enumerable<QuestionWhereInput>
    id?: StringFilter | string
    isArchived?: BoolFilter | boolean
    isDeleted?: BoolFilter | boolean
    name?: StringFilter | string
    content?: StringFilter | string
    contentPlain?: StringFilter | string
    options?: JsonFilter
    type?: EnumQuestionTypeFilter | QuestionType
    attachments?: AttachmentListRelationFilter
    tags?: TagListRelationFilter
    instances?: QuestionInstanceListRelationFilter
    owner?: XOR<UserRelationFilter, UserWhereInput>
    ownerId?: StringFilter | string
  }

  export type QuestionOrderByWithRelationInput = {
    id?: SortOrder
    isArchived?: SortOrder
    isDeleted?: SortOrder
    name?: SortOrder
    content?: SortOrder
    contentPlain?: SortOrder
    options?: SortOrder
    type?: SortOrder
    attachments?: AttachmentOrderByRelationAggregateInput
    tags?: TagOrderByRelationAggregateInput
    instances?: QuestionInstanceOrderByRelationAggregateInput
    owner?: UserOrderByWithRelationInput
    ownerId?: SortOrder
  }

  export type QuestionWhereUniqueInput = {
    id?: string
  }

  export type QuestionOrderByWithAggregationInput = {
    id?: SortOrder
    isArchived?: SortOrder
    isDeleted?: SortOrder
    name?: SortOrder
    content?: SortOrder
    contentPlain?: SortOrder
    options?: SortOrder
    type?: SortOrder
    ownerId?: SortOrder
    _count?: QuestionCountOrderByAggregateInput
    _max?: QuestionMaxOrderByAggregateInput
    _min?: QuestionMinOrderByAggregateInput
  }

  export type QuestionScalarWhereWithAggregatesInput = {
    AND?: Enumerable<QuestionScalarWhereWithAggregatesInput>
    OR?: Enumerable<QuestionScalarWhereWithAggregatesInput>
    NOT?: Enumerable<QuestionScalarWhereWithAggregatesInput>
    id?: StringWithAggregatesFilter | string
    isArchived?: BoolWithAggregatesFilter | boolean
    isDeleted?: BoolWithAggregatesFilter | boolean
    name?: StringWithAggregatesFilter | string
    content?: StringWithAggregatesFilter | string
    contentPlain?: StringWithAggregatesFilter | string
    options?: JsonWithAggregatesFilter
    type?: EnumQuestionTypeWithAggregatesFilter | QuestionType
    ownerId?: StringWithAggregatesFilter | string
  }

  export type TagWhereInput = {
    AND?: Enumerable<TagWhereInput>
    OR?: Enumerable<TagWhereInput>
    NOT?: Enumerable<TagWhereInput>
    id?: IntFilter | number
    questions?: QuestionListRelationFilter
    owner?: XOR<UserRelationFilter, UserWhereInput>
    ownerId?: StringFilter | string
  }

  export type TagOrderByWithRelationInput = {
    id?: SortOrder
    questions?: QuestionOrderByRelationAggregateInput
    owner?: UserOrderByWithRelationInput
    ownerId?: SortOrder
  }

  export type TagWhereUniqueInput = {
    id?: number
  }

  export type TagOrderByWithAggregationInput = {
    id?: SortOrder
    ownerId?: SortOrder
    _count?: TagCountOrderByAggregateInput
    _avg?: TagAvgOrderByAggregateInput
    _max?: TagMaxOrderByAggregateInput
    _min?: TagMinOrderByAggregateInput
    _sum?: TagSumOrderByAggregateInput
  }

  export type TagScalarWhereWithAggregatesInput = {
    AND?: Enumerable<TagScalarWhereWithAggregatesInput>
    OR?: Enumerable<TagScalarWhereWithAggregatesInput>
    NOT?: Enumerable<TagScalarWhereWithAggregatesInput>
    id?: IntWithAggregatesFilter | number
    ownerId?: StringWithAggregatesFilter | string
  }

  export type QuestionInstanceWhereInput = {
    AND?: Enumerable<QuestionInstanceWhereInput>
    OR?: Enumerable<QuestionInstanceWhereInput>
    NOT?: Enumerable<QuestionInstanceWhereInput>
    id?: StringFilter | string
    questionData?: JsonFilter
    results?: JsonFilter
    sessionBlock?: XOR<SessionBlockRelationFilter, SessionBlockWhereInput> | null
    sessionBlockId?: IntNullableFilter | number | null
    learningElement?: XOR<LearningElementRelationFilter, LearningElementWhereInput> | null
    learningElementId?: StringNullableFilter | string | null
    microSession?: XOR<MicroSessionRelationFilter, MicroSessionWhereInput> | null
    microSessionId?: StringNullableFilter | string | null
    question?: XOR<QuestionRelationFilter, QuestionWhereInput>
    questionId?: StringFilter | string
    owner?: XOR<UserRelationFilter, UserWhereInput>
    ownerId?: StringFilter | string
  }

  export type QuestionInstanceOrderByWithRelationInput = {
    id?: SortOrder
    questionData?: SortOrder
    results?: SortOrder
    sessionBlock?: SessionBlockOrderByWithRelationInput
    sessionBlockId?: SortOrder
    learningElement?: LearningElementOrderByWithRelationInput
    learningElementId?: SortOrder
    microSession?: MicroSessionOrderByWithRelationInput
    microSessionId?: SortOrder
    question?: QuestionOrderByWithRelationInput
    questionId?: SortOrder
    owner?: UserOrderByWithRelationInput
    ownerId?: SortOrder
  }

  export type QuestionInstanceWhereUniqueInput = {
    id?: string
  }

  export type QuestionInstanceOrderByWithAggregationInput = {
    id?: SortOrder
    questionData?: SortOrder
    results?: SortOrder
    sessionBlockId?: SortOrder
    learningElementId?: SortOrder
    microSessionId?: SortOrder
    questionId?: SortOrder
    ownerId?: SortOrder
    _count?: QuestionInstanceCountOrderByAggregateInput
    _avg?: QuestionInstanceAvgOrderByAggregateInput
    _max?: QuestionInstanceMaxOrderByAggregateInput
    _min?: QuestionInstanceMinOrderByAggregateInput
    _sum?: QuestionInstanceSumOrderByAggregateInput
  }

  export type QuestionInstanceScalarWhereWithAggregatesInput = {
    AND?: Enumerable<QuestionInstanceScalarWhereWithAggregatesInput>
    OR?: Enumerable<QuestionInstanceScalarWhereWithAggregatesInput>
    NOT?: Enumerable<QuestionInstanceScalarWhereWithAggregatesInput>
    id?: StringWithAggregatesFilter | string
    questionData?: JsonWithAggregatesFilter
    results?: JsonWithAggregatesFilter
    sessionBlockId?: IntNullableWithAggregatesFilter | number | null
    learningElementId?: StringNullableWithAggregatesFilter | string | null
    microSessionId?: StringNullableWithAggregatesFilter | string | null
    questionId?: StringWithAggregatesFilter | string
    ownerId?: StringWithAggregatesFilter | string
  }

  export type CourseWhereInput = {
    AND?: Enumerable<CourseWhereInput>
    OR?: Enumerable<CourseWhereInput>
    NOT?: Enumerable<CourseWhereInput>
    id?: StringFilter | string
    isArchived?: BoolFilter | boolean
    name?: StringFilter | string
    displayName?: StringFilter | string
    description?: StringNullableFilter | string | null
    sessions?: SessionListRelationFilter
    learningElements?: LearningElementListRelationFilter
    microSessions?: MicroSessionListRelationFilter
    owner?: XOR<UserRelationFilter, UserWhereInput>
    ownerId?: StringFilter | string
  }

  export type CourseOrderByWithRelationInput = {
    id?: SortOrder
    isArchived?: SortOrder
    name?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    sessions?: SessionOrderByRelationAggregateInput
    learningElements?: LearningElementOrderByRelationAggregateInput
    microSessions?: MicroSessionOrderByRelationAggregateInput
    owner?: UserOrderByWithRelationInput
    ownerId?: SortOrder
  }

  export type CourseWhereUniqueInput = {
    id?: string
  }

  export type CourseOrderByWithAggregationInput = {
    id?: SortOrder
    isArchived?: SortOrder
    name?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    ownerId?: SortOrder
    _count?: CourseCountOrderByAggregateInput
    _max?: CourseMaxOrderByAggregateInput
    _min?: CourseMinOrderByAggregateInput
  }

  export type CourseScalarWhereWithAggregatesInput = {
    AND?: Enumerable<CourseScalarWhereWithAggregatesInput>
    OR?: Enumerable<CourseScalarWhereWithAggregatesInput>
    NOT?: Enumerable<CourseScalarWhereWithAggregatesInput>
    id?: StringWithAggregatesFilter | string
    isArchived?: BoolWithAggregatesFilter | boolean
    name?: StringWithAggregatesFilter | string
    displayName?: StringWithAggregatesFilter | string
    description?: StringNullableWithAggregatesFilter | string | null
    ownerId?: StringWithAggregatesFilter | string
  }

  export type SessionWhereInput = {
    AND?: Enumerable<SessionWhereInput>
    OR?: Enumerable<SessionWhereInput>
    NOT?: Enumerable<SessionWhereInput>
    id?: StringFilter | string
    namespace?: StringFilter | string
    execution?: IntFilter | number
    name?: StringFilter | string
    displayName?: StringFilter | string
    settings?: JsonFilter
    startedAt?: DateTimeFilter | Date | string
    finishedAt?: DateTimeFilter | Date | string
    accessMode?: EnumAccessModeFilter | AccessMode
    status?: EnumSessionStatusFilter | SessionStatus
    blocks?: SessionBlockListRelationFilter
    owner?: XOR<UserRelationFilter, UserWhereInput>
    ownerId?: StringFilter | string
    course?: XOR<CourseRelationFilter, CourseWhereInput>
    courseId?: StringFilter | string
  }

  export type SessionOrderByWithRelationInput = {
    id?: SortOrder
    namespace?: SortOrder
    execution?: SortOrder
    name?: SortOrder
    displayName?: SortOrder
    settings?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrder
    accessMode?: SortOrder
    status?: SortOrder
    blocks?: SessionBlockOrderByRelationAggregateInput
    owner?: UserOrderByWithRelationInput
    ownerId?: SortOrder
    course?: CourseOrderByWithRelationInput
    courseId?: SortOrder
  }

  export type SessionWhereUniqueInput = {
    id?: string
  }

  export type SessionOrderByWithAggregationInput = {
    id?: SortOrder
    namespace?: SortOrder
    execution?: SortOrder
    name?: SortOrder
    displayName?: SortOrder
    settings?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrder
    accessMode?: SortOrder
    status?: SortOrder
    ownerId?: SortOrder
    courseId?: SortOrder
    _count?: SessionCountOrderByAggregateInput
    _avg?: SessionAvgOrderByAggregateInput
    _max?: SessionMaxOrderByAggregateInput
    _min?: SessionMinOrderByAggregateInput
    _sum?: SessionSumOrderByAggregateInput
  }

  export type SessionScalarWhereWithAggregatesInput = {
    AND?: Enumerable<SessionScalarWhereWithAggregatesInput>
    OR?: Enumerable<SessionScalarWhereWithAggregatesInput>
    NOT?: Enumerable<SessionScalarWhereWithAggregatesInput>
    id?: StringWithAggregatesFilter | string
    namespace?: StringWithAggregatesFilter | string
    execution?: IntWithAggregatesFilter | number
    name?: StringWithAggregatesFilter | string
    displayName?: StringWithAggregatesFilter | string
    settings?: JsonWithAggregatesFilter
    startedAt?: DateTimeWithAggregatesFilter | Date | string
    finishedAt?: DateTimeWithAggregatesFilter | Date | string
    accessMode?: EnumAccessModeWithAggregatesFilter | AccessMode
    status?: EnumSessionStatusWithAggregatesFilter | SessionStatus
    ownerId?: StringWithAggregatesFilter | string
    courseId?: StringWithAggregatesFilter | string
  }

  export type SessionBlockWhereInput = {
    AND?: Enumerable<SessionBlockWhereInput>
    OR?: Enumerable<SessionBlockWhereInput>
    NOT?: Enumerable<SessionBlockWhereInput>
    id?: IntFilter | number
    expiresAt?: DateTimeNullableFilter | Date | string | null
    timeLimit?: IntNullableFilter | number | null
    randomSelection?: IntNullableFilter | number | null
    instances?: QuestionInstanceListRelationFilter
    session?: XOR<SessionRelationFilter, SessionWhereInput>
    sessionId?: StringFilter | string
  }

  export type SessionBlockOrderByWithRelationInput = {
    id?: SortOrder
    expiresAt?: SortOrder
    timeLimit?: SortOrder
    randomSelection?: SortOrder
    instances?: QuestionInstanceOrderByRelationAggregateInput
    session?: SessionOrderByWithRelationInput
    sessionId?: SortOrder
  }

  export type SessionBlockWhereUniqueInput = {
    id?: number
  }

  export type SessionBlockOrderByWithAggregationInput = {
    id?: SortOrder
    expiresAt?: SortOrder
    timeLimit?: SortOrder
    randomSelection?: SortOrder
    sessionId?: SortOrder
    _count?: SessionBlockCountOrderByAggregateInput
    _avg?: SessionBlockAvgOrderByAggregateInput
    _max?: SessionBlockMaxOrderByAggregateInput
    _min?: SessionBlockMinOrderByAggregateInput
    _sum?: SessionBlockSumOrderByAggregateInput
  }

  export type SessionBlockScalarWhereWithAggregatesInput = {
    AND?: Enumerable<SessionBlockScalarWhereWithAggregatesInput>
    OR?: Enumerable<SessionBlockScalarWhereWithAggregatesInput>
    NOT?: Enumerable<SessionBlockScalarWhereWithAggregatesInput>
    id?: IntWithAggregatesFilter | number
    expiresAt?: DateTimeNullableWithAggregatesFilter | Date | string | null
    timeLimit?: IntNullableWithAggregatesFilter | number | null
    randomSelection?: IntNullableWithAggregatesFilter | number | null
    sessionId?: StringWithAggregatesFilter | string
  }

  export type LearningElementWhereInput = {
    AND?: Enumerable<LearningElementWhereInput>
    OR?: Enumerable<LearningElementWhereInput>
    NOT?: Enumerable<LearningElementWhereInput>
    id?: StringFilter | string
    instances?: QuestionInstanceListRelationFilter
    owner?: XOR<UserRelationFilter, UserWhereInput>
    ownerId?: StringFilter | string
    course?: XOR<CourseRelationFilter, CourseWhereInput>
    courseId?: StringFilter | string
  }

  export type LearningElementOrderByWithRelationInput = {
    id?: SortOrder
    instances?: QuestionInstanceOrderByRelationAggregateInput
    owner?: UserOrderByWithRelationInput
    ownerId?: SortOrder
    course?: CourseOrderByWithRelationInput
    courseId?: SortOrder
  }

  export type LearningElementWhereUniqueInput = {
    id?: string
  }

  export type LearningElementOrderByWithAggregationInput = {
    id?: SortOrder
    ownerId?: SortOrder
    courseId?: SortOrder
    _count?: LearningElementCountOrderByAggregateInput
    _max?: LearningElementMaxOrderByAggregateInput
    _min?: LearningElementMinOrderByAggregateInput
  }

  export type LearningElementScalarWhereWithAggregatesInput = {
    AND?: Enumerable<LearningElementScalarWhereWithAggregatesInput>
    OR?: Enumerable<LearningElementScalarWhereWithAggregatesInput>
    NOT?: Enumerable<LearningElementScalarWhereWithAggregatesInput>
    id?: StringWithAggregatesFilter | string
    ownerId?: StringWithAggregatesFilter | string
    courseId?: StringWithAggregatesFilter | string
  }

  export type MicroSessionWhereInput = {
    AND?: Enumerable<MicroSessionWhereInput>
    OR?: Enumerable<MicroSessionWhereInput>
    NOT?: Enumerable<MicroSessionWhereInput>
    id?: StringFilter | string
    scheduledStartAt?: DateTimeFilter | Date | string
    scheduledEndAt?: DateTimeFilter | Date | string
    instances?: QuestionInstanceListRelationFilter
    owner?: XOR<UserRelationFilter, UserWhereInput>
    ownerId?: StringFilter | string
    course?: XOR<CourseRelationFilter, CourseWhereInput>
    courseId?: StringFilter | string
  }

  export type MicroSessionOrderByWithRelationInput = {
    id?: SortOrder
    scheduledStartAt?: SortOrder
    scheduledEndAt?: SortOrder
    instances?: QuestionInstanceOrderByRelationAggregateInput
    owner?: UserOrderByWithRelationInput
    ownerId?: SortOrder
    course?: CourseOrderByWithRelationInput
    courseId?: SortOrder
  }

  export type MicroSessionWhereUniqueInput = {
    id?: string
  }

  export type MicroSessionOrderByWithAggregationInput = {
    id?: SortOrder
    scheduledStartAt?: SortOrder
    scheduledEndAt?: SortOrder
    ownerId?: SortOrder
    courseId?: SortOrder
    _count?: MicroSessionCountOrderByAggregateInput
    _max?: MicroSessionMaxOrderByAggregateInput
    _min?: MicroSessionMinOrderByAggregateInput
  }

  export type MicroSessionScalarWhereWithAggregatesInput = {
    AND?: Enumerable<MicroSessionScalarWhereWithAggregatesInput>
    OR?: Enumerable<MicroSessionScalarWhereWithAggregatesInput>
    NOT?: Enumerable<MicroSessionScalarWhereWithAggregatesInput>
    id?: StringWithAggregatesFilter | string
    scheduledStartAt?: DateTimeWithAggregatesFilter | Date | string
    scheduledEndAt?: DateTimeWithAggregatesFilter | Date | string
    ownerId?: StringWithAggregatesFilter | string
    courseId?: StringWithAggregatesFilter | string
  }

  export type AccountCreateInput = {
    id?: string
    ssoType: string
    ssoId: string
    user: UserCreateNestedOneWithoutAccountsInput
  }

  export type AccountUncheckedCreateInput = {
    id?: string
    ssoType: string
    ssoId: string
    userId: string
  }

  export type AccountUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    ssoType?: StringFieldUpdateOperationsInput | string
    ssoId?: StringFieldUpdateOperationsInput | string
    user?: UserUpdateOneRequiredWithoutAccountsNestedInput
  }

  export type AccountUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    ssoType?: StringFieldUpdateOperationsInput | string
    ssoId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
  }

  export type AccountCreateManyInput = {
    id?: string
    ssoType: string
    ssoId: string
    userId: string
  }

  export type AccountUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    ssoType?: StringFieldUpdateOperationsInput | string
    ssoId?: StringFieldUpdateOperationsInput | string
  }

  export type AccountUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    ssoType?: StringFieldUpdateOperationsInput | string
    ssoId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
  }

  export type UserCreateInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountCreateNestedManyWithoutUserInput
    courses?: CourseCreateNestedManyWithoutOwnerInput
    questions?: QuestionCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentCreateNestedManyWithoutOwnerInput
    tags?: TagCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceCreateNestedManyWithoutOwnerInput
    sessions?: SessionCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionCreateNestedManyWithoutOwnerInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    courses?: CourseUncheckedCreateNestedManyWithoutOwnerInput
    questions?: QuestionUncheckedCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentUncheckedCreateNestedManyWithoutOwnerInput
    tags?: TagUncheckedCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceUncheckedCreateNestedManyWithoutOwnerInput
    sessions?: SessionUncheckedCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementUncheckedCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionUncheckedCreateNestedManyWithoutOwnerInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUpdateManyWithoutUserNestedInput
    courses?: CourseUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUpdateManyWithoutOwnerNestedInput
    tags?: TagUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUpdateManyWithoutOwnerNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    courses?: CourseUncheckedUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUncheckedUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUncheckedUpdateManyWithoutOwnerNestedInput
    tags?: TagUncheckedUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUncheckedUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUncheckedUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUncheckedUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUncheckedUpdateManyWithoutOwnerNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
  }

  export type AttachmentCreateInput = {
    id?: string
    name: string
    originalName: string
    description?: string | null
    type: AttachmentType
    question?: QuestionCreateNestedOneWithoutAttachmentsInput
    owner: UserCreateNestedOneWithoutAttachmentsInput
  }

  export type AttachmentUncheckedCreateInput = {
    id?: string
    name: string
    originalName: string
    description?: string | null
    type: AttachmentType
    questionId?: string | null
    ownerId: string
  }

  export type AttachmentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    originalName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: EnumAttachmentTypeFieldUpdateOperationsInput | AttachmentType
    question?: QuestionUpdateOneWithoutAttachmentsNestedInput
    owner?: UserUpdateOneRequiredWithoutAttachmentsNestedInput
  }

  export type AttachmentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    originalName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: EnumAttachmentTypeFieldUpdateOperationsInput | AttachmentType
    questionId?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type AttachmentCreateManyInput = {
    id?: string
    name: string
    originalName: string
    description?: string | null
    type: AttachmentType
    questionId?: string | null
    ownerId: string
  }

  export type AttachmentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    originalName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: EnumAttachmentTypeFieldUpdateOperationsInput | AttachmentType
  }

  export type AttachmentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    originalName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: EnumAttachmentTypeFieldUpdateOperationsInput | AttachmentType
    questionId?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type QuestionCreateInput = {
    id?: string
    isArchived?: boolean
    isDeleted?: boolean
    name: string
    content: string
    contentPlain: string
    options: JsonNullValueInput | InputJsonValue
    type: QuestionType
    attachments?: AttachmentCreateNestedManyWithoutQuestionInput
    tags?: TagCreateNestedManyWithoutQuestionsInput
    instances?: QuestionInstanceCreateNestedManyWithoutQuestionInput
    owner: UserCreateNestedOneWithoutQuestionsInput
  }

  export type QuestionUncheckedCreateInput = {
    id?: string
    isArchived?: boolean
    isDeleted?: boolean
    name: string
    content: string
    contentPlain: string
    options: JsonNullValueInput | InputJsonValue
    type: QuestionType
    attachments?: AttachmentUncheckedCreateNestedManyWithoutQuestionInput
    tags?: TagUncheckedCreateNestedManyWithoutQuestionsInput
    instances?: QuestionInstanceUncheckedCreateNestedManyWithoutQuestionInput
    ownerId: string
  }

  export type QuestionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    contentPlain?: StringFieldUpdateOperationsInput | string
    options?: JsonNullValueInput | InputJsonValue
    type?: EnumQuestionTypeFieldUpdateOperationsInput | QuestionType
    attachments?: AttachmentUpdateManyWithoutQuestionNestedInput
    tags?: TagUpdateManyWithoutQuestionsNestedInput
    instances?: QuestionInstanceUpdateManyWithoutQuestionNestedInput
    owner?: UserUpdateOneRequiredWithoutQuestionsNestedInput
  }

  export type QuestionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    contentPlain?: StringFieldUpdateOperationsInput | string
    options?: JsonNullValueInput | InputJsonValue
    type?: EnumQuestionTypeFieldUpdateOperationsInput | QuestionType
    attachments?: AttachmentUncheckedUpdateManyWithoutQuestionNestedInput
    tags?: TagUncheckedUpdateManyWithoutQuestionsNestedInput
    instances?: QuestionInstanceUncheckedUpdateManyWithoutQuestionNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type QuestionCreateManyInput = {
    id?: string
    isArchived?: boolean
    isDeleted?: boolean
    name: string
    content: string
    contentPlain: string
    options: JsonNullValueInput | InputJsonValue
    type: QuestionType
    ownerId: string
  }

  export type QuestionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    contentPlain?: StringFieldUpdateOperationsInput | string
    options?: JsonNullValueInput | InputJsonValue
    type?: EnumQuestionTypeFieldUpdateOperationsInput | QuestionType
  }

  export type QuestionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    contentPlain?: StringFieldUpdateOperationsInput | string
    options?: JsonNullValueInput | InputJsonValue
    type?: EnumQuestionTypeFieldUpdateOperationsInput | QuestionType
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type TagCreateInput = {
    questions?: QuestionCreateNestedManyWithoutTagsInput
    owner: UserCreateNestedOneWithoutTagsInput
  }

  export type TagUncheckedCreateInput = {
    id?: number
    questions?: QuestionUncheckedCreateNestedManyWithoutTagsInput
    ownerId: string
  }

  export type TagUpdateInput = {
    questions?: QuestionUpdateManyWithoutTagsNestedInput
    owner?: UserUpdateOneRequiredWithoutTagsNestedInput
  }

  export type TagUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    questions?: QuestionUncheckedUpdateManyWithoutTagsNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type TagCreateManyInput = {
    id?: number
    ownerId: string
  }

  export type TagUpdateManyMutationInput = {

  }

  export type TagUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type QuestionInstanceCreateInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlock?: SessionBlockCreateNestedOneWithoutInstancesInput
    learningElement?: LearningElementCreateNestedOneWithoutInstancesInput
    microSession?: MicroSessionCreateNestedOneWithoutInstancesInput
    question: QuestionCreateNestedOneWithoutInstancesInput
    owner: UserCreateNestedOneWithoutQuestionInstancesInput
  }

  export type QuestionInstanceUncheckedCreateInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlockId?: number | null
    learningElementId?: string | null
    microSessionId?: string | null
    questionId: string
    ownerId: string
  }

  export type QuestionInstanceUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    sessionBlock?: SessionBlockUpdateOneWithoutInstancesNestedInput
    learningElement?: LearningElementUpdateOneWithoutInstancesNestedInput
    microSession?: MicroSessionUpdateOneWithoutInstancesNestedInput
    question?: QuestionUpdateOneRequiredWithoutInstancesNestedInput
    owner?: UserUpdateOneRequiredWithoutQuestionInstancesNestedInput
  }

  export type QuestionInstanceUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    sessionBlockId?: NullableIntFieldUpdateOperationsInput | number | null
    learningElementId?: NullableStringFieldUpdateOperationsInput | string | null
    microSessionId?: NullableStringFieldUpdateOperationsInput | string | null
    questionId?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type QuestionInstanceCreateManyInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlockId?: number | null
    learningElementId?: string | null
    microSessionId?: string | null
    questionId: string
    ownerId: string
  }

  export type QuestionInstanceUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
  }

  export type QuestionInstanceUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    sessionBlockId?: NullableIntFieldUpdateOperationsInput | number | null
    learningElementId?: NullableStringFieldUpdateOperationsInput | string | null
    microSessionId?: NullableStringFieldUpdateOperationsInput | string | null
    questionId?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type CourseCreateInput = {
    id?: string
    isArchived?: boolean
    name: string
    displayName: string
    description?: string | null
    sessions?: SessionCreateNestedManyWithoutCourseInput
    learningElements?: LearningElementCreateNestedManyWithoutCourseInput
    microSessions?: MicroSessionCreateNestedManyWithoutCourseInput
    owner: UserCreateNestedOneWithoutCoursesInput
  }

  export type CourseUncheckedCreateInput = {
    id?: string
    isArchived?: boolean
    name: string
    displayName: string
    description?: string | null
    sessions?: SessionUncheckedCreateNestedManyWithoutCourseInput
    learningElements?: LearningElementUncheckedCreateNestedManyWithoutCourseInput
    microSessions?: MicroSessionUncheckedCreateNestedManyWithoutCourseInput
    ownerId: string
  }

  export type CourseUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sessions?: SessionUpdateManyWithoutCourseNestedInput
    learningElements?: LearningElementUpdateManyWithoutCourseNestedInput
    microSessions?: MicroSessionUpdateManyWithoutCourseNestedInput
    owner?: UserUpdateOneRequiredWithoutCoursesNestedInput
  }

  export type CourseUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sessions?: SessionUncheckedUpdateManyWithoutCourseNestedInput
    learningElements?: LearningElementUncheckedUpdateManyWithoutCourseNestedInput
    microSessions?: MicroSessionUncheckedUpdateManyWithoutCourseNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type CourseCreateManyInput = {
    id?: string
    isArchived?: boolean
    name: string
    displayName: string
    description?: string | null
    ownerId: string
  }

  export type CourseUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type CourseUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type SessionCreateInput = {
    id?: string
    namespace?: string
    execution?: number
    name: string
    displayName: string
    settings: JsonNullValueInput | InputJsonValue
    startedAt: Date | string
    finishedAt: Date | string
    accessMode?: AccessMode
    status: SessionStatus
    blocks?: SessionBlockCreateNestedManyWithoutSessionInput
    owner: UserCreateNestedOneWithoutSessionsInput
    course: CourseCreateNestedOneWithoutSessionsInput
  }

  export type SessionUncheckedCreateInput = {
    id?: string
    namespace?: string
    execution?: number
    name: string
    displayName: string
    settings: JsonNullValueInput | InputJsonValue
    startedAt: Date | string
    finishedAt: Date | string
    accessMode?: AccessMode
    status: SessionStatus
    blocks?: SessionBlockUncheckedCreateNestedManyWithoutSessionInput
    ownerId: string
    courseId: string
  }

  export type SessionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    namespace?: StringFieldUpdateOperationsInput | string
    execution?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accessMode?: EnumAccessModeFieldUpdateOperationsInput | AccessMode
    status?: EnumSessionStatusFieldUpdateOperationsInput | SessionStatus
    blocks?: SessionBlockUpdateManyWithoutSessionNestedInput
    owner?: UserUpdateOneRequiredWithoutSessionsNestedInput
    course?: CourseUpdateOneRequiredWithoutSessionsNestedInput
  }

  export type SessionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    namespace?: StringFieldUpdateOperationsInput | string
    execution?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accessMode?: EnumAccessModeFieldUpdateOperationsInput | AccessMode
    status?: EnumSessionStatusFieldUpdateOperationsInput | SessionStatus
    blocks?: SessionBlockUncheckedUpdateManyWithoutSessionNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type SessionCreateManyInput = {
    id?: string
    namespace?: string
    execution?: number
    name: string
    displayName: string
    settings: JsonNullValueInput | InputJsonValue
    startedAt: Date | string
    finishedAt: Date | string
    accessMode?: AccessMode
    status: SessionStatus
    ownerId: string
    courseId: string
  }

  export type SessionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    namespace?: StringFieldUpdateOperationsInput | string
    execution?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accessMode?: EnumAccessModeFieldUpdateOperationsInput | AccessMode
    status?: EnumSessionStatusFieldUpdateOperationsInput | SessionStatus
  }

  export type SessionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    namespace?: StringFieldUpdateOperationsInput | string
    execution?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accessMode?: EnumAccessModeFieldUpdateOperationsInput | AccessMode
    status?: EnumSessionStatusFieldUpdateOperationsInput | SessionStatus
    ownerId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type SessionBlockCreateInput = {
    expiresAt?: Date | string | null
    timeLimit?: number | null
    randomSelection?: number | null
    instances?: QuestionInstanceCreateNestedManyWithoutSessionBlockInput
    session: SessionCreateNestedOneWithoutBlocksInput
  }

  export type SessionBlockUncheckedCreateInput = {
    id?: number
    expiresAt?: Date | string | null
    timeLimit?: number | null
    randomSelection?: number | null
    instances?: QuestionInstanceUncheckedCreateNestedManyWithoutSessionBlockInput
    sessionId: string
  }

  export type SessionBlockUpdateInput = {
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    timeLimit?: NullableIntFieldUpdateOperationsInput | number | null
    randomSelection?: NullableIntFieldUpdateOperationsInput | number | null
    instances?: QuestionInstanceUpdateManyWithoutSessionBlockNestedInput
    session?: SessionUpdateOneRequiredWithoutBlocksNestedInput
  }

  export type SessionBlockUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    timeLimit?: NullableIntFieldUpdateOperationsInput | number | null
    randomSelection?: NullableIntFieldUpdateOperationsInput | number | null
    instances?: QuestionInstanceUncheckedUpdateManyWithoutSessionBlockNestedInput
    sessionId?: StringFieldUpdateOperationsInput | string
  }

  export type SessionBlockCreateManyInput = {
    id?: number
    expiresAt?: Date | string | null
    timeLimit?: number | null
    randomSelection?: number | null
    sessionId: string
  }

  export type SessionBlockUpdateManyMutationInput = {
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    timeLimit?: NullableIntFieldUpdateOperationsInput | number | null
    randomSelection?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type SessionBlockUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    timeLimit?: NullableIntFieldUpdateOperationsInput | number | null
    randomSelection?: NullableIntFieldUpdateOperationsInput | number | null
    sessionId?: StringFieldUpdateOperationsInput | string
  }

  export type LearningElementCreateInput = {
    id?: string
    instances?: QuestionInstanceCreateNestedManyWithoutLearningElementInput
    owner: UserCreateNestedOneWithoutLearningElementsInput
    course: CourseCreateNestedOneWithoutLearningElementsInput
  }

  export type LearningElementUncheckedCreateInput = {
    id?: string
    instances?: QuestionInstanceUncheckedCreateNestedManyWithoutLearningElementInput
    ownerId: string
    courseId: string
  }

  export type LearningElementUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    instances?: QuestionInstanceUpdateManyWithoutLearningElementNestedInput
    owner?: UserUpdateOneRequiredWithoutLearningElementsNestedInput
    course?: CourseUpdateOneRequiredWithoutLearningElementsNestedInput
  }

  export type LearningElementUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    instances?: QuestionInstanceUncheckedUpdateManyWithoutLearningElementNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type LearningElementCreateManyInput = {
    id?: string
    ownerId: string
    courseId: string
  }

  export type LearningElementUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
  }

  export type LearningElementUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type MicroSessionCreateInput = {
    id?: string
    scheduledStartAt: Date | string
    scheduledEndAt: Date | string
    instances?: QuestionInstanceCreateNestedManyWithoutMicroSessionInput
    owner: UserCreateNestedOneWithoutMicroSessionsInput
    course: CourseCreateNestedOneWithoutMicroSessionsInput
  }

  export type MicroSessionUncheckedCreateInput = {
    id?: string
    scheduledStartAt: Date | string
    scheduledEndAt: Date | string
    instances?: QuestionInstanceUncheckedCreateNestedManyWithoutMicroSessionInput
    ownerId: string
    courseId: string
  }

  export type MicroSessionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduledStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduledEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
    instances?: QuestionInstanceUpdateManyWithoutMicroSessionNestedInput
    owner?: UserUpdateOneRequiredWithoutMicroSessionsNestedInput
    course?: CourseUpdateOneRequiredWithoutMicroSessionsNestedInput
  }

  export type MicroSessionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduledStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduledEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
    instances?: QuestionInstanceUncheckedUpdateManyWithoutMicroSessionNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type MicroSessionCreateManyInput = {
    id?: string
    scheduledStartAt: Date | string
    scheduledEndAt: Date | string
    ownerId: string
    courseId: string
  }

  export type MicroSessionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduledStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduledEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MicroSessionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduledStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduledEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
    ownerId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type StringFilter = {
    equals?: string
    in?: Enumerable<string>
    notIn?: Enumerable<string>
    lt?: string
    lte?: string
    gt?: string
    gte?: string
    contains?: string
    startsWith?: string
    endsWith?: string
    mode?: QueryMode
    not?: NestedStringFilter | string
  }

  export type UserRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type AccountCountOrderByAggregateInput = {
    id?: SortOrder
    ssoType?: SortOrder
    ssoId?: SortOrder
    userId?: SortOrder
  }

  export type AccountMaxOrderByAggregateInput = {
    id?: SortOrder
    ssoType?: SortOrder
    ssoId?: SortOrder
    userId?: SortOrder
  }

  export type AccountMinOrderByAggregateInput = {
    id?: SortOrder
    ssoType?: SortOrder
    ssoId?: SortOrder
    userId?: SortOrder
  }

  export type StringWithAggregatesFilter = {
    equals?: string
    in?: Enumerable<string>
    notIn?: Enumerable<string>
    lt?: string
    lte?: string
    gt?: string
    gte?: string
    contains?: string
    startsWith?: string
    endsWith?: string
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter | string
    _count?: NestedIntFilter
    _min?: NestedStringFilter
    _max?: NestedStringFilter
  }

  export type BoolFilter = {
    equals?: boolean
    not?: NestedBoolFilter | boolean
  }

  export type StringNullableFilter = {
    equals?: string | null
    in?: Enumerable<string> | null
    notIn?: Enumerable<string> | null
    lt?: string
    lte?: string
    gt?: string
    gte?: string
    contains?: string
    startsWith?: string
    endsWith?: string
    mode?: QueryMode
    not?: NestedStringNullableFilter | string | null
  }

  export type DateTimeNullableFilter = {
    equals?: Date | string | null
    in?: Enumerable<Date> | Enumerable<string> | null
    notIn?: Enumerable<Date> | Enumerable<string> | null
    lt?: Date | string
    lte?: Date | string
    gt?: Date | string
    gte?: Date | string
    not?: NestedDateTimeNullableFilter | Date | string | null
  }

  export type EnumUserRoleFilter = {
    equals?: UserRole
    in?: Enumerable<UserRole>
    notIn?: Enumerable<UserRole>
    not?: NestedEnumUserRoleFilter | UserRole
  }

  export type AccountListRelationFilter = {
    every?: AccountWhereInput
    some?: AccountWhereInput
    none?: AccountWhereInput
  }

  export type CourseListRelationFilter = {
    every?: CourseWhereInput
    some?: CourseWhereInput
    none?: CourseWhereInput
  }

  export type QuestionListRelationFilter = {
    every?: QuestionWhereInput
    some?: QuestionWhereInput
    none?: QuestionWhereInput
  }

  export type AttachmentListRelationFilter = {
    every?: AttachmentWhereInput
    some?: AttachmentWhereInput
    none?: AttachmentWhereInput
  }

  export type TagListRelationFilter = {
    every?: TagWhereInput
    some?: TagWhereInput
    none?: TagWhereInput
  }

  export type QuestionInstanceListRelationFilter = {
    every?: QuestionInstanceWhereInput
    some?: QuestionInstanceWhereInput
    none?: QuestionInstanceWhereInput
  }

  export type SessionListRelationFilter = {
    every?: SessionWhereInput
    some?: SessionWhereInput
    none?: SessionWhereInput
  }

  export type LearningElementListRelationFilter = {
    every?: LearningElementWhereInput
    some?: LearningElementWhereInput
    none?: LearningElementWhereInput
  }

  export type MicroSessionListRelationFilter = {
    every?: MicroSessionWhereInput
    some?: MicroSessionWhereInput
    none?: MicroSessionWhereInput
  }

  export type AccountOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CourseOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type QuestionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type AttachmentOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TagOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type QuestionInstanceOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type SessionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type LearningElementOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type MicroSessionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    isActive?: SortOrder
    isAAI?: SortOrder
    email?: SortOrder
    shortname?: SortOrder
    password?: SortOrder
    salt?: SortOrder
    description?: SortOrder
    lastLoginAt?: SortOrder
    deletionToken?: SortOrder
    deletionRequestedAt?: SortOrder
    role?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    isActive?: SortOrder
    isAAI?: SortOrder
    email?: SortOrder
    shortname?: SortOrder
    password?: SortOrder
    salt?: SortOrder
    description?: SortOrder
    lastLoginAt?: SortOrder
    deletionToken?: SortOrder
    deletionRequestedAt?: SortOrder
    role?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    isActive?: SortOrder
    isAAI?: SortOrder
    email?: SortOrder
    shortname?: SortOrder
    password?: SortOrder
    salt?: SortOrder
    description?: SortOrder
    lastLoginAt?: SortOrder
    deletionToken?: SortOrder
    deletionRequestedAt?: SortOrder
    role?: SortOrder
  }

  export type BoolWithAggregatesFilter = {
    equals?: boolean
    not?: NestedBoolWithAggregatesFilter | boolean
    _count?: NestedIntFilter
    _min?: NestedBoolFilter
    _max?: NestedBoolFilter
  }

  export type StringNullableWithAggregatesFilter = {
    equals?: string | null
    in?: Enumerable<string> | null
    notIn?: Enumerable<string> | null
    lt?: string
    lte?: string
    gt?: string
    gte?: string
    contains?: string
    startsWith?: string
    endsWith?: string
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter | string | null
    _count?: NestedIntNullableFilter
    _min?: NestedStringNullableFilter
    _max?: NestedStringNullableFilter
  }

  export type DateTimeNullableWithAggregatesFilter = {
    equals?: Date | string | null
    in?: Enumerable<Date> | Enumerable<string> | null
    notIn?: Enumerable<Date> | Enumerable<string> | null
    lt?: Date | string
    lte?: Date | string
    gt?: Date | string
    gte?: Date | string
    not?: NestedDateTimeNullableWithAggregatesFilter | Date | string | null
    _count?: NestedIntNullableFilter
    _min?: NestedDateTimeNullableFilter
    _max?: NestedDateTimeNullableFilter
  }

  export type EnumUserRoleWithAggregatesFilter = {
    equals?: UserRole
    in?: Enumerable<UserRole>
    notIn?: Enumerable<UserRole>
    not?: NestedEnumUserRoleWithAggregatesFilter | UserRole
    _count?: NestedIntFilter
    _min?: NestedEnumUserRoleFilter
    _max?: NestedEnumUserRoleFilter
  }

  export type EnumAttachmentTypeFilter = {
    equals?: AttachmentType
    in?: Enumerable<AttachmentType>
    notIn?: Enumerable<AttachmentType>
    not?: NestedEnumAttachmentTypeFilter | AttachmentType
  }

  export type QuestionRelationFilter = {
    is?: QuestionWhereInput | null
    isNot?: QuestionWhereInput | null
  }

  export type AttachmentCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    originalName?: SortOrder
    description?: SortOrder
    type?: SortOrder
    questionId?: SortOrder
    ownerId?: SortOrder
  }

  export type AttachmentMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    originalName?: SortOrder
    description?: SortOrder
    type?: SortOrder
    questionId?: SortOrder
    ownerId?: SortOrder
  }

  export type AttachmentMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    originalName?: SortOrder
    description?: SortOrder
    type?: SortOrder
    questionId?: SortOrder
    ownerId?: SortOrder
  }

  export type EnumAttachmentTypeWithAggregatesFilter = {
    equals?: AttachmentType
    in?: Enumerable<AttachmentType>
    notIn?: Enumerable<AttachmentType>
    not?: NestedEnumAttachmentTypeWithAggregatesFilter | AttachmentType
    _count?: NestedIntFilter
    _min?: NestedEnumAttachmentTypeFilter
    _max?: NestedEnumAttachmentTypeFilter
  }
  export type JsonFilter = 
    | PatchUndefined<
        Either<Required<JsonFilterBase>, Exclude<keyof Required<JsonFilterBase>, 'path'>>,
        Required<JsonFilterBase>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase>, 'path'>>

  export type JsonFilterBase = {
    equals?: JsonNullValueFilter | InputJsonValue
    path?: Array<string>
    string_contains?: string
    string_starts_with?: string
    string_ends_with?: string
    array_contains?: InputJsonValue | null
    array_starts_with?: InputJsonValue | null
    array_ends_with?: InputJsonValue | null
    lt?: InputJsonValue
    lte?: InputJsonValue
    gt?: InputJsonValue
    gte?: InputJsonValue
    not?: JsonNullValueFilter | InputJsonValue
  }

  export type EnumQuestionTypeFilter = {
    equals?: QuestionType
    in?: Enumerable<QuestionType>
    notIn?: Enumerable<QuestionType>
    not?: NestedEnumQuestionTypeFilter | QuestionType
  }

  export type QuestionCountOrderByAggregateInput = {
    id?: SortOrder
    isArchived?: SortOrder
    isDeleted?: SortOrder
    name?: SortOrder
    content?: SortOrder
    contentPlain?: SortOrder
    options?: SortOrder
    type?: SortOrder
    ownerId?: SortOrder
  }

  export type QuestionMaxOrderByAggregateInput = {
    id?: SortOrder
    isArchived?: SortOrder
    isDeleted?: SortOrder
    name?: SortOrder
    content?: SortOrder
    contentPlain?: SortOrder
    type?: SortOrder
    ownerId?: SortOrder
  }

  export type QuestionMinOrderByAggregateInput = {
    id?: SortOrder
    isArchived?: SortOrder
    isDeleted?: SortOrder
    name?: SortOrder
    content?: SortOrder
    contentPlain?: SortOrder
    type?: SortOrder
    ownerId?: SortOrder
  }
  export type JsonWithAggregatesFilter = 
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase>, Exclude<keyof Required<JsonWithAggregatesFilterBase>, 'path'>>,
        Required<JsonWithAggregatesFilterBase>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase>, 'path'>>

  export type JsonWithAggregatesFilterBase = {
    equals?: JsonNullValueFilter | InputJsonValue
    path?: Array<string>
    string_contains?: string
    string_starts_with?: string
    string_ends_with?: string
    array_contains?: InputJsonValue | null
    array_starts_with?: InputJsonValue | null
    array_ends_with?: InputJsonValue | null
    lt?: InputJsonValue
    lte?: InputJsonValue
    gt?: InputJsonValue
    gte?: InputJsonValue
    not?: JsonNullValueFilter | InputJsonValue
    _count?: NestedIntFilter
    _min?: NestedJsonFilter
    _max?: NestedJsonFilter
  }

  export type EnumQuestionTypeWithAggregatesFilter = {
    equals?: QuestionType
    in?: Enumerable<QuestionType>
    notIn?: Enumerable<QuestionType>
    not?: NestedEnumQuestionTypeWithAggregatesFilter | QuestionType
    _count?: NestedIntFilter
    _min?: NestedEnumQuestionTypeFilter
    _max?: NestedEnumQuestionTypeFilter
  }

  export type IntFilter = {
    equals?: number
    in?: Enumerable<number>
    notIn?: Enumerable<number>
    lt?: number
    lte?: number
    gt?: number
    gte?: number
    not?: NestedIntFilter | number
  }

  export type TagCountOrderByAggregateInput = {
    id?: SortOrder
    ownerId?: SortOrder
  }

  export type TagAvgOrderByAggregateInput = {
    id?: SortOrder
  }

  export type TagMaxOrderByAggregateInput = {
    id?: SortOrder
    ownerId?: SortOrder
  }

  export type TagMinOrderByAggregateInput = {
    id?: SortOrder
    ownerId?: SortOrder
  }

  export type TagSumOrderByAggregateInput = {
    id?: SortOrder
  }

  export type IntWithAggregatesFilter = {
    equals?: number
    in?: Enumerable<number>
    notIn?: Enumerable<number>
    lt?: number
    lte?: number
    gt?: number
    gte?: number
    not?: NestedIntWithAggregatesFilter | number
    _count?: NestedIntFilter
    _avg?: NestedFloatFilter
    _sum?: NestedIntFilter
    _min?: NestedIntFilter
    _max?: NestedIntFilter
  }

  export type SessionBlockRelationFilter = {
    is?: SessionBlockWhereInput | null
    isNot?: SessionBlockWhereInput | null
  }

  export type IntNullableFilter = {
    equals?: number | null
    in?: Enumerable<number> | null
    notIn?: Enumerable<number> | null
    lt?: number
    lte?: number
    gt?: number
    gte?: number
    not?: NestedIntNullableFilter | number | null
  }

  export type LearningElementRelationFilter = {
    is?: LearningElementWhereInput | null
    isNot?: LearningElementWhereInput | null
  }

  export type MicroSessionRelationFilter = {
    is?: MicroSessionWhereInput | null
    isNot?: MicroSessionWhereInput | null
  }

  export type QuestionInstanceCountOrderByAggregateInput = {
    id?: SortOrder
    questionData?: SortOrder
    results?: SortOrder
    sessionBlockId?: SortOrder
    learningElementId?: SortOrder
    microSessionId?: SortOrder
    questionId?: SortOrder
    ownerId?: SortOrder
  }

  export type QuestionInstanceAvgOrderByAggregateInput = {
    sessionBlockId?: SortOrder
  }

  export type QuestionInstanceMaxOrderByAggregateInput = {
    id?: SortOrder
    sessionBlockId?: SortOrder
    learningElementId?: SortOrder
    microSessionId?: SortOrder
    questionId?: SortOrder
    ownerId?: SortOrder
  }

  export type QuestionInstanceMinOrderByAggregateInput = {
    id?: SortOrder
    sessionBlockId?: SortOrder
    learningElementId?: SortOrder
    microSessionId?: SortOrder
    questionId?: SortOrder
    ownerId?: SortOrder
  }

  export type QuestionInstanceSumOrderByAggregateInput = {
    sessionBlockId?: SortOrder
  }

  export type IntNullableWithAggregatesFilter = {
    equals?: number | null
    in?: Enumerable<number> | null
    notIn?: Enumerable<number> | null
    lt?: number
    lte?: number
    gt?: number
    gte?: number
    not?: NestedIntNullableWithAggregatesFilter | number | null
    _count?: NestedIntNullableFilter
    _avg?: NestedFloatNullableFilter
    _sum?: NestedIntNullableFilter
    _min?: NestedIntNullableFilter
    _max?: NestedIntNullableFilter
  }

  export type CourseCountOrderByAggregateInput = {
    id?: SortOrder
    isArchived?: SortOrder
    name?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    ownerId?: SortOrder
  }

  export type CourseMaxOrderByAggregateInput = {
    id?: SortOrder
    isArchived?: SortOrder
    name?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    ownerId?: SortOrder
  }

  export type CourseMinOrderByAggregateInput = {
    id?: SortOrder
    isArchived?: SortOrder
    name?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    ownerId?: SortOrder
  }

  export type DateTimeFilter = {
    equals?: Date | string
    in?: Enumerable<Date> | Enumerable<string>
    notIn?: Enumerable<Date> | Enumerable<string>
    lt?: Date | string
    lte?: Date | string
    gt?: Date | string
    gte?: Date | string
    not?: NestedDateTimeFilter | Date | string
  }

  export type EnumAccessModeFilter = {
    equals?: AccessMode
    in?: Enumerable<AccessMode>
    notIn?: Enumerable<AccessMode>
    not?: NestedEnumAccessModeFilter | AccessMode
  }

  export type EnumSessionStatusFilter = {
    equals?: SessionStatus
    in?: Enumerable<SessionStatus>
    notIn?: Enumerable<SessionStatus>
    not?: NestedEnumSessionStatusFilter | SessionStatus
  }

  export type SessionBlockListRelationFilter = {
    every?: SessionBlockWhereInput
    some?: SessionBlockWhereInput
    none?: SessionBlockWhereInput
  }

  export type CourseRelationFilter = {
    is?: CourseWhereInput
    isNot?: CourseWhereInput
  }

  export type SessionBlockOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type SessionCountOrderByAggregateInput = {
    id?: SortOrder
    namespace?: SortOrder
    execution?: SortOrder
    name?: SortOrder
    displayName?: SortOrder
    settings?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrder
    accessMode?: SortOrder
    status?: SortOrder
    ownerId?: SortOrder
    courseId?: SortOrder
  }

  export type SessionAvgOrderByAggregateInput = {
    execution?: SortOrder
  }

  export type SessionMaxOrderByAggregateInput = {
    id?: SortOrder
    namespace?: SortOrder
    execution?: SortOrder
    name?: SortOrder
    displayName?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrder
    accessMode?: SortOrder
    status?: SortOrder
    ownerId?: SortOrder
    courseId?: SortOrder
  }

  export type SessionMinOrderByAggregateInput = {
    id?: SortOrder
    namespace?: SortOrder
    execution?: SortOrder
    name?: SortOrder
    displayName?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrder
    accessMode?: SortOrder
    status?: SortOrder
    ownerId?: SortOrder
    courseId?: SortOrder
  }

  export type SessionSumOrderByAggregateInput = {
    execution?: SortOrder
  }

  export type DateTimeWithAggregatesFilter = {
    equals?: Date | string
    in?: Enumerable<Date> | Enumerable<string>
    notIn?: Enumerable<Date> | Enumerable<string>
    lt?: Date | string
    lte?: Date | string
    gt?: Date | string
    gte?: Date | string
    not?: NestedDateTimeWithAggregatesFilter | Date | string
    _count?: NestedIntFilter
    _min?: NestedDateTimeFilter
    _max?: NestedDateTimeFilter
  }

  export type EnumAccessModeWithAggregatesFilter = {
    equals?: AccessMode
    in?: Enumerable<AccessMode>
    notIn?: Enumerable<AccessMode>
    not?: NestedEnumAccessModeWithAggregatesFilter | AccessMode
    _count?: NestedIntFilter
    _min?: NestedEnumAccessModeFilter
    _max?: NestedEnumAccessModeFilter
  }

  export type EnumSessionStatusWithAggregatesFilter = {
    equals?: SessionStatus
    in?: Enumerable<SessionStatus>
    notIn?: Enumerable<SessionStatus>
    not?: NestedEnumSessionStatusWithAggregatesFilter | SessionStatus
    _count?: NestedIntFilter
    _min?: NestedEnumSessionStatusFilter
    _max?: NestedEnumSessionStatusFilter
  }

  export type SessionRelationFilter = {
    is?: SessionWhereInput
    isNot?: SessionWhereInput
  }

  export type SessionBlockCountOrderByAggregateInput = {
    id?: SortOrder
    expiresAt?: SortOrder
    timeLimit?: SortOrder
    randomSelection?: SortOrder
    sessionId?: SortOrder
  }

  export type SessionBlockAvgOrderByAggregateInput = {
    id?: SortOrder
    timeLimit?: SortOrder
    randomSelection?: SortOrder
  }

  export type SessionBlockMaxOrderByAggregateInput = {
    id?: SortOrder
    expiresAt?: SortOrder
    timeLimit?: SortOrder
    randomSelection?: SortOrder
    sessionId?: SortOrder
  }

  export type SessionBlockMinOrderByAggregateInput = {
    id?: SortOrder
    expiresAt?: SortOrder
    timeLimit?: SortOrder
    randomSelection?: SortOrder
    sessionId?: SortOrder
  }

  export type SessionBlockSumOrderByAggregateInput = {
    id?: SortOrder
    timeLimit?: SortOrder
    randomSelection?: SortOrder
  }

  export type LearningElementCountOrderByAggregateInput = {
    id?: SortOrder
    ownerId?: SortOrder
    courseId?: SortOrder
  }

  export type LearningElementMaxOrderByAggregateInput = {
    id?: SortOrder
    ownerId?: SortOrder
    courseId?: SortOrder
  }

  export type LearningElementMinOrderByAggregateInput = {
    id?: SortOrder
    ownerId?: SortOrder
    courseId?: SortOrder
  }

  export type MicroSessionCountOrderByAggregateInput = {
    id?: SortOrder
    scheduledStartAt?: SortOrder
    scheduledEndAt?: SortOrder
    ownerId?: SortOrder
    courseId?: SortOrder
  }

  export type MicroSessionMaxOrderByAggregateInput = {
    id?: SortOrder
    scheduledStartAt?: SortOrder
    scheduledEndAt?: SortOrder
    ownerId?: SortOrder
    courseId?: SortOrder
  }

  export type MicroSessionMinOrderByAggregateInput = {
    id?: SortOrder
    scheduledStartAt?: SortOrder
    scheduledEndAt?: SortOrder
    ownerId?: SortOrder
    courseId?: SortOrder
  }

  export type UserCreateNestedOneWithoutAccountsInput = {
    create?: XOR<UserCreateWithoutAccountsInput, UserUncheckedCreateWithoutAccountsInput>
    connectOrCreate?: UserCreateOrConnectWithoutAccountsInput
    connect?: UserWhereUniqueInput
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type UserUpdateOneRequiredWithoutAccountsNestedInput = {
    create?: XOR<UserCreateWithoutAccountsInput, UserUncheckedCreateWithoutAccountsInput>
    connectOrCreate?: UserCreateOrConnectWithoutAccountsInput
    upsert?: UserUpsertWithoutAccountsInput
    connect?: UserWhereUniqueInput
    update?: XOR<UserUpdateWithoutAccountsInput, UserUncheckedUpdateWithoutAccountsInput>
  }

  export type AccountCreateNestedManyWithoutUserInput = {
    create?: XOR<Enumerable<AccountCreateWithoutUserInput>, Enumerable<AccountUncheckedCreateWithoutUserInput>>
    connectOrCreate?: Enumerable<AccountCreateOrConnectWithoutUserInput>
    createMany?: AccountCreateManyUserInputEnvelope
    connect?: Enumerable<AccountWhereUniqueInput>
  }

  export type CourseCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<CourseCreateWithoutOwnerInput>, Enumerable<CourseUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<CourseCreateOrConnectWithoutOwnerInput>
    createMany?: CourseCreateManyOwnerInputEnvelope
    connect?: Enumerable<CourseWhereUniqueInput>
  }

  export type QuestionCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<QuestionCreateWithoutOwnerInput>, Enumerable<QuestionUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<QuestionCreateOrConnectWithoutOwnerInput>
    createMany?: QuestionCreateManyOwnerInputEnvelope
    connect?: Enumerable<QuestionWhereUniqueInput>
  }

  export type AttachmentCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<AttachmentCreateWithoutOwnerInput>, Enumerable<AttachmentUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<AttachmentCreateOrConnectWithoutOwnerInput>
    createMany?: AttachmentCreateManyOwnerInputEnvelope
    connect?: Enumerable<AttachmentWhereUniqueInput>
  }

  export type TagCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<TagCreateWithoutOwnerInput>, Enumerable<TagUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<TagCreateOrConnectWithoutOwnerInput>
    createMany?: TagCreateManyOwnerInputEnvelope
    connect?: Enumerable<TagWhereUniqueInput>
  }

  export type QuestionInstanceCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutOwnerInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutOwnerInput>
    createMany?: QuestionInstanceCreateManyOwnerInputEnvelope
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
  }

  export type SessionCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<SessionCreateWithoutOwnerInput>, Enumerable<SessionUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<SessionCreateOrConnectWithoutOwnerInput>
    createMany?: SessionCreateManyOwnerInputEnvelope
    connect?: Enumerable<SessionWhereUniqueInput>
  }

  export type LearningElementCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<LearningElementCreateWithoutOwnerInput>, Enumerable<LearningElementUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<LearningElementCreateOrConnectWithoutOwnerInput>
    createMany?: LearningElementCreateManyOwnerInputEnvelope
    connect?: Enumerable<LearningElementWhereUniqueInput>
  }

  export type MicroSessionCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<MicroSessionCreateWithoutOwnerInput>, Enumerable<MicroSessionUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<MicroSessionCreateOrConnectWithoutOwnerInput>
    createMany?: MicroSessionCreateManyOwnerInputEnvelope
    connect?: Enumerable<MicroSessionWhereUniqueInput>
  }

  export type AccountUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<Enumerable<AccountCreateWithoutUserInput>, Enumerable<AccountUncheckedCreateWithoutUserInput>>
    connectOrCreate?: Enumerable<AccountCreateOrConnectWithoutUserInput>
    createMany?: AccountCreateManyUserInputEnvelope
    connect?: Enumerable<AccountWhereUniqueInput>
  }

  export type CourseUncheckedCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<CourseCreateWithoutOwnerInput>, Enumerable<CourseUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<CourseCreateOrConnectWithoutOwnerInput>
    createMany?: CourseCreateManyOwnerInputEnvelope
    connect?: Enumerable<CourseWhereUniqueInput>
  }

  export type QuestionUncheckedCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<QuestionCreateWithoutOwnerInput>, Enumerable<QuestionUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<QuestionCreateOrConnectWithoutOwnerInput>
    createMany?: QuestionCreateManyOwnerInputEnvelope
    connect?: Enumerable<QuestionWhereUniqueInput>
  }

  export type AttachmentUncheckedCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<AttachmentCreateWithoutOwnerInput>, Enumerable<AttachmentUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<AttachmentCreateOrConnectWithoutOwnerInput>
    createMany?: AttachmentCreateManyOwnerInputEnvelope
    connect?: Enumerable<AttachmentWhereUniqueInput>
  }

  export type TagUncheckedCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<TagCreateWithoutOwnerInput>, Enumerable<TagUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<TagCreateOrConnectWithoutOwnerInput>
    createMany?: TagCreateManyOwnerInputEnvelope
    connect?: Enumerable<TagWhereUniqueInput>
  }

  export type QuestionInstanceUncheckedCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutOwnerInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutOwnerInput>
    createMany?: QuestionInstanceCreateManyOwnerInputEnvelope
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
  }

  export type SessionUncheckedCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<SessionCreateWithoutOwnerInput>, Enumerable<SessionUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<SessionCreateOrConnectWithoutOwnerInput>
    createMany?: SessionCreateManyOwnerInputEnvelope
    connect?: Enumerable<SessionWhereUniqueInput>
  }

  export type LearningElementUncheckedCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<LearningElementCreateWithoutOwnerInput>, Enumerable<LearningElementUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<LearningElementCreateOrConnectWithoutOwnerInput>
    createMany?: LearningElementCreateManyOwnerInputEnvelope
    connect?: Enumerable<LearningElementWhereUniqueInput>
  }

  export type MicroSessionUncheckedCreateNestedManyWithoutOwnerInput = {
    create?: XOR<Enumerable<MicroSessionCreateWithoutOwnerInput>, Enumerable<MicroSessionUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<MicroSessionCreateOrConnectWithoutOwnerInput>
    createMany?: MicroSessionCreateManyOwnerInputEnvelope
    connect?: Enumerable<MicroSessionWhereUniqueInput>
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type EnumUserRoleFieldUpdateOperationsInput = {
    set?: UserRole
  }

  export type AccountUpdateManyWithoutUserNestedInput = {
    create?: XOR<Enumerable<AccountCreateWithoutUserInput>, Enumerable<AccountUncheckedCreateWithoutUserInput>>
    connectOrCreate?: Enumerable<AccountCreateOrConnectWithoutUserInput>
    upsert?: Enumerable<AccountUpsertWithWhereUniqueWithoutUserInput>
    createMany?: AccountCreateManyUserInputEnvelope
    set?: Enumerable<AccountWhereUniqueInput>
    disconnect?: Enumerable<AccountWhereUniqueInput>
    delete?: Enumerable<AccountWhereUniqueInput>
    connect?: Enumerable<AccountWhereUniqueInput>
    update?: Enumerable<AccountUpdateWithWhereUniqueWithoutUserInput>
    updateMany?: Enumerable<AccountUpdateManyWithWhereWithoutUserInput>
    deleteMany?: Enumerable<AccountScalarWhereInput>
  }

  export type CourseUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<CourseCreateWithoutOwnerInput>, Enumerable<CourseUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<CourseCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<CourseUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: CourseCreateManyOwnerInputEnvelope
    set?: Enumerable<CourseWhereUniqueInput>
    disconnect?: Enumerable<CourseWhereUniqueInput>
    delete?: Enumerable<CourseWhereUniqueInput>
    connect?: Enumerable<CourseWhereUniqueInput>
    update?: Enumerable<CourseUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<CourseUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<CourseScalarWhereInput>
  }

  export type QuestionUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<QuestionCreateWithoutOwnerInput>, Enumerable<QuestionUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<QuestionCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<QuestionUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: QuestionCreateManyOwnerInputEnvelope
    set?: Enumerable<QuestionWhereUniqueInput>
    disconnect?: Enumerable<QuestionWhereUniqueInput>
    delete?: Enumerable<QuestionWhereUniqueInput>
    connect?: Enumerable<QuestionWhereUniqueInput>
    update?: Enumerable<QuestionUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<QuestionUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<QuestionScalarWhereInput>
  }

  export type AttachmentUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<AttachmentCreateWithoutOwnerInput>, Enumerable<AttachmentUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<AttachmentCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<AttachmentUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: AttachmentCreateManyOwnerInputEnvelope
    set?: Enumerable<AttachmentWhereUniqueInput>
    disconnect?: Enumerable<AttachmentWhereUniqueInput>
    delete?: Enumerable<AttachmentWhereUniqueInput>
    connect?: Enumerable<AttachmentWhereUniqueInput>
    update?: Enumerable<AttachmentUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<AttachmentUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<AttachmentScalarWhereInput>
  }

  export type TagUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<TagCreateWithoutOwnerInput>, Enumerable<TagUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<TagCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<TagUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: TagCreateManyOwnerInputEnvelope
    set?: Enumerable<TagWhereUniqueInput>
    disconnect?: Enumerable<TagWhereUniqueInput>
    delete?: Enumerable<TagWhereUniqueInput>
    connect?: Enumerable<TagWhereUniqueInput>
    update?: Enumerable<TagUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<TagUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<TagScalarWhereInput>
  }

  export type QuestionInstanceUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutOwnerInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<QuestionInstanceUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: QuestionInstanceCreateManyOwnerInputEnvelope
    set?: Enumerable<QuestionInstanceWhereUniqueInput>
    disconnect?: Enumerable<QuestionInstanceWhereUniqueInput>
    delete?: Enumerable<QuestionInstanceWhereUniqueInput>
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
    update?: Enumerable<QuestionInstanceUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<QuestionInstanceUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<QuestionInstanceScalarWhereInput>
  }

  export type SessionUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<SessionCreateWithoutOwnerInput>, Enumerable<SessionUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<SessionCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<SessionUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: SessionCreateManyOwnerInputEnvelope
    set?: Enumerable<SessionWhereUniqueInput>
    disconnect?: Enumerable<SessionWhereUniqueInput>
    delete?: Enumerable<SessionWhereUniqueInput>
    connect?: Enumerable<SessionWhereUniqueInput>
    update?: Enumerable<SessionUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<SessionUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<SessionScalarWhereInput>
  }

  export type LearningElementUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<LearningElementCreateWithoutOwnerInput>, Enumerable<LearningElementUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<LearningElementCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<LearningElementUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: LearningElementCreateManyOwnerInputEnvelope
    set?: Enumerable<LearningElementWhereUniqueInput>
    disconnect?: Enumerable<LearningElementWhereUniqueInput>
    delete?: Enumerable<LearningElementWhereUniqueInput>
    connect?: Enumerable<LearningElementWhereUniqueInput>
    update?: Enumerable<LearningElementUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<LearningElementUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<LearningElementScalarWhereInput>
  }

  export type MicroSessionUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<MicroSessionCreateWithoutOwnerInput>, Enumerable<MicroSessionUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<MicroSessionCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<MicroSessionUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: MicroSessionCreateManyOwnerInputEnvelope
    set?: Enumerable<MicroSessionWhereUniqueInput>
    disconnect?: Enumerable<MicroSessionWhereUniqueInput>
    delete?: Enumerable<MicroSessionWhereUniqueInput>
    connect?: Enumerable<MicroSessionWhereUniqueInput>
    update?: Enumerable<MicroSessionUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<MicroSessionUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<MicroSessionScalarWhereInput>
  }

  export type AccountUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<Enumerable<AccountCreateWithoutUserInput>, Enumerable<AccountUncheckedCreateWithoutUserInput>>
    connectOrCreate?: Enumerable<AccountCreateOrConnectWithoutUserInput>
    upsert?: Enumerable<AccountUpsertWithWhereUniqueWithoutUserInput>
    createMany?: AccountCreateManyUserInputEnvelope
    set?: Enumerable<AccountWhereUniqueInput>
    disconnect?: Enumerable<AccountWhereUniqueInput>
    delete?: Enumerable<AccountWhereUniqueInput>
    connect?: Enumerable<AccountWhereUniqueInput>
    update?: Enumerable<AccountUpdateWithWhereUniqueWithoutUserInput>
    updateMany?: Enumerable<AccountUpdateManyWithWhereWithoutUserInput>
    deleteMany?: Enumerable<AccountScalarWhereInput>
  }

  export type CourseUncheckedUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<CourseCreateWithoutOwnerInput>, Enumerable<CourseUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<CourseCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<CourseUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: CourseCreateManyOwnerInputEnvelope
    set?: Enumerable<CourseWhereUniqueInput>
    disconnect?: Enumerable<CourseWhereUniqueInput>
    delete?: Enumerable<CourseWhereUniqueInput>
    connect?: Enumerable<CourseWhereUniqueInput>
    update?: Enumerable<CourseUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<CourseUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<CourseScalarWhereInput>
  }

  export type QuestionUncheckedUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<QuestionCreateWithoutOwnerInput>, Enumerable<QuestionUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<QuestionCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<QuestionUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: QuestionCreateManyOwnerInputEnvelope
    set?: Enumerable<QuestionWhereUniqueInput>
    disconnect?: Enumerable<QuestionWhereUniqueInput>
    delete?: Enumerable<QuestionWhereUniqueInput>
    connect?: Enumerable<QuestionWhereUniqueInput>
    update?: Enumerable<QuestionUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<QuestionUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<QuestionScalarWhereInput>
  }

  export type AttachmentUncheckedUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<AttachmentCreateWithoutOwnerInput>, Enumerable<AttachmentUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<AttachmentCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<AttachmentUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: AttachmentCreateManyOwnerInputEnvelope
    set?: Enumerable<AttachmentWhereUniqueInput>
    disconnect?: Enumerable<AttachmentWhereUniqueInput>
    delete?: Enumerable<AttachmentWhereUniqueInput>
    connect?: Enumerable<AttachmentWhereUniqueInput>
    update?: Enumerable<AttachmentUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<AttachmentUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<AttachmentScalarWhereInput>
  }

  export type TagUncheckedUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<TagCreateWithoutOwnerInput>, Enumerable<TagUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<TagCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<TagUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: TagCreateManyOwnerInputEnvelope
    set?: Enumerable<TagWhereUniqueInput>
    disconnect?: Enumerable<TagWhereUniqueInput>
    delete?: Enumerable<TagWhereUniqueInput>
    connect?: Enumerable<TagWhereUniqueInput>
    update?: Enumerable<TagUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<TagUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<TagScalarWhereInput>
  }

  export type QuestionInstanceUncheckedUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutOwnerInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<QuestionInstanceUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: QuestionInstanceCreateManyOwnerInputEnvelope
    set?: Enumerable<QuestionInstanceWhereUniqueInput>
    disconnect?: Enumerable<QuestionInstanceWhereUniqueInput>
    delete?: Enumerable<QuestionInstanceWhereUniqueInput>
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
    update?: Enumerable<QuestionInstanceUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<QuestionInstanceUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<QuestionInstanceScalarWhereInput>
  }

  export type SessionUncheckedUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<SessionCreateWithoutOwnerInput>, Enumerable<SessionUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<SessionCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<SessionUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: SessionCreateManyOwnerInputEnvelope
    set?: Enumerable<SessionWhereUniqueInput>
    disconnect?: Enumerable<SessionWhereUniqueInput>
    delete?: Enumerable<SessionWhereUniqueInput>
    connect?: Enumerable<SessionWhereUniqueInput>
    update?: Enumerable<SessionUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<SessionUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<SessionScalarWhereInput>
  }

  export type LearningElementUncheckedUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<LearningElementCreateWithoutOwnerInput>, Enumerable<LearningElementUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<LearningElementCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<LearningElementUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: LearningElementCreateManyOwnerInputEnvelope
    set?: Enumerable<LearningElementWhereUniqueInput>
    disconnect?: Enumerable<LearningElementWhereUniqueInput>
    delete?: Enumerable<LearningElementWhereUniqueInput>
    connect?: Enumerable<LearningElementWhereUniqueInput>
    update?: Enumerable<LearningElementUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<LearningElementUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<LearningElementScalarWhereInput>
  }

  export type MicroSessionUncheckedUpdateManyWithoutOwnerNestedInput = {
    create?: XOR<Enumerable<MicroSessionCreateWithoutOwnerInput>, Enumerable<MicroSessionUncheckedCreateWithoutOwnerInput>>
    connectOrCreate?: Enumerable<MicroSessionCreateOrConnectWithoutOwnerInput>
    upsert?: Enumerable<MicroSessionUpsertWithWhereUniqueWithoutOwnerInput>
    createMany?: MicroSessionCreateManyOwnerInputEnvelope
    set?: Enumerable<MicroSessionWhereUniqueInput>
    disconnect?: Enumerable<MicroSessionWhereUniqueInput>
    delete?: Enumerable<MicroSessionWhereUniqueInput>
    connect?: Enumerable<MicroSessionWhereUniqueInput>
    update?: Enumerable<MicroSessionUpdateWithWhereUniqueWithoutOwnerInput>
    updateMany?: Enumerable<MicroSessionUpdateManyWithWhereWithoutOwnerInput>
    deleteMany?: Enumerable<MicroSessionScalarWhereInput>
  }

  export type QuestionCreateNestedOneWithoutAttachmentsInput = {
    create?: XOR<QuestionCreateWithoutAttachmentsInput, QuestionUncheckedCreateWithoutAttachmentsInput>
    connectOrCreate?: QuestionCreateOrConnectWithoutAttachmentsInput
    connect?: QuestionWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutAttachmentsInput = {
    create?: XOR<UserCreateWithoutAttachmentsInput, UserUncheckedCreateWithoutAttachmentsInput>
    connectOrCreate?: UserCreateOrConnectWithoutAttachmentsInput
    connect?: UserWhereUniqueInput
  }

  export type EnumAttachmentTypeFieldUpdateOperationsInput = {
    set?: AttachmentType
  }

  export type QuestionUpdateOneWithoutAttachmentsNestedInput = {
    create?: XOR<QuestionCreateWithoutAttachmentsInput, QuestionUncheckedCreateWithoutAttachmentsInput>
    connectOrCreate?: QuestionCreateOrConnectWithoutAttachmentsInput
    upsert?: QuestionUpsertWithoutAttachmentsInput
    disconnect?: boolean
    delete?: boolean
    connect?: QuestionWhereUniqueInput
    update?: XOR<QuestionUpdateWithoutAttachmentsInput, QuestionUncheckedUpdateWithoutAttachmentsInput>
  }

  export type UserUpdateOneRequiredWithoutAttachmentsNestedInput = {
    create?: XOR<UserCreateWithoutAttachmentsInput, UserUncheckedCreateWithoutAttachmentsInput>
    connectOrCreate?: UserCreateOrConnectWithoutAttachmentsInput
    upsert?: UserUpsertWithoutAttachmentsInput
    connect?: UserWhereUniqueInput
    update?: XOR<UserUpdateWithoutAttachmentsInput, UserUncheckedUpdateWithoutAttachmentsInput>
  }

  export type AttachmentCreateNestedManyWithoutQuestionInput = {
    create?: XOR<Enumerable<AttachmentCreateWithoutQuestionInput>, Enumerable<AttachmentUncheckedCreateWithoutQuestionInput>>
    connectOrCreate?: Enumerable<AttachmentCreateOrConnectWithoutQuestionInput>
    createMany?: AttachmentCreateManyQuestionInputEnvelope
    connect?: Enumerable<AttachmentWhereUniqueInput>
  }

  export type TagCreateNestedManyWithoutQuestionsInput = {
    create?: XOR<Enumerable<TagCreateWithoutQuestionsInput>, Enumerable<TagUncheckedCreateWithoutQuestionsInput>>
    connectOrCreate?: Enumerable<TagCreateOrConnectWithoutQuestionsInput>
    connect?: Enumerable<TagWhereUniqueInput>
  }

  export type QuestionInstanceCreateNestedManyWithoutQuestionInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutQuestionInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutQuestionInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutQuestionInput>
    createMany?: QuestionInstanceCreateManyQuestionInputEnvelope
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
  }

  export type UserCreateNestedOneWithoutQuestionsInput = {
    create?: XOR<UserCreateWithoutQuestionsInput, UserUncheckedCreateWithoutQuestionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutQuestionsInput
    connect?: UserWhereUniqueInput
  }

  export type AttachmentUncheckedCreateNestedManyWithoutQuestionInput = {
    create?: XOR<Enumerable<AttachmentCreateWithoutQuestionInput>, Enumerable<AttachmentUncheckedCreateWithoutQuestionInput>>
    connectOrCreate?: Enumerable<AttachmentCreateOrConnectWithoutQuestionInput>
    createMany?: AttachmentCreateManyQuestionInputEnvelope
    connect?: Enumerable<AttachmentWhereUniqueInput>
  }

  export type TagUncheckedCreateNestedManyWithoutQuestionsInput = {
    create?: XOR<Enumerable<TagCreateWithoutQuestionsInput>, Enumerable<TagUncheckedCreateWithoutQuestionsInput>>
    connectOrCreate?: Enumerable<TagCreateOrConnectWithoutQuestionsInput>
    connect?: Enumerable<TagWhereUniqueInput>
  }

  export type QuestionInstanceUncheckedCreateNestedManyWithoutQuestionInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutQuestionInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutQuestionInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutQuestionInput>
    createMany?: QuestionInstanceCreateManyQuestionInputEnvelope
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
  }

  export type EnumQuestionTypeFieldUpdateOperationsInput = {
    set?: QuestionType
  }

  export type AttachmentUpdateManyWithoutQuestionNestedInput = {
    create?: XOR<Enumerable<AttachmentCreateWithoutQuestionInput>, Enumerable<AttachmentUncheckedCreateWithoutQuestionInput>>
    connectOrCreate?: Enumerable<AttachmentCreateOrConnectWithoutQuestionInput>
    upsert?: Enumerable<AttachmentUpsertWithWhereUniqueWithoutQuestionInput>
    createMany?: AttachmentCreateManyQuestionInputEnvelope
    set?: Enumerable<AttachmentWhereUniqueInput>
    disconnect?: Enumerable<AttachmentWhereUniqueInput>
    delete?: Enumerable<AttachmentWhereUniqueInput>
    connect?: Enumerable<AttachmentWhereUniqueInput>
    update?: Enumerable<AttachmentUpdateWithWhereUniqueWithoutQuestionInput>
    updateMany?: Enumerable<AttachmentUpdateManyWithWhereWithoutQuestionInput>
    deleteMany?: Enumerable<AttachmentScalarWhereInput>
  }

  export type TagUpdateManyWithoutQuestionsNestedInput = {
    create?: XOR<Enumerable<TagCreateWithoutQuestionsInput>, Enumerable<TagUncheckedCreateWithoutQuestionsInput>>
    connectOrCreate?: Enumerable<TagCreateOrConnectWithoutQuestionsInput>
    upsert?: Enumerable<TagUpsertWithWhereUniqueWithoutQuestionsInput>
    set?: Enumerable<TagWhereUniqueInput>
    disconnect?: Enumerable<TagWhereUniqueInput>
    delete?: Enumerable<TagWhereUniqueInput>
    connect?: Enumerable<TagWhereUniqueInput>
    update?: Enumerable<TagUpdateWithWhereUniqueWithoutQuestionsInput>
    updateMany?: Enumerable<TagUpdateManyWithWhereWithoutQuestionsInput>
    deleteMany?: Enumerable<TagScalarWhereInput>
  }

  export type QuestionInstanceUpdateManyWithoutQuestionNestedInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutQuestionInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutQuestionInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutQuestionInput>
    upsert?: Enumerable<QuestionInstanceUpsertWithWhereUniqueWithoutQuestionInput>
    createMany?: QuestionInstanceCreateManyQuestionInputEnvelope
    set?: Enumerable<QuestionInstanceWhereUniqueInput>
    disconnect?: Enumerable<QuestionInstanceWhereUniqueInput>
    delete?: Enumerable<QuestionInstanceWhereUniqueInput>
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
    update?: Enumerable<QuestionInstanceUpdateWithWhereUniqueWithoutQuestionInput>
    updateMany?: Enumerable<QuestionInstanceUpdateManyWithWhereWithoutQuestionInput>
    deleteMany?: Enumerable<QuestionInstanceScalarWhereInput>
  }

  export type UserUpdateOneRequiredWithoutQuestionsNestedInput = {
    create?: XOR<UserCreateWithoutQuestionsInput, UserUncheckedCreateWithoutQuestionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutQuestionsInput
    upsert?: UserUpsertWithoutQuestionsInput
    connect?: UserWhereUniqueInput
    update?: XOR<UserUpdateWithoutQuestionsInput, UserUncheckedUpdateWithoutQuestionsInput>
  }

  export type AttachmentUncheckedUpdateManyWithoutQuestionNestedInput = {
    create?: XOR<Enumerable<AttachmentCreateWithoutQuestionInput>, Enumerable<AttachmentUncheckedCreateWithoutQuestionInput>>
    connectOrCreate?: Enumerable<AttachmentCreateOrConnectWithoutQuestionInput>
    upsert?: Enumerable<AttachmentUpsertWithWhereUniqueWithoutQuestionInput>
    createMany?: AttachmentCreateManyQuestionInputEnvelope
    set?: Enumerable<AttachmentWhereUniqueInput>
    disconnect?: Enumerable<AttachmentWhereUniqueInput>
    delete?: Enumerable<AttachmentWhereUniqueInput>
    connect?: Enumerable<AttachmentWhereUniqueInput>
    update?: Enumerable<AttachmentUpdateWithWhereUniqueWithoutQuestionInput>
    updateMany?: Enumerable<AttachmentUpdateManyWithWhereWithoutQuestionInput>
    deleteMany?: Enumerable<AttachmentScalarWhereInput>
  }

  export type TagUncheckedUpdateManyWithoutQuestionsNestedInput = {
    create?: XOR<Enumerable<TagCreateWithoutQuestionsInput>, Enumerable<TagUncheckedCreateWithoutQuestionsInput>>
    connectOrCreate?: Enumerable<TagCreateOrConnectWithoutQuestionsInput>
    upsert?: Enumerable<TagUpsertWithWhereUniqueWithoutQuestionsInput>
    set?: Enumerable<TagWhereUniqueInput>
    disconnect?: Enumerable<TagWhereUniqueInput>
    delete?: Enumerable<TagWhereUniqueInput>
    connect?: Enumerable<TagWhereUniqueInput>
    update?: Enumerable<TagUpdateWithWhereUniqueWithoutQuestionsInput>
    updateMany?: Enumerable<TagUpdateManyWithWhereWithoutQuestionsInput>
    deleteMany?: Enumerable<TagScalarWhereInput>
  }

  export type QuestionInstanceUncheckedUpdateManyWithoutQuestionNestedInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutQuestionInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutQuestionInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutQuestionInput>
    upsert?: Enumerable<QuestionInstanceUpsertWithWhereUniqueWithoutQuestionInput>
    createMany?: QuestionInstanceCreateManyQuestionInputEnvelope
    set?: Enumerable<QuestionInstanceWhereUniqueInput>
    disconnect?: Enumerable<QuestionInstanceWhereUniqueInput>
    delete?: Enumerable<QuestionInstanceWhereUniqueInput>
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
    update?: Enumerable<QuestionInstanceUpdateWithWhereUniqueWithoutQuestionInput>
    updateMany?: Enumerable<QuestionInstanceUpdateManyWithWhereWithoutQuestionInput>
    deleteMany?: Enumerable<QuestionInstanceScalarWhereInput>
  }

  export type QuestionCreateNestedManyWithoutTagsInput = {
    create?: XOR<Enumerable<QuestionCreateWithoutTagsInput>, Enumerable<QuestionUncheckedCreateWithoutTagsInput>>
    connectOrCreate?: Enumerable<QuestionCreateOrConnectWithoutTagsInput>
    connect?: Enumerable<QuestionWhereUniqueInput>
  }

  export type UserCreateNestedOneWithoutTagsInput = {
    create?: XOR<UserCreateWithoutTagsInput, UserUncheckedCreateWithoutTagsInput>
    connectOrCreate?: UserCreateOrConnectWithoutTagsInput
    connect?: UserWhereUniqueInput
  }

  export type QuestionUncheckedCreateNestedManyWithoutTagsInput = {
    create?: XOR<Enumerable<QuestionCreateWithoutTagsInput>, Enumerable<QuestionUncheckedCreateWithoutTagsInput>>
    connectOrCreate?: Enumerable<QuestionCreateOrConnectWithoutTagsInput>
    connect?: Enumerable<QuestionWhereUniqueInput>
  }

  export type QuestionUpdateManyWithoutTagsNestedInput = {
    create?: XOR<Enumerable<QuestionCreateWithoutTagsInput>, Enumerable<QuestionUncheckedCreateWithoutTagsInput>>
    connectOrCreate?: Enumerable<QuestionCreateOrConnectWithoutTagsInput>
    upsert?: Enumerable<QuestionUpsertWithWhereUniqueWithoutTagsInput>
    set?: Enumerable<QuestionWhereUniqueInput>
    disconnect?: Enumerable<QuestionWhereUniqueInput>
    delete?: Enumerable<QuestionWhereUniqueInput>
    connect?: Enumerable<QuestionWhereUniqueInput>
    update?: Enumerable<QuestionUpdateWithWhereUniqueWithoutTagsInput>
    updateMany?: Enumerable<QuestionUpdateManyWithWhereWithoutTagsInput>
    deleteMany?: Enumerable<QuestionScalarWhereInput>
  }

  export type UserUpdateOneRequiredWithoutTagsNestedInput = {
    create?: XOR<UserCreateWithoutTagsInput, UserUncheckedCreateWithoutTagsInput>
    connectOrCreate?: UserCreateOrConnectWithoutTagsInput
    upsert?: UserUpsertWithoutTagsInput
    connect?: UserWhereUniqueInput
    update?: XOR<UserUpdateWithoutTagsInput, UserUncheckedUpdateWithoutTagsInput>
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type QuestionUncheckedUpdateManyWithoutTagsNestedInput = {
    create?: XOR<Enumerable<QuestionCreateWithoutTagsInput>, Enumerable<QuestionUncheckedCreateWithoutTagsInput>>
    connectOrCreate?: Enumerable<QuestionCreateOrConnectWithoutTagsInput>
    upsert?: Enumerable<QuestionUpsertWithWhereUniqueWithoutTagsInput>
    set?: Enumerable<QuestionWhereUniqueInput>
    disconnect?: Enumerable<QuestionWhereUniqueInput>
    delete?: Enumerable<QuestionWhereUniqueInput>
    connect?: Enumerable<QuestionWhereUniqueInput>
    update?: Enumerable<QuestionUpdateWithWhereUniqueWithoutTagsInput>
    updateMany?: Enumerable<QuestionUpdateManyWithWhereWithoutTagsInput>
    deleteMany?: Enumerable<QuestionScalarWhereInput>
  }

  export type SessionBlockCreateNestedOneWithoutInstancesInput = {
    create?: XOR<SessionBlockCreateWithoutInstancesInput, SessionBlockUncheckedCreateWithoutInstancesInput>
    connectOrCreate?: SessionBlockCreateOrConnectWithoutInstancesInput
    connect?: SessionBlockWhereUniqueInput
  }

  export type LearningElementCreateNestedOneWithoutInstancesInput = {
    create?: XOR<LearningElementCreateWithoutInstancesInput, LearningElementUncheckedCreateWithoutInstancesInput>
    connectOrCreate?: LearningElementCreateOrConnectWithoutInstancesInput
    connect?: LearningElementWhereUniqueInput
  }

  export type MicroSessionCreateNestedOneWithoutInstancesInput = {
    create?: XOR<MicroSessionCreateWithoutInstancesInput, MicroSessionUncheckedCreateWithoutInstancesInput>
    connectOrCreate?: MicroSessionCreateOrConnectWithoutInstancesInput
    connect?: MicroSessionWhereUniqueInput
  }

  export type QuestionCreateNestedOneWithoutInstancesInput = {
    create?: XOR<QuestionCreateWithoutInstancesInput, QuestionUncheckedCreateWithoutInstancesInput>
    connectOrCreate?: QuestionCreateOrConnectWithoutInstancesInput
    connect?: QuestionWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutQuestionInstancesInput = {
    create?: XOR<UserCreateWithoutQuestionInstancesInput, UserUncheckedCreateWithoutQuestionInstancesInput>
    connectOrCreate?: UserCreateOrConnectWithoutQuestionInstancesInput
    connect?: UserWhereUniqueInput
  }

  export type SessionBlockUpdateOneWithoutInstancesNestedInput = {
    create?: XOR<SessionBlockCreateWithoutInstancesInput, SessionBlockUncheckedCreateWithoutInstancesInput>
    connectOrCreate?: SessionBlockCreateOrConnectWithoutInstancesInput
    upsert?: SessionBlockUpsertWithoutInstancesInput
    disconnect?: boolean
    delete?: boolean
    connect?: SessionBlockWhereUniqueInput
    update?: XOR<SessionBlockUpdateWithoutInstancesInput, SessionBlockUncheckedUpdateWithoutInstancesInput>
  }

  export type LearningElementUpdateOneWithoutInstancesNestedInput = {
    create?: XOR<LearningElementCreateWithoutInstancesInput, LearningElementUncheckedCreateWithoutInstancesInput>
    connectOrCreate?: LearningElementCreateOrConnectWithoutInstancesInput
    upsert?: LearningElementUpsertWithoutInstancesInput
    disconnect?: boolean
    delete?: boolean
    connect?: LearningElementWhereUniqueInput
    update?: XOR<LearningElementUpdateWithoutInstancesInput, LearningElementUncheckedUpdateWithoutInstancesInput>
  }

  export type MicroSessionUpdateOneWithoutInstancesNestedInput = {
    create?: XOR<MicroSessionCreateWithoutInstancesInput, MicroSessionUncheckedCreateWithoutInstancesInput>
    connectOrCreate?: MicroSessionCreateOrConnectWithoutInstancesInput
    upsert?: MicroSessionUpsertWithoutInstancesInput
    disconnect?: boolean
    delete?: boolean
    connect?: MicroSessionWhereUniqueInput
    update?: XOR<MicroSessionUpdateWithoutInstancesInput, MicroSessionUncheckedUpdateWithoutInstancesInput>
  }

  export type QuestionUpdateOneRequiredWithoutInstancesNestedInput = {
    create?: XOR<QuestionCreateWithoutInstancesInput, QuestionUncheckedCreateWithoutInstancesInput>
    connectOrCreate?: QuestionCreateOrConnectWithoutInstancesInput
    upsert?: QuestionUpsertWithoutInstancesInput
    connect?: QuestionWhereUniqueInput
    update?: XOR<QuestionUpdateWithoutInstancesInput, QuestionUncheckedUpdateWithoutInstancesInput>
  }

  export type UserUpdateOneRequiredWithoutQuestionInstancesNestedInput = {
    create?: XOR<UserCreateWithoutQuestionInstancesInput, UserUncheckedCreateWithoutQuestionInstancesInput>
    connectOrCreate?: UserCreateOrConnectWithoutQuestionInstancesInput
    upsert?: UserUpsertWithoutQuestionInstancesInput
    connect?: UserWhereUniqueInput
    update?: XOR<UserUpdateWithoutQuestionInstancesInput, UserUncheckedUpdateWithoutQuestionInstancesInput>
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type SessionCreateNestedManyWithoutCourseInput = {
    create?: XOR<Enumerable<SessionCreateWithoutCourseInput>, Enumerable<SessionUncheckedCreateWithoutCourseInput>>
    connectOrCreate?: Enumerable<SessionCreateOrConnectWithoutCourseInput>
    createMany?: SessionCreateManyCourseInputEnvelope
    connect?: Enumerable<SessionWhereUniqueInput>
  }

  export type LearningElementCreateNestedManyWithoutCourseInput = {
    create?: XOR<Enumerable<LearningElementCreateWithoutCourseInput>, Enumerable<LearningElementUncheckedCreateWithoutCourseInput>>
    connectOrCreate?: Enumerable<LearningElementCreateOrConnectWithoutCourseInput>
    createMany?: LearningElementCreateManyCourseInputEnvelope
    connect?: Enumerable<LearningElementWhereUniqueInput>
  }

  export type MicroSessionCreateNestedManyWithoutCourseInput = {
    create?: XOR<Enumerable<MicroSessionCreateWithoutCourseInput>, Enumerable<MicroSessionUncheckedCreateWithoutCourseInput>>
    connectOrCreate?: Enumerable<MicroSessionCreateOrConnectWithoutCourseInput>
    createMany?: MicroSessionCreateManyCourseInputEnvelope
    connect?: Enumerable<MicroSessionWhereUniqueInput>
  }

  export type UserCreateNestedOneWithoutCoursesInput = {
    create?: XOR<UserCreateWithoutCoursesInput, UserUncheckedCreateWithoutCoursesInput>
    connectOrCreate?: UserCreateOrConnectWithoutCoursesInput
    connect?: UserWhereUniqueInput
  }

  export type SessionUncheckedCreateNestedManyWithoutCourseInput = {
    create?: XOR<Enumerable<SessionCreateWithoutCourseInput>, Enumerable<SessionUncheckedCreateWithoutCourseInput>>
    connectOrCreate?: Enumerable<SessionCreateOrConnectWithoutCourseInput>
    createMany?: SessionCreateManyCourseInputEnvelope
    connect?: Enumerable<SessionWhereUniqueInput>
  }

  export type LearningElementUncheckedCreateNestedManyWithoutCourseInput = {
    create?: XOR<Enumerable<LearningElementCreateWithoutCourseInput>, Enumerable<LearningElementUncheckedCreateWithoutCourseInput>>
    connectOrCreate?: Enumerable<LearningElementCreateOrConnectWithoutCourseInput>
    createMany?: LearningElementCreateManyCourseInputEnvelope
    connect?: Enumerable<LearningElementWhereUniqueInput>
  }

  export type MicroSessionUncheckedCreateNestedManyWithoutCourseInput = {
    create?: XOR<Enumerable<MicroSessionCreateWithoutCourseInput>, Enumerable<MicroSessionUncheckedCreateWithoutCourseInput>>
    connectOrCreate?: Enumerable<MicroSessionCreateOrConnectWithoutCourseInput>
    createMany?: MicroSessionCreateManyCourseInputEnvelope
    connect?: Enumerable<MicroSessionWhereUniqueInput>
  }

  export type SessionUpdateManyWithoutCourseNestedInput = {
    create?: XOR<Enumerable<SessionCreateWithoutCourseInput>, Enumerable<SessionUncheckedCreateWithoutCourseInput>>
    connectOrCreate?: Enumerable<SessionCreateOrConnectWithoutCourseInput>
    upsert?: Enumerable<SessionUpsertWithWhereUniqueWithoutCourseInput>
    createMany?: SessionCreateManyCourseInputEnvelope
    set?: Enumerable<SessionWhereUniqueInput>
    disconnect?: Enumerable<SessionWhereUniqueInput>
    delete?: Enumerable<SessionWhereUniqueInput>
    connect?: Enumerable<SessionWhereUniqueInput>
    update?: Enumerable<SessionUpdateWithWhereUniqueWithoutCourseInput>
    updateMany?: Enumerable<SessionUpdateManyWithWhereWithoutCourseInput>
    deleteMany?: Enumerable<SessionScalarWhereInput>
  }

  export type LearningElementUpdateManyWithoutCourseNestedInput = {
    create?: XOR<Enumerable<LearningElementCreateWithoutCourseInput>, Enumerable<LearningElementUncheckedCreateWithoutCourseInput>>
    connectOrCreate?: Enumerable<LearningElementCreateOrConnectWithoutCourseInput>
    upsert?: Enumerable<LearningElementUpsertWithWhereUniqueWithoutCourseInput>
    createMany?: LearningElementCreateManyCourseInputEnvelope
    set?: Enumerable<LearningElementWhereUniqueInput>
    disconnect?: Enumerable<LearningElementWhereUniqueInput>
    delete?: Enumerable<LearningElementWhereUniqueInput>
    connect?: Enumerable<LearningElementWhereUniqueInput>
    update?: Enumerable<LearningElementUpdateWithWhereUniqueWithoutCourseInput>
    updateMany?: Enumerable<LearningElementUpdateManyWithWhereWithoutCourseInput>
    deleteMany?: Enumerable<LearningElementScalarWhereInput>
  }

  export type MicroSessionUpdateManyWithoutCourseNestedInput = {
    create?: XOR<Enumerable<MicroSessionCreateWithoutCourseInput>, Enumerable<MicroSessionUncheckedCreateWithoutCourseInput>>
    connectOrCreate?: Enumerable<MicroSessionCreateOrConnectWithoutCourseInput>
    upsert?: Enumerable<MicroSessionUpsertWithWhereUniqueWithoutCourseInput>
    createMany?: MicroSessionCreateManyCourseInputEnvelope
    set?: Enumerable<MicroSessionWhereUniqueInput>
    disconnect?: Enumerable<MicroSessionWhereUniqueInput>
    delete?: Enumerable<MicroSessionWhereUniqueInput>
    connect?: Enumerable<MicroSessionWhereUniqueInput>
    update?: Enumerable<MicroSessionUpdateWithWhereUniqueWithoutCourseInput>
    updateMany?: Enumerable<MicroSessionUpdateManyWithWhereWithoutCourseInput>
    deleteMany?: Enumerable<MicroSessionScalarWhereInput>
  }

  export type UserUpdateOneRequiredWithoutCoursesNestedInput = {
    create?: XOR<UserCreateWithoutCoursesInput, UserUncheckedCreateWithoutCoursesInput>
    connectOrCreate?: UserCreateOrConnectWithoutCoursesInput
    upsert?: UserUpsertWithoutCoursesInput
    connect?: UserWhereUniqueInput
    update?: XOR<UserUpdateWithoutCoursesInput, UserUncheckedUpdateWithoutCoursesInput>
  }

  export type SessionUncheckedUpdateManyWithoutCourseNestedInput = {
    create?: XOR<Enumerable<SessionCreateWithoutCourseInput>, Enumerable<SessionUncheckedCreateWithoutCourseInput>>
    connectOrCreate?: Enumerable<SessionCreateOrConnectWithoutCourseInput>
    upsert?: Enumerable<SessionUpsertWithWhereUniqueWithoutCourseInput>
    createMany?: SessionCreateManyCourseInputEnvelope
    set?: Enumerable<SessionWhereUniqueInput>
    disconnect?: Enumerable<SessionWhereUniqueInput>
    delete?: Enumerable<SessionWhereUniqueInput>
    connect?: Enumerable<SessionWhereUniqueInput>
    update?: Enumerable<SessionUpdateWithWhereUniqueWithoutCourseInput>
    updateMany?: Enumerable<SessionUpdateManyWithWhereWithoutCourseInput>
    deleteMany?: Enumerable<SessionScalarWhereInput>
  }

  export type LearningElementUncheckedUpdateManyWithoutCourseNestedInput = {
    create?: XOR<Enumerable<LearningElementCreateWithoutCourseInput>, Enumerable<LearningElementUncheckedCreateWithoutCourseInput>>
    connectOrCreate?: Enumerable<LearningElementCreateOrConnectWithoutCourseInput>
    upsert?: Enumerable<LearningElementUpsertWithWhereUniqueWithoutCourseInput>
    createMany?: LearningElementCreateManyCourseInputEnvelope
    set?: Enumerable<LearningElementWhereUniqueInput>
    disconnect?: Enumerable<LearningElementWhereUniqueInput>
    delete?: Enumerable<LearningElementWhereUniqueInput>
    connect?: Enumerable<LearningElementWhereUniqueInput>
    update?: Enumerable<LearningElementUpdateWithWhereUniqueWithoutCourseInput>
    updateMany?: Enumerable<LearningElementUpdateManyWithWhereWithoutCourseInput>
    deleteMany?: Enumerable<LearningElementScalarWhereInput>
  }

  export type MicroSessionUncheckedUpdateManyWithoutCourseNestedInput = {
    create?: XOR<Enumerable<MicroSessionCreateWithoutCourseInput>, Enumerable<MicroSessionUncheckedCreateWithoutCourseInput>>
    connectOrCreate?: Enumerable<MicroSessionCreateOrConnectWithoutCourseInput>
    upsert?: Enumerable<MicroSessionUpsertWithWhereUniqueWithoutCourseInput>
    createMany?: MicroSessionCreateManyCourseInputEnvelope
    set?: Enumerable<MicroSessionWhereUniqueInput>
    disconnect?: Enumerable<MicroSessionWhereUniqueInput>
    delete?: Enumerable<MicroSessionWhereUniqueInput>
    connect?: Enumerable<MicroSessionWhereUniqueInput>
    update?: Enumerable<MicroSessionUpdateWithWhereUniqueWithoutCourseInput>
    updateMany?: Enumerable<MicroSessionUpdateManyWithWhereWithoutCourseInput>
    deleteMany?: Enumerable<MicroSessionScalarWhereInput>
  }

  export type SessionBlockCreateNestedManyWithoutSessionInput = {
    create?: XOR<Enumerable<SessionBlockCreateWithoutSessionInput>, Enumerable<SessionBlockUncheckedCreateWithoutSessionInput>>
    connectOrCreate?: Enumerable<SessionBlockCreateOrConnectWithoutSessionInput>
    createMany?: SessionBlockCreateManySessionInputEnvelope
    connect?: Enumerable<SessionBlockWhereUniqueInput>
  }

  export type UserCreateNestedOneWithoutSessionsInput = {
    create?: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutSessionsInput
    connect?: UserWhereUniqueInput
  }

  export type CourseCreateNestedOneWithoutSessionsInput = {
    create?: XOR<CourseCreateWithoutSessionsInput, CourseUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: CourseCreateOrConnectWithoutSessionsInput
    connect?: CourseWhereUniqueInput
  }

  export type SessionBlockUncheckedCreateNestedManyWithoutSessionInput = {
    create?: XOR<Enumerable<SessionBlockCreateWithoutSessionInput>, Enumerable<SessionBlockUncheckedCreateWithoutSessionInput>>
    connectOrCreate?: Enumerable<SessionBlockCreateOrConnectWithoutSessionInput>
    createMany?: SessionBlockCreateManySessionInputEnvelope
    connect?: Enumerable<SessionBlockWhereUniqueInput>
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type EnumAccessModeFieldUpdateOperationsInput = {
    set?: AccessMode
  }

  export type EnumSessionStatusFieldUpdateOperationsInput = {
    set?: SessionStatus
  }

  export type SessionBlockUpdateManyWithoutSessionNestedInput = {
    create?: XOR<Enumerable<SessionBlockCreateWithoutSessionInput>, Enumerable<SessionBlockUncheckedCreateWithoutSessionInput>>
    connectOrCreate?: Enumerable<SessionBlockCreateOrConnectWithoutSessionInput>
    upsert?: Enumerable<SessionBlockUpsertWithWhereUniqueWithoutSessionInput>
    createMany?: SessionBlockCreateManySessionInputEnvelope
    set?: Enumerable<SessionBlockWhereUniqueInput>
    disconnect?: Enumerable<SessionBlockWhereUniqueInput>
    delete?: Enumerable<SessionBlockWhereUniqueInput>
    connect?: Enumerable<SessionBlockWhereUniqueInput>
    update?: Enumerable<SessionBlockUpdateWithWhereUniqueWithoutSessionInput>
    updateMany?: Enumerable<SessionBlockUpdateManyWithWhereWithoutSessionInput>
    deleteMany?: Enumerable<SessionBlockScalarWhereInput>
  }

  export type UserUpdateOneRequiredWithoutSessionsNestedInput = {
    create?: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutSessionsInput
    upsert?: UserUpsertWithoutSessionsInput
    connect?: UserWhereUniqueInput
    update?: XOR<UserUpdateWithoutSessionsInput, UserUncheckedUpdateWithoutSessionsInput>
  }

  export type CourseUpdateOneRequiredWithoutSessionsNestedInput = {
    create?: XOR<CourseCreateWithoutSessionsInput, CourseUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: CourseCreateOrConnectWithoutSessionsInput
    upsert?: CourseUpsertWithoutSessionsInput
    connect?: CourseWhereUniqueInput
    update?: XOR<CourseUpdateWithoutSessionsInput, CourseUncheckedUpdateWithoutSessionsInput>
  }

  export type SessionBlockUncheckedUpdateManyWithoutSessionNestedInput = {
    create?: XOR<Enumerable<SessionBlockCreateWithoutSessionInput>, Enumerable<SessionBlockUncheckedCreateWithoutSessionInput>>
    connectOrCreate?: Enumerable<SessionBlockCreateOrConnectWithoutSessionInput>
    upsert?: Enumerable<SessionBlockUpsertWithWhereUniqueWithoutSessionInput>
    createMany?: SessionBlockCreateManySessionInputEnvelope
    set?: Enumerable<SessionBlockWhereUniqueInput>
    disconnect?: Enumerable<SessionBlockWhereUniqueInput>
    delete?: Enumerable<SessionBlockWhereUniqueInput>
    connect?: Enumerable<SessionBlockWhereUniqueInput>
    update?: Enumerable<SessionBlockUpdateWithWhereUniqueWithoutSessionInput>
    updateMany?: Enumerable<SessionBlockUpdateManyWithWhereWithoutSessionInput>
    deleteMany?: Enumerable<SessionBlockScalarWhereInput>
  }

  export type QuestionInstanceCreateNestedManyWithoutSessionBlockInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutSessionBlockInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutSessionBlockInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutSessionBlockInput>
    createMany?: QuestionInstanceCreateManySessionBlockInputEnvelope
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
  }

  export type SessionCreateNestedOneWithoutBlocksInput = {
    create?: XOR<SessionCreateWithoutBlocksInput, SessionUncheckedCreateWithoutBlocksInput>
    connectOrCreate?: SessionCreateOrConnectWithoutBlocksInput
    connect?: SessionWhereUniqueInput
  }

  export type QuestionInstanceUncheckedCreateNestedManyWithoutSessionBlockInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutSessionBlockInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutSessionBlockInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutSessionBlockInput>
    createMany?: QuestionInstanceCreateManySessionBlockInputEnvelope
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
  }

  export type QuestionInstanceUpdateManyWithoutSessionBlockNestedInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutSessionBlockInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutSessionBlockInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutSessionBlockInput>
    upsert?: Enumerable<QuestionInstanceUpsertWithWhereUniqueWithoutSessionBlockInput>
    createMany?: QuestionInstanceCreateManySessionBlockInputEnvelope
    set?: Enumerable<QuestionInstanceWhereUniqueInput>
    disconnect?: Enumerable<QuestionInstanceWhereUniqueInput>
    delete?: Enumerable<QuestionInstanceWhereUniqueInput>
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
    update?: Enumerable<QuestionInstanceUpdateWithWhereUniqueWithoutSessionBlockInput>
    updateMany?: Enumerable<QuestionInstanceUpdateManyWithWhereWithoutSessionBlockInput>
    deleteMany?: Enumerable<QuestionInstanceScalarWhereInput>
  }

  export type SessionUpdateOneRequiredWithoutBlocksNestedInput = {
    create?: XOR<SessionCreateWithoutBlocksInput, SessionUncheckedCreateWithoutBlocksInput>
    connectOrCreate?: SessionCreateOrConnectWithoutBlocksInput
    upsert?: SessionUpsertWithoutBlocksInput
    connect?: SessionWhereUniqueInput
    update?: XOR<SessionUpdateWithoutBlocksInput, SessionUncheckedUpdateWithoutBlocksInput>
  }

  export type QuestionInstanceUncheckedUpdateManyWithoutSessionBlockNestedInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutSessionBlockInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutSessionBlockInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutSessionBlockInput>
    upsert?: Enumerable<QuestionInstanceUpsertWithWhereUniqueWithoutSessionBlockInput>
    createMany?: QuestionInstanceCreateManySessionBlockInputEnvelope
    set?: Enumerable<QuestionInstanceWhereUniqueInput>
    disconnect?: Enumerable<QuestionInstanceWhereUniqueInput>
    delete?: Enumerable<QuestionInstanceWhereUniqueInput>
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
    update?: Enumerable<QuestionInstanceUpdateWithWhereUniqueWithoutSessionBlockInput>
    updateMany?: Enumerable<QuestionInstanceUpdateManyWithWhereWithoutSessionBlockInput>
    deleteMany?: Enumerable<QuestionInstanceScalarWhereInput>
  }

  export type QuestionInstanceCreateNestedManyWithoutLearningElementInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutLearningElementInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutLearningElementInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutLearningElementInput>
    createMany?: QuestionInstanceCreateManyLearningElementInputEnvelope
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
  }

  export type UserCreateNestedOneWithoutLearningElementsInput = {
    create?: XOR<UserCreateWithoutLearningElementsInput, UserUncheckedCreateWithoutLearningElementsInput>
    connectOrCreate?: UserCreateOrConnectWithoutLearningElementsInput
    connect?: UserWhereUniqueInput
  }

  export type CourseCreateNestedOneWithoutLearningElementsInput = {
    create?: XOR<CourseCreateWithoutLearningElementsInput, CourseUncheckedCreateWithoutLearningElementsInput>
    connectOrCreate?: CourseCreateOrConnectWithoutLearningElementsInput
    connect?: CourseWhereUniqueInput
  }

  export type QuestionInstanceUncheckedCreateNestedManyWithoutLearningElementInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutLearningElementInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutLearningElementInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutLearningElementInput>
    createMany?: QuestionInstanceCreateManyLearningElementInputEnvelope
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
  }

  export type QuestionInstanceUpdateManyWithoutLearningElementNestedInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutLearningElementInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutLearningElementInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutLearningElementInput>
    upsert?: Enumerable<QuestionInstanceUpsertWithWhereUniqueWithoutLearningElementInput>
    createMany?: QuestionInstanceCreateManyLearningElementInputEnvelope
    set?: Enumerable<QuestionInstanceWhereUniqueInput>
    disconnect?: Enumerable<QuestionInstanceWhereUniqueInput>
    delete?: Enumerable<QuestionInstanceWhereUniqueInput>
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
    update?: Enumerable<QuestionInstanceUpdateWithWhereUniqueWithoutLearningElementInput>
    updateMany?: Enumerable<QuestionInstanceUpdateManyWithWhereWithoutLearningElementInput>
    deleteMany?: Enumerable<QuestionInstanceScalarWhereInput>
  }

  export type UserUpdateOneRequiredWithoutLearningElementsNestedInput = {
    create?: XOR<UserCreateWithoutLearningElementsInput, UserUncheckedCreateWithoutLearningElementsInput>
    connectOrCreate?: UserCreateOrConnectWithoutLearningElementsInput
    upsert?: UserUpsertWithoutLearningElementsInput
    connect?: UserWhereUniqueInput
    update?: XOR<UserUpdateWithoutLearningElementsInput, UserUncheckedUpdateWithoutLearningElementsInput>
  }

  export type CourseUpdateOneRequiredWithoutLearningElementsNestedInput = {
    create?: XOR<CourseCreateWithoutLearningElementsInput, CourseUncheckedCreateWithoutLearningElementsInput>
    connectOrCreate?: CourseCreateOrConnectWithoutLearningElementsInput
    upsert?: CourseUpsertWithoutLearningElementsInput
    connect?: CourseWhereUniqueInput
    update?: XOR<CourseUpdateWithoutLearningElementsInput, CourseUncheckedUpdateWithoutLearningElementsInput>
  }

  export type QuestionInstanceUncheckedUpdateManyWithoutLearningElementNestedInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutLearningElementInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutLearningElementInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutLearningElementInput>
    upsert?: Enumerable<QuestionInstanceUpsertWithWhereUniqueWithoutLearningElementInput>
    createMany?: QuestionInstanceCreateManyLearningElementInputEnvelope
    set?: Enumerable<QuestionInstanceWhereUniqueInput>
    disconnect?: Enumerable<QuestionInstanceWhereUniqueInput>
    delete?: Enumerable<QuestionInstanceWhereUniqueInput>
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
    update?: Enumerable<QuestionInstanceUpdateWithWhereUniqueWithoutLearningElementInput>
    updateMany?: Enumerable<QuestionInstanceUpdateManyWithWhereWithoutLearningElementInput>
    deleteMany?: Enumerable<QuestionInstanceScalarWhereInput>
  }

  export type QuestionInstanceCreateNestedManyWithoutMicroSessionInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutMicroSessionInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutMicroSessionInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutMicroSessionInput>
    createMany?: QuestionInstanceCreateManyMicroSessionInputEnvelope
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
  }

  export type UserCreateNestedOneWithoutMicroSessionsInput = {
    create?: XOR<UserCreateWithoutMicroSessionsInput, UserUncheckedCreateWithoutMicroSessionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutMicroSessionsInput
    connect?: UserWhereUniqueInput
  }

  export type CourseCreateNestedOneWithoutMicroSessionsInput = {
    create?: XOR<CourseCreateWithoutMicroSessionsInput, CourseUncheckedCreateWithoutMicroSessionsInput>
    connectOrCreate?: CourseCreateOrConnectWithoutMicroSessionsInput
    connect?: CourseWhereUniqueInput
  }

  export type QuestionInstanceUncheckedCreateNestedManyWithoutMicroSessionInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutMicroSessionInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutMicroSessionInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutMicroSessionInput>
    createMany?: QuestionInstanceCreateManyMicroSessionInputEnvelope
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
  }

  export type QuestionInstanceUpdateManyWithoutMicroSessionNestedInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutMicroSessionInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutMicroSessionInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutMicroSessionInput>
    upsert?: Enumerable<QuestionInstanceUpsertWithWhereUniqueWithoutMicroSessionInput>
    createMany?: QuestionInstanceCreateManyMicroSessionInputEnvelope
    set?: Enumerable<QuestionInstanceWhereUniqueInput>
    disconnect?: Enumerable<QuestionInstanceWhereUniqueInput>
    delete?: Enumerable<QuestionInstanceWhereUniqueInput>
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
    update?: Enumerable<QuestionInstanceUpdateWithWhereUniqueWithoutMicroSessionInput>
    updateMany?: Enumerable<QuestionInstanceUpdateManyWithWhereWithoutMicroSessionInput>
    deleteMany?: Enumerable<QuestionInstanceScalarWhereInput>
  }

  export type UserUpdateOneRequiredWithoutMicroSessionsNestedInput = {
    create?: XOR<UserCreateWithoutMicroSessionsInput, UserUncheckedCreateWithoutMicroSessionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutMicroSessionsInput
    upsert?: UserUpsertWithoutMicroSessionsInput
    connect?: UserWhereUniqueInput
    update?: XOR<UserUpdateWithoutMicroSessionsInput, UserUncheckedUpdateWithoutMicroSessionsInput>
  }

  export type CourseUpdateOneRequiredWithoutMicroSessionsNestedInput = {
    create?: XOR<CourseCreateWithoutMicroSessionsInput, CourseUncheckedCreateWithoutMicroSessionsInput>
    connectOrCreate?: CourseCreateOrConnectWithoutMicroSessionsInput
    upsert?: CourseUpsertWithoutMicroSessionsInput
    connect?: CourseWhereUniqueInput
    update?: XOR<CourseUpdateWithoutMicroSessionsInput, CourseUncheckedUpdateWithoutMicroSessionsInput>
  }

  export type QuestionInstanceUncheckedUpdateManyWithoutMicroSessionNestedInput = {
    create?: XOR<Enumerable<QuestionInstanceCreateWithoutMicroSessionInput>, Enumerable<QuestionInstanceUncheckedCreateWithoutMicroSessionInput>>
    connectOrCreate?: Enumerable<QuestionInstanceCreateOrConnectWithoutMicroSessionInput>
    upsert?: Enumerable<QuestionInstanceUpsertWithWhereUniqueWithoutMicroSessionInput>
    createMany?: QuestionInstanceCreateManyMicroSessionInputEnvelope
    set?: Enumerable<QuestionInstanceWhereUniqueInput>
    disconnect?: Enumerable<QuestionInstanceWhereUniqueInput>
    delete?: Enumerable<QuestionInstanceWhereUniqueInput>
    connect?: Enumerable<QuestionInstanceWhereUniqueInput>
    update?: Enumerable<QuestionInstanceUpdateWithWhereUniqueWithoutMicroSessionInput>
    updateMany?: Enumerable<QuestionInstanceUpdateManyWithWhereWithoutMicroSessionInput>
    deleteMany?: Enumerable<QuestionInstanceScalarWhereInput>
  }

  export type NestedStringFilter = {
    equals?: string
    in?: Enumerable<string>
    notIn?: Enumerable<string>
    lt?: string
    lte?: string
    gt?: string
    gte?: string
    contains?: string
    startsWith?: string
    endsWith?: string
    not?: NestedStringFilter | string
  }

  export type NestedStringWithAggregatesFilter = {
    equals?: string
    in?: Enumerable<string>
    notIn?: Enumerable<string>
    lt?: string
    lte?: string
    gt?: string
    gte?: string
    contains?: string
    startsWith?: string
    endsWith?: string
    not?: NestedStringWithAggregatesFilter | string
    _count?: NestedIntFilter
    _min?: NestedStringFilter
    _max?: NestedStringFilter
  }

  export type NestedIntFilter = {
    equals?: number
    in?: Enumerable<number>
    notIn?: Enumerable<number>
    lt?: number
    lte?: number
    gt?: number
    gte?: number
    not?: NestedIntFilter | number
  }

  export type NestedBoolFilter = {
    equals?: boolean
    not?: NestedBoolFilter | boolean
  }

  export type NestedStringNullableFilter = {
    equals?: string | null
    in?: Enumerable<string> | null
    notIn?: Enumerable<string> | null
    lt?: string
    lte?: string
    gt?: string
    gte?: string
    contains?: string
    startsWith?: string
    endsWith?: string
    not?: NestedStringNullableFilter | string | null
  }

  export type NestedDateTimeNullableFilter = {
    equals?: Date | string | null
    in?: Enumerable<Date> | Enumerable<string> | null
    notIn?: Enumerable<Date> | Enumerable<string> | null
    lt?: Date | string
    lte?: Date | string
    gt?: Date | string
    gte?: Date | string
    not?: NestedDateTimeNullableFilter | Date | string | null
  }

  export type NestedEnumUserRoleFilter = {
    equals?: UserRole
    in?: Enumerable<UserRole>
    notIn?: Enumerable<UserRole>
    not?: NestedEnumUserRoleFilter | UserRole
  }

  export type NestedBoolWithAggregatesFilter = {
    equals?: boolean
    not?: NestedBoolWithAggregatesFilter | boolean
    _count?: NestedIntFilter
    _min?: NestedBoolFilter
    _max?: NestedBoolFilter
  }

  export type NestedStringNullableWithAggregatesFilter = {
    equals?: string | null
    in?: Enumerable<string> | null
    notIn?: Enumerable<string> | null
    lt?: string
    lte?: string
    gt?: string
    gte?: string
    contains?: string
    startsWith?: string
    endsWith?: string
    not?: NestedStringNullableWithAggregatesFilter | string | null
    _count?: NestedIntNullableFilter
    _min?: NestedStringNullableFilter
    _max?: NestedStringNullableFilter
  }

  export type NestedIntNullableFilter = {
    equals?: number | null
    in?: Enumerable<number> | null
    notIn?: Enumerable<number> | null
    lt?: number
    lte?: number
    gt?: number
    gte?: number
    not?: NestedIntNullableFilter | number | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter = {
    equals?: Date | string | null
    in?: Enumerable<Date> | Enumerable<string> | null
    notIn?: Enumerable<Date> | Enumerable<string> | null
    lt?: Date | string
    lte?: Date | string
    gt?: Date | string
    gte?: Date | string
    not?: NestedDateTimeNullableWithAggregatesFilter | Date | string | null
    _count?: NestedIntNullableFilter
    _min?: NestedDateTimeNullableFilter
    _max?: NestedDateTimeNullableFilter
  }

  export type NestedEnumUserRoleWithAggregatesFilter = {
    equals?: UserRole
    in?: Enumerable<UserRole>
    notIn?: Enumerable<UserRole>
    not?: NestedEnumUserRoleWithAggregatesFilter | UserRole
    _count?: NestedIntFilter
    _min?: NestedEnumUserRoleFilter
    _max?: NestedEnumUserRoleFilter
  }

  export type NestedEnumAttachmentTypeFilter = {
    equals?: AttachmentType
    in?: Enumerable<AttachmentType>
    notIn?: Enumerable<AttachmentType>
    not?: NestedEnumAttachmentTypeFilter | AttachmentType
  }

  export type NestedEnumAttachmentTypeWithAggregatesFilter = {
    equals?: AttachmentType
    in?: Enumerable<AttachmentType>
    notIn?: Enumerable<AttachmentType>
    not?: NestedEnumAttachmentTypeWithAggregatesFilter | AttachmentType
    _count?: NestedIntFilter
    _min?: NestedEnumAttachmentTypeFilter
    _max?: NestedEnumAttachmentTypeFilter
  }

  export type NestedEnumQuestionTypeFilter = {
    equals?: QuestionType
    in?: Enumerable<QuestionType>
    notIn?: Enumerable<QuestionType>
    not?: NestedEnumQuestionTypeFilter | QuestionType
  }
  export type NestedJsonFilter = 
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase>, Exclude<keyof Required<NestedJsonFilterBase>, 'path'>>,
        Required<NestedJsonFilterBase>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase>, 'path'>>

  export type NestedJsonFilterBase = {
    equals?: JsonNullValueFilter | InputJsonValue
    path?: Array<string>
    string_contains?: string
    string_starts_with?: string
    string_ends_with?: string
    array_contains?: InputJsonValue | null
    array_starts_with?: InputJsonValue | null
    array_ends_with?: InputJsonValue | null
    lt?: InputJsonValue
    lte?: InputJsonValue
    gt?: InputJsonValue
    gte?: InputJsonValue
    not?: JsonNullValueFilter | InputJsonValue
  }

  export type NestedEnumQuestionTypeWithAggregatesFilter = {
    equals?: QuestionType
    in?: Enumerable<QuestionType>
    notIn?: Enumerable<QuestionType>
    not?: NestedEnumQuestionTypeWithAggregatesFilter | QuestionType
    _count?: NestedIntFilter
    _min?: NestedEnumQuestionTypeFilter
    _max?: NestedEnumQuestionTypeFilter
  }

  export type NestedIntWithAggregatesFilter = {
    equals?: number
    in?: Enumerable<number>
    notIn?: Enumerable<number>
    lt?: number
    lte?: number
    gt?: number
    gte?: number
    not?: NestedIntWithAggregatesFilter | number
    _count?: NestedIntFilter
    _avg?: NestedFloatFilter
    _sum?: NestedIntFilter
    _min?: NestedIntFilter
    _max?: NestedIntFilter
  }

  export type NestedFloatFilter = {
    equals?: number
    in?: Enumerable<number>
    notIn?: Enumerable<number>
    lt?: number
    lte?: number
    gt?: number
    gte?: number
    not?: NestedFloatFilter | number
  }

  export type NestedIntNullableWithAggregatesFilter = {
    equals?: number | null
    in?: Enumerable<number> | null
    notIn?: Enumerable<number> | null
    lt?: number
    lte?: number
    gt?: number
    gte?: number
    not?: NestedIntNullableWithAggregatesFilter | number | null
    _count?: NestedIntNullableFilter
    _avg?: NestedFloatNullableFilter
    _sum?: NestedIntNullableFilter
    _min?: NestedIntNullableFilter
    _max?: NestedIntNullableFilter
  }

  export type NestedFloatNullableFilter = {
    equals?: number | null
    in?: Enumerable<number> | null
    notIn?: Enumerable<number> | null
    lt?: number
    lte?: number
    gt?: number
    gte?: number
    not?: NestedFloatNullableFilter | number | null
  }

  export type NestedDateTimeFilter = {
    equals?: Date | string
    in?: Enumerable<Date> | Enumerable<string>
    notIn?: Enumerable<Date> | Enumerable<string>
    lt?: Date | string
    lte?: Date | string
    gt?: Date | string
    gte?: Date | string
    not?: NestedDateTimeFilter | Date | string
  }

  export type NestedEnumAccessModeFilter = {
    equals?: AccessMode
    in?: Enumerable<AccessMode>
    notIn?: Enumerable<AccessMode>
    not?: NestedEnumAccessModeFilter | AccessMode
  }

  export type NestedEnumSessionStatusFilter = {
    equals?: SessionStatus
    in?: Enumerable<SessionStatus>
    notIn?: Enumerable<SessionStatus>
    not?: NestedEnumSessionStatusFilter | SessionStatus
  }

  export type NestedDateTimeWithAggregatesFilter = {
    equals?: Date | string
    in?: Enumerable<Date> | Enumerable<string>
    notIn?: Enumerable<Date> | Enumerable<string>
    lt?: Date | string
    lte?: Date | string
    gt?: Date | string
    gte?: Date | string
    not?: NestedDateTimeWithAggregatesFilter | Date | string
    _count?: NestedIntFilter
    _min?: NestedDateTimeFilter
    _max?: NestedDateTimeFilter
  }

  export type NestedEnumAccessModeWithAggregatesFilter = {
    equals?: AccessMode
    in?: Enumerable<AccessMode>
    notIn?: Enumerable<AccessMode>
    not?: NestedEnumAccessModeWithAggregatesFilter | AccessMode
    _count?: NestedIntFilter
    _min?: NestedEnumAccessModeFilter
    _max?: NestedEnumAccessModeFilter
  }

  export type NestedEnumSessionStatusWithAggregatesFilter = {
    equals?: SessionStatus
    in?: Enumerable<SessionStatus>
    notIn?: Enumerable<SessionStatus>
    not?: NestedEnumSessionStatusWithAggregatesFilter | SessionStatus
    _count?: NestedIntFilter
    _min?: NestedEnumSessionStatusFilter
    _max?: NestedEnumSessionStatusFilter
  }

  export type UserCreateWithoutAccountsInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    courses?: CourseCreateNestedManyWithoutOwnerInput
    questions?: QuestionCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentCreateNestedManyWithoutOwnerInput
    tags?: TagCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceCreateNestedManyWithoutOwnerInput
    sessions?: SessionCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionCreateNestedManyWithoutOwnerInput
  }

  export type UserUncheckedCreateWithoutAccountsInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    courses?: CourseUncheckedCreateNestedManyWithoutOwnerInput
    questions?: QuestionUncheckedCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentUncheckedCreateNestedManyWithoutOwnerInput
    tags?: TagUncheckedCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceUncheckedCreateNestedManyWithoutOwnerInput
    sessions?: SessionUncheckedCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementUncheckedCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionUncheckedCreateNestedManyWithoutOwnerInput
  }

  export type UserCreateOrConnectWithoutAccountsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutAccountsInput, UserUncheckedCreateWithoutAccountsInput>
  }

  export type UserUpsertWithoutAccountsInput = {
    update: XOR<UserUpdateWithoutAccountsInput, UserUncheckedUpdateWithoutAccountsInput>
    create: XOR<UserCreateWithoutAccountsInput, UserUncheckedCreateWithoutAccountsInput>
  }

  export type UserUpdateWithoutAccountsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    courses?: CourseUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUpdateManyWithoutOwnerNestedInput
    tags?: TagUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUpdateManyWithoutOwnerNestedInput
  }

  export type UserUncheckedUpdateWithoutAccountsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    courses?: CourseUncheckedUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUncheckedUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUncheckedUpdateManyWithoutOwnerNestedInput
    tags?: TagUncheckedUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUncheckedUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUncheckedUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUncheckedUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUncheckedUpdateManyWithoutOwnerNestedInput
  }

  export type AccountCreateWithoutUserInput = {
    id?: string
    ssoType: string
    ssoId: string
  }

  export type AccountUncheckedCreateWithoutUserInput = {
    id?: string
    ssoType: string
    ssoId: string
  }

  export type AccountCreateOrConnectWithoutUserInput = {
    where: AccountWhereUniqueInput
    create: XOR<AccountCreateWithoutUserInput, AccountUncheckedCreateWithoutUserInput>
  }

  export type AccountCreateManyUserInputEnvelope = {
    data: Enumerable<AccountCreateManyUserInput>
    skipDuplicates?: boolean
  }

  export type CourseCreateWithoutOwnerInput = {
    id?: string
    isArchived?: boolean
    name: string
    displayName: string
    description?: string | null
    sessions?: SessionCreateNestedManyWithoutCourseInput
    learningElements?: LearningElementCreateNestedManyWithoutCourseInput
    microSessions?: MicroSessionCreateNestedManyWithoutCourseInput
  }

  export type CourseUncheckedCreateWithoutOwnerInput = {
    id?: string
    isArchived?: boolean
    name: string
    displayName: string
    description?: string | null
    sessions?: SessionUncheckedCreateNestedManyWithoutCourseInput
    learningElements?: LearningElementUncheckedCreateNestedManyWithoutCourseInput
    microSessions?: MicroSessionUncheckedCreateNestedManyWithoutCourseInput
  }

  export type CourseCreateOrConnectWithoutOwnerInput = {
    where: CourseWhereUniqueInput
    create: XOR<CourseCreateWithoutOwnerInput, CourseUncheckedCreateWithoutOwnerInput>
  }

  export type CourseCreateManyOwnerInputEnvelope = {
    data: Enumerable<CourseCreateManyOwnerInput>
    skipDuplicates?: boolean
  }

  export type QuestionCreateWithoutOwnerInput = {
    id?: string
    isArchived?: boolean
    isDeleted?: boolean
    name: string
    content: string
    contentPlain: string
    options: JsonNullValueInput | InputJsonValue
    type: QuestionType
    attachments?: AttachmentCreateNestedManyWithoutQuestionInput
    tags?: TagCreateNestedManyWithoutQuestionsInput
    instances?: QuestionInstanceCreateNestedManyWithoutQuestionInput
  }

  export type QuestionUncheckedCreateWithoutOwnerInput = {
    id?: string
    isArchived?: boolean
    isDeleted?: boolean
    name: string
    content: string
    contentPlain: string
    options: JsonNullValueInput | InputJsonValue
    type: QuestionType
    attachments?: AttachmentUncheckedCreateNestedManyWithoutQuestionInput
    tags?: TagUncheckedCreateNestedManyWithoutQuestionsInput
    instances?: QuestionInstanceUncheckedCreateNestedManyWithoutQuestionInput
  }

  export type QuestionCreateOrConnectWithoutOwnerInput = {
    where: QuestionWhereUniqueInput
    create: XOR<QuestionCreateWithoutOwnerInput, QuestionUncheckedCreateWithoutOwnerInput>
  }

  export type QuestionCreateManyOwnerInputEnvelope = {
    data: Enumerable<QuestionCreateManyOwnerInput>
    skipDuplicates?: boolean
  }

  export type AttachmentCreateWithoutOwnerInput = {
    id?: string
    name: string
    originalName: string
    description?: string | null
    type: AttachmentType
    question?: QuestionCreateNestedOneWithoutAttachmentsInput
  }

  export type AttachmentUncheckedCreateWithoutOwnerInput = {
    id?: string
    name: string
    originalName: string
    description?: string | null
    type: AttachmentType
    questionId?: string | null
  }

  export type AttachmentCreateOrConnectWithoutOwnerInput = {
    where: AttachmentWhereUniqueInput
    create: XOR<AttachmentCreateWithoutOwnerInput, AttachmentUncheckedCreateWithoutOwnerInput>
  }

  export type AttachmentCreateManyOwnerInputEnvelope = {
    data: Enumerable<AttachmentCreateManyOwnerInput>
    skipDuplicates?: boolean
  }

  export type TagCreateWithoutOwnerInput = {
    questions?: QuestionCreateNestedManyWithoutTagsInput
  }

  export type TagUncheckedCreateWithoutOwnerInput = {
    id?: number
    questions?: QuestionUncheckedCreateNestedManyWithoutTagsInput
  }

  export type TagCreateOrConnectWithoutOwnerInput = {
    where: TagWhereUniqueInput
    create: XOR<TagCreateWithoutOwnerInput, TagUncheckedCreateWithoutOwnerInput>
  }

  export type TagCreateManyOwnerInputEnvelope = {
    data: Enumerable<TagCreateManyOwnerInput>
    skipDuplicates?: boolean
  }

  export type QuestionInstanceCreateWithoutOwnerInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlock?: SessionBlockCreateNestedOneWithoutInstancesInput
    learningElement?: LearningElementCreateNestedOneWithoutInstancesInput
    microSession?: MicroSessionCreateNestedOneWithoutInstancesInput
    question: QuestionCreateNestedOneWithoutInstancesInput
  }

  export type QuestionInstanceUncheckedCreateWithoutOwnerInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlockId?: number | null
    learningElementId?: string | null
    microSessionId?: string | null
    questionId: string
  }

  export type QuestionInstanceCreateOrConnectWithoutOwnerInput = {
    where: QuestionInstanceWhereUniqueInput
    create: XOR<QuestionInstanceCreateWithoutOwnerInput, QuestionInstanceUncheckedCreateWithoutOwnerInput>
  }

  export type QuestionInstanceCreateManyOwnerInputEnvelope = {
    data: Enumerable<QuestionInstanceCreateManyOwnerInput>
    skipDuplicates?: boolean
  }

  export type SessionCreateWithoutOwnerInput = {
    id?: string
    namespace?: string
    execution?: number
    name: string
    displayName: string
    settings: JsonNullValueInput | InputJsonValue
    startedAt: Date | string
    finishedAt: Date | string
    accessMode?: AccessMode
    status: SessionStatus
    blocks?: SessionBlockCreateNestedManyWithoutSessionInput
    course: CourseCreateNestedOneWithoutSessionsInput
  }

  export type SessionUncheckedCreateWithoutOwnerInput = {
    id?: string
    namespace?: string
    execution?: number
    name: string
    displayName: string
    settings: JsonNullValueInput | InputJsonValue
    startedAt: Date | string
    finishedAt: Date | string
    accessMode?: AccessMode
    status: SessionStatus
    blocks?: SessionBlockUncheckedCreateNestedManyWithoutSessionInput
    courseId: string
  }

  export type SessionCreateOrConnectWithoutOwnerInput = {
    where: SessionWhereUniqueInput
    create: XOR<SessionCreateWithoutOwnerInput, SessionUncheckedCreateWithoutOwnerInput>
  }

  export type SessionCreateManyOwnerInputEnvelope = {
    data: Enumerable<SessionCreateManyOwnerInput>
    skipDuplicates?: boolean
  }

  export type LearningElementCreateWithoutOwnerInput = {
    id?: string
    instances?: QuestionInstanceCreateNestedManyWithoutLearningElementInput
    course: CourseCreateNestedOneWithoutLearningElementsInput
  }

  export type LearningElementUncheckedCreateWithoutOwnerInput = {
    id?: string
    instances?: QuestionInstanceUncheckedCreateNestedManyWithoutLearningElementInput
    courseId: string
  }

  export type LearningElementCreateOrConnectWithoutOwnerInput = {
    where: LearningElementWhereUniqueInput
    create: XOR<LearningElementCreateWithoutOwnerInput, LearningElementUncheckedCreateWithoutOwnerInput>
  }

  export type LearningElementCreateManyOwnerInputEnvelope = {
    data: Enumerable<LearningElementCreateManyOwnerInput>
    skipDuplicates?: boolean
  }

  export type MicroSessionCreateWithoutOwnerInput = {
    id?: string
    scheduledStartAt: Date | string
    scheduledEndAt: Date | string
    instances?: QuestionInstanceCreateNestedManyWithoutMicroSessionInput
    course: CourseCreateNestedOneWithoutMicroSessionsInput
  }

  export type MicroSessionUncheckedCreateWithoutOwnerInput = {
    id?: string
    scheduledStartAt: Date | string
    scheduledEndAt: Date | string
    instances?: QuestionInstanceUncheckedCreateNestedManyWithoutMicroSessionInput
    courseId: string
  }

  export type MicroSessionCreateOrConnectWithoutOwnerInput = {
    where: MicroSessionWhereUniqueInput
    create: XOR<MicroSessionCreateWithoutOwnerInput, MicroSessionUncheckedCreateWithoutOwnerInput>
  }

  export type MicroSessionCreateManyOwnerInputEnvelope = {
    data: Enumerable<MicroSessionCreateManyOwnerInput>
    skipDuplicates?: boolean
  }

  export type AccountUpsertWithWhereUniqueWithoutUserInput = {
    where: AccountWhereUniqueInput
    update: XOR<AccountUpdateWithoutUserInput, AccountUncheckedUpdateWithoutUserInput>
    create: XOR<AccountCreateWithoutUserInput, AccountUncheckedCreateWithoutUserInput>
  }

  export type AccountUpdateWithWhereUniqueWithoutUserInput = {
    where: AccountWhereUniqueInput
    data: XOR<AccountUpdateWithoutUserInput, AccountUncheckedUpdateWithoutUserInput>
  }

  export type AccountUpdateManyWithWhereWithoutUserInput = {
    where: AccountScalarWhereInput
    data: XOR<AccountUpdateManyMutationInput, AccountUncheckedUpdateManyWithoutAccountsInput>
  }

  export type AccountScalarWhereInput = {
    AND?: Enumerable<AccountScalarWhereInput>
    OR?: Enumerable<AccountScalarWhereInput>
    NOT?: Enumerable<AccountScalarWhereInput>
    id?: StringFilter | string
    ssoType?: StringFilter | string
    ssoId?: StringFilter | string
    userId?: StringFilter | string
  }

  export type CourseUpsertWithWhereUniqueWithoutOwnerInput = {
    where: CourseWhereUniqueInput
    update: XOR<CourseUpdateWithoutOwnerInput, CourseUncheckedUpdateWithoutOwnerInput>
    create: XOR<CourseCreateWithoutOwnerInput, CourseUncheckedCreateWithoutOwnerInput>
  }

  export type CourseUpdateWithWhereUniqueWithoutOwnerInput = {
    where: CourseWhereUniqueInput
    data: XOR<CourseUpdateWithoutOwnerInput, CourseUncheckedUpdateWithoutOwnerInput>
  }

  export type CourseUpdateManyWithWhereWithoutOwnerInput = {
    where: CourseScalarWhereInput
    data: XOR<CourseUpdateManyMutationInput, CourseUncheckedUpdateManyWithoutCoursesInput>
  }

  export type CourseScalarWhereInput = {
    AND?: Enumerable<CourseScalarWhereInput>
    OR?: Enumerable<CourseScalarWhereInput>
    NOT?: Enumerable<CourseScalarWhereInput>
    id?: StringFilter | string
    isArchived?: BoolFilter | boolean
    name?: StringFilter | string
    displayName?: StringFilter | string
    description?: StringNullableFilter | string | null
    ownerId?: StringFilter | string
  }

  export type QuestionUpsertWithWhereUniqueWithoutOwnerInput = {
    where: QuestionWhereUniqueInput
    update: XOR<QuestionUpdateWithoutOwnerInput, QuestionUncheckedUpdateWithoutOwnerInput>
    create: XOR<QuestionCreateWithoutOwnerInput, QuestionUncheckedCreateWithoutOwnerInput>
  }

  export type QuestionUpdateWithWhereUniqueWithoutOwnerInput = {
    where: QuestionWhereUniqueInput
    data: XOR<QuestionUpdateWithoutOwnerInput, QuestionUncheckedUpdateWithoutOwnerInput>
  }

  export type QuestionUpdateManyWithWhereWithoutOwnerInput = {
    where: QuestionScalarWhereInput
    data: XOR<QuestionUpdateManyMutationInput, QuestionUncheckedUpdateManyWithoutQuestionsInput>
  }

  export type QuestionScalarWhereInput = {
    AND?: Enumerable<QuestionScalarWhereInput>
    OR?: Enumerable<QuestionScalarWhereInput>
    NOT?: Enumerable<QuestionScalarWhereInput>
    id?: StringFilter | string
    isArchived?: BoolFilter | boolean
    isDeleted?: BoolFilter | boolean
    name?: StringFilter | string
    content?: StringFilter | string
    contentPlain?: StringFilter | string
    options?: JsonFilter
    type?: EnumQuestionTypeFilter | QuestionType
    ownerId?: StringFilter | string
  }

  export type AttachmentUpsertWithWhereUniqueWithoutOwnerInput = {
    where: AttachmentWhereUniqueInput
    update: XOR<AttachmentUpdateWithoutOwnerInput, AttachmentUncheckedUpdateWithoutOwnerInput>
    create: XOR<AttachmentCreateWithoutOwnerInput, AttachmentUncheckedCreateWithoutOwnerInput>
  }

  export type AttachmentUpdateWithWhereUniqueWithoutOwnerInput = {
    where: AttachmentWhereUniqueInput
    data: XOR<AttachmentUpdateWithoutOwnerInput, AttachmentUncheckedUpdateWithoutOwnerInput>
  }

  export type AttachmentUpdateManyWithWhereWithoutOwnerInput = {
    where: AttachmentScalarWhereInput
    data: XOR<AttachmentUpdateManyMutationInput, AttachmentUncheckedUpdateManyWithoutAttachmentsInput>
  }

  export type AttachmentScalarWhereInput = {
    AND?: Enumerable<AttachmentScalarWhereInput>
    OR?: Enumerable<AttachmentScalarWhereInput>
    NOT?: Enumerable<AttachmentScalarWhereInput>
    id?: StringFilter | string
    name?: StringFilter | string
    originalName?: StringFilter | string
    description?: StringNullableFilter | string | null
    type?: EnumAttachmentTypeFilter | AttachmentType
    questionId?: StringNullableFilter | string | null
    ownerId?: StringFilter | string
  }

  export type TagUpsertWithWhereUniqueWithoutOwnerInput = {
    where: TagWhereUniqueInput
    update: XOR<TagUpdateWithoutOwnerInput, TagUncheckedUpdateWithoutOwnerInput>
    create: XOR<TagCreateWithoutOwnerInput, TagUncheckedCreateWithoutOwnerInput>
  }

  export type TagUpdateWithWhereUniqueWithoutOwnerInput = {
    where: TagWhereUniqueInput
    data: XOR<TagUpdateWithoutOwnerInput, TagUncheckedUpdateWithoutOwnerInput>
  }

  export type TagUpdateManyWithWhereWithoutOwnerInput = {
    where: TagScalarWhereInput
    data: XOR<TagUpdateManyMutationInput, TagUncheckedUpdateManyWithoutTagsInput>
  }

  export type TagScalarWhereInput = {
    AND?: Enumerable<TagScalarWhereInput>
    OR?: Enumerable<TagScalarWhereInput>
    NOT?: Enumerable<TagScalarWhereInput>
    id?: IntFilter | number
    ownerId?: StringFilter | string
  }

  export type QuestionInstanceUpsertWithWhereUniqueWithoutOwnerInput = {
    where: QuestionInstanceWhereUniqueInput
    update: XOR<QuestionInstanceUpdateWithoutOwnerInput, QuestionInstanceUncheckedUpdateWithoutOwnerInput>
    create: XOR<QuestionInstanceCreateWithoutOwnerInput, QuestionInstanceUncheckedCreateWithoutOwnerInput>
  }

  export type QuestionInstanceUpdateWithWhereUniqueWithoutOwnerInput = {
    where: QuestionInstanceWhereUniqueInput
    data: XOR<QuestionInstanceUpdateWithoutOwnerInput, QuestionInstanceUncheckedUpdateWithoutOwnerInput>
  }

  export type QuestionInstanceUpdateManyWithWhereWithoutOwnerInput = {
    where: QuestionInstanceScalarWhereInput
    data: XOR<QuestionInstanceUpdateManyMutationInput, QuestionInstanceUncheckedUpdateManyWithoutQuestionInstancesInput>
  }

  export type QuestionInstanceScalarWhereInput = {
    AND?: Enumerable<QuestionInstanceScalarWhereInput>
    OR?: Enumerable<QuestionInstanceScalarWhereInput>
    NOT?: Enumerable<QuestionInstanceScalarWhereInput>
    id?: StringFilter | string
    questionData?: JsonFilter
    results?: JsonFilter
    sessionBlockId?: IntNullableFilter | number | null
    learningElementId?: StringNullableFilter | string | null
    microSessionId?: StringNullableFilter | string | null
    questionId?: StringFilter | string
    ownerId?: StringFilter | string
  }

  export type SessionUpsertWithWhereUniqueWithoutOwnerInput = {
    where: SessionWhereUniqueInput
    update: XOR<SessionUpdateWithoutOwnerInput, SessionUncheckedUpdateWithoutOwnerInput>
    create: XOR<SessionCreateWithoutOwnerInput, SessionUncheckedCreateWithoutOwnerInput>
  }

  export type SessionUpdateWithWhereUniqueWithoutOwnerInput = {
    where: SessionWhereUniqueInput
    data: XOR<SessionUpdateWithoutOwnerInput, SessionUncheckedUpdateWithoutOwnerInput>
  }

  export type SessionUpdateManyWithWhereWithoutOwnerInput = {
    where: SessionScalarWhereInput
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyWithoutSessionsInput>
  }

  export type SessionScalarWhereInput = {
    AND?: Enumerable<SessionScalarWhereInput>
    OR?: Enumerable<SessionScalarWhereInput>
    NOT?: Enumerable<SessionScalarWhereInput>
    id?: StringFilter | string
    namespace?: StringFilter | string
    execution?: IntFilter | number
    name?: StringFilter | string
    displayName?: StringFilter | string
    settings?: JsonFilter
    startedAt?: DateTimeFilter | Date | string
    finishedAt?: DateTimeFilter | Date | string
    accessMode?: EnumAccessModeFilter | AccessMode
    status?: EnumSessionStatusFilter | SessionStatus
    ownerId?: StringFilter | string
    courseId?: StringFilter | string
  }

  export type LearningElementUpsertWithWhereUniqueWithoutOwnerInput = {
    where: LearningElementWhereUniqueInput
    update: XOR<LearningElementUpdateWithoutOwnerInput, LearningElementUncheckedUpdateWithoutOwnerInput>
    create: XOR<LearningElementCreateWithoutOwnerInput, LearningElementUncheckedCreateWithoutOwnerInput>
  }

  export type LearningElementUpdateWithWhereUniqueWithoutOwnerInput = {
    where: LearningElementWhereUniqueInput
    data: XOR<LearningElementUpdateWithoutOwnerInput, LearningElementUncheckedUpdateWithoutOwnerInput>
  }

  export type LearningElementUpdateManyWithWhereWithoutOwnerInput = {
    where: LearningElementScalarWhereInput
    data: XOR<LearningElementUpdateManyMutationInput, LearningElementUncheckedUpdateManyWithoutLearningElementsInput>
  }

  export type LearningElementScalarWhereInput = {
    AND?: Enumerable<LearningElementScalarWhereInput>
    OR?: Enumerable<LearningElementScalarWhereInput>
    NOT?: Enumerable<LearningElementScalarWhereInput>
    id?: StringFilter | string
    ownerId?: StringFilter | string
    courseId?: StringFilter | string
  }

  export type MicroSessionUpsertWithWhereUniqueWithoutOwnerInput = {
    where: MicroSessionWhereUniqueInput
    update: XOR<MicroSessionUpdateWithoutOwnerInput, MicroSessionUncheckedUpdateWithoutOwnerInput>
    create: XOR<MicroSessionCreateWithoutOwnerInput, MicroSessionUncheckedCreateWithoutOwnerInput>
  }

  export type MicroSessionUpdateWithWhereUniqueWithoutOwnerInput = {
    where: MicroSessionWhereUniqueInput
    data: XOR<MicroSessionUpdateWithoutOwnerInput, MicroSessionUncheckedUpdateWithoutOwnerInput>
  }

  export type MicroSessionUpdateManyWithWhereWithoutOwnerInput = {
    where: MicroSessionScalarWhereInput
    data: XOR<MicroSessionUpdateManyMutationInput, MicroSessionUncheckedUpdateManyWithoutMicroSessionsInput>
  }

  export type MicroSessionScalarWhereInput = {
    AND?: Enumerable<MicroSessionScalarWhereInput>
    OR?: Enumerable<MicroSessionScalarWhereInput>
    NOT?: Enumerable<MicroSessionScalarWhereInput>
    id?: StringFilter | string
    scheduledStartAt?: DateTimeFilter | Date | string
    scheduledEndAt?: DateTimeFilter | Date | string
    ownerId?: StringFilter | string
    courseId?: StringFilter | string
  }

  export type QuestionCreateWithoutAttachmentsInput = {
    id?: string
    isArchived?: boolean
    isDeleted?: boolean
    name: string
    content: string
    contentPlain: string
    options: JsonNullValueInput | InputJsonValue
    type: QuestionType
    tags?: TagCreateNestedManyWithoutQuestionsInput
    instances?: QuestionInstanceCreateNestedManyWithoutQuestionInput
    owner: UserCreateNestedOneWithoutQuestionsInput
  }

  export type QuestionUncheckedCreateWithoutAttachmentsInput = {
    id?: string
    isArchived?: boolean
    isDeleted?: boolean
    name: string
    content: string
    contentPlain: string
    options: JsonNullValueInput | InputJsonValue
    type: QuestionType
    tags?: TagUncheckedCreateNestedManyWithoutQuestionsInput
    instances?: QuestionInstanceUncheckedCreateNestedManyWithoutQuestionInput
    ownerId: string
  }

  export type QuestionCreateOrConnectWithoutAttachmentsInput = {
    where: QuestionWhereUniqueInput
    create: XOR<QuestionCreateWithoutAttachmentsInput, QuestionUncheckedCreateWithoutAttachmentsInput>
  }

  export type UserCreateWithoutAttachmentsInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountCreateNestedManyWithoutUserInput
    courses?: CourseCreateNestedManyWithoutOwnerInput
    questions?: QuestionCreateNestedManyWithoutOwnerInput
    tags?: TagCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceCreateNestedManyWithoutOwnerInput
    sessions?: SessionCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionCreateNestedManyWithoutOwnerInput
  }

  export type UserUncheckedCreateWithoutAttachmentsInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    courses?: CourseUncheckedCreateNestedManyWithoutOwnerInput
    questions?: QuestionUncheckedCreateNestedManyWithoutOwnerInput
    tags?: TagUncheckedCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceUncheckedCreateNestedManyWithoutOwnerInput
    sessions?: SessionUncheckedCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementUncheckedCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionUncheckedCreateNestedManyWithoutOwnerInput
  }

  export type UserCreateOrConnectWithoutAttachmentsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutAttachmentsInput, UserUncheckedCreateWithoutAttachmentsInput>
  }

  export type QuestionUpsertWithoutAttachmentsInput = {
    update: XOR<QuestionUpdateWithoutAttachmentsInput, QuestionUncheckedUpdateWithoutAttachmentsInput>
    create: XOR<QuestionCreateWithoutAttachmentsInput, QuestionUncheckedCreateWithoutAttachmentsInput>
  }

  export type QuestionUpdateWithoutAttachmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    contentPlain?: StringFieldUpdateOperationsInput | string
    options?: JsonNullValueInput | InputJsonValue
    type?: EnumQuestionTypeFieldUpdateOperationsInput | QuestionType
    tags?: TagUpdateManyWithoutQuestionsNestedInput
    instances?: QuestionInstanceUpdateManyWithoutQuestionNestedInput
    owner?: UserUpdateOneRequiredWithoutQuestionsNestedInput
  }

  export type QuestionUncheckedUpdateWithoutAttachmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    contentPlain?: StringFieldUpdateOperationsInput | string
    options?: JsonNullValueInput | InputJsonValue
    type?: EnumQuestionTypeFieldUpdateOperationsInput | QuestionType
    tags?: TagUncheckedUpdateManyWithoutQuestionsNestedInput
    instances?: QuestionInstanceUncheckedUpdateManyWithoutQuestionNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type UserUpsertWithoutAttachmentsInput = {
    update: XOR<UserUpdateWithoutAttachmentsInput, UserUncheckedUpdateWithoutAttachmentsInput>
    create: XOR<UserCreateWithoutAttachmentsInput, UserUncheckedCreateWithoutAttachmentsInput>
  }

  export type UserUpdateWithoutAttachmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUpdateManyWithoutUserNestedInput
    courses?: CourseUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUpdateManyWithoutOwnerNestedInput
    tags?: TagUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUpdateManyWithoutOwnerNestedInput
  }

  export type UserUncheckedUpdateWithoutAttachmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    courses?: CourseUncheckedUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUncheckedUpdateManyWithoutOwnerNestedInput
    tags?: TagUncheckedUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUncheckedUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUncheckedUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUncheckedUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUncheckedUpdateManyWithoutOwnerNestedInput
  }

  export type AttachmentCreateWithoutQuestionInput = {
    id?: string
    name: string
    originalName: string
    description?: string | null
    type: AttachmentType
    owner: UserCreateNestedOneWithoutAttachmentsInput
  }

  export type AttachmentUncheckedCreateWithoutQuestionInput = {
    id?: string
    name: string
    originalName: string
    description?: string | null
    type: AttachmentType
    ownerId: string
  }

  export type AttachmentCreateOrConnectWithoutQuestionInput = {
    where: AttachmentWhereUniqueInput
    create: XOR<AttachmentCreateWithoutQuestionInput, AttachmentUncheckedCreateWithoutQuestionInput>
  }

  export type AttachmentCreateManyQuestionInputEnvelope = {
    data: Enumerable<AttachmentCreateManyQuestionInput>
    skipDuplicates?: boolean
  }

  export type TagCreateWithoutQuestionsInput = {
    owner: UserCreateNestedOneWithoutTagsInput
  }

  export type TagUncheckedCreateWithoutQuestionsInput = {
    id?: number
    ownerId: string
  }

  export type TagCreateOrConnectWithoutQuestionsInput = {
    where: TagWhereUniqueInput
    create: XOR<TagCreateWithoutQuestionsInput, TagUncheckedCreateWithoutQuestionsInput>
  }

  export type QuestionInstanceCreateWithoutQuestionInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlock?: SessionBlockCreateNestedOneWithoutInstancesInput
    learningElement?: LearningElementCreateNestedOneWithoutInstancesInput
    microSession?: MicroSessionCreateNestedOneWithoutInstancesInput
    owner: UserCreateNestedOneWithoutQuestionInstancesInput
  }

  export type QuestionInstanceUncheckedCreateWithoutQuestionInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlockId?: number | null
    learningElementId?: string | null
    microSessionId?: string | null
    ownerId: string
  }

  export type QuestionInstanceCreateOrConnectWithoutQuestionInput = {
    where: QuestionInstanceWhereUniqueInput
    create: XOR<QuestionInstanceCreateWithoutQuestionInput, QuestionInstanceUncheckedCreateWithoutQuestionInput>
  }

  export type QuestionInstanceCreateManyQuestionInputEnvelope = {
    data: Enumerable<QuestionInstanceCreateManyQuestionInput>
    skipDuplicates?: boolean
  }

  export type UserCreateWithoutQuestionsInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountCreateNestedManyWithoutUserInput
    courses?: CourseCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentCreateNestedManyWithoutOwnerInput
    tags?: TagCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceCreateNestedManyWithoutOwnerInput
    sessions?: SessionCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionCreateNestedManyWithoutOwnerInput
  }

  export type UserUncheckedCreateWithoutQuestionsInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    courses?: CourseUncheckedCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentUncheckedCreateNestedManyWithoutOwnerInput
    tags?: TagUncheckedCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceUncheckedCreateNestedManyWithoutOwnerInput
    sessions?: SessionUncheckedCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementUncheckedCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionUncheckedCreateNestedManyWithoutOwnerInput
  }

  export type UserCreateOrConnectWithoutQuestionsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutQuestionsInput, UserUncheckedCreateWithoutQuestionsInput>
  }

  export type AttachmentUpsertWithWhereUniqueWithoutQuestionInput = {
    where: AttachmentWhereUniqueInput
    update: XOR<AttachmentUpdateWithoutQuestionInput, AttachmentUncheckedUpdateWithoutQuestionInput>
    create: XOR<AttachmentCreateWithoutQuestionInput, AttachmentUncheckedCreateWithoutQuestionInput>
  }

  export type AttachmentUpdateWithWhereUniqueWithoutQuestionInput = {
    where: AttachmentWhereUniqueInput
    data: XOR<AttachmentUpdateWithoutQuestionInput, AttachmentUncheckedUpdateWithoutQuestionInput>
  }

  export type AttachmentUpdateManyWithWhereWithoutQuestionInput = {
    where: AttachmentScalarWhereInput
    data: XOR<AttachmentUpdateManyMutationInput, AttachmentUncheckedUpdateManyWithoutAttachmentsInput>
  }

  export type TagUpsertWithWhereUniqueWithoutQuestionsInput = {
    where: TagWhereUniqueInput
    update: XOR<TagUpdateWithoutQuestionsInput, TagUncheckedUpdateWithoutQuestionsInput>
    create: XOR<TagCreateWithoutQuestionsInput, TagUncheckedCreateWithoutQuestionsInput>
  }

  export type TagUpdateWithWhereUniqueWithoutQuestionsInput = {
    where: TagWhereUniqueInput
    data: XOR<TagUpdateWithoutQuestionsInput, TagUncheckedUpdateWithoutQuestionsInput>
  }

  export type TagUpdateManyWithWhereWithoutQuestionsInput = {
    where: TagScalarWhereInput
    data: XOR<TagUpdateManyMutationInput, TagUncheckedUpdateManyWithoutTagsInput>
  }

  export type QuestionInstanceUpsertWithWhereUniqueWithoutQuestionInput = {
    where: QuestionInstanceWhereUniqueInput
    update: XOR<QuestionInstanceUpdateWithoutQuestionInput, QuestionInstanceUncheckedUpdateWithoutQuestionInput>
    create: XOR<QuestionInstanceCreateWithoutQuestionInput, QuestionInstanceUncheckedCreateWithoutQuestionInput>
  }

  export type QuestionInstanceUpdateWithWhereUniqueWithoutQuestionInput = {
    where: QuestionInstanceWhereUniqueInput
    data: XOR<QuestionInstanceUpdateWithoutQuestionInput, QuestionInstanceUncheckedUpdateWithoutQuestionInput>
  }

  export type QuestionInstanceUpdateManyWithWhereWithoutQuestionInput = {
    where: QuestionInstanceScalarWhereInput
    data: XOR<QuestionInstanceUpdateManyMutationInput, QuestionInstanceUncheckedUpdateManyWithoutInstancesInput>
  }

  export type UserUpsertWithoutQuestionsInput = {
    update: XOR<UserUpdateWithoutQuestionsInput, UserUncheckedUpdateWithoutQuestionsInput>
    create: XOR<UserCreateWithoutQuestionsInput, UserUncheckedCreateWithoutQuestionsInput>
  }

  export type UserUpdateWithoutQuestionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUpdateManyWithoutUserNestedInput
    courses?: CourseUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUpdateManyWithoutOwnerNestedInput
    tags?: TagUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUpdateManyWithoutOwnerNestedInput
  }

  export type UserUncheckedUpdateWithoutQuestionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    courses?: CourseUncheckedUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUncheckedUpdateManyWithoutOwnerNestedInput
    tags?: TagUncheckedUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUncheckedUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUncheckedUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUncheckedUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUncheckedUpdateManyWithoutOwnerNestedInput
  }

  export type QuestionCreateWithoutTagsInput = {
    id?: string
    isArchived?: boolean
    isDeleted?: boolean
    name: string
    content: string
    contentPlain: string
    options: JsonNullValueInput | InputJsonValue
    type: QuestionType
    attachments?: AttachmentCreateNestedManyWithoutQuestionInput
    instances?: QuestionInstanceCreateNestedManyWithoutQuestionInput
    owner: UserCreateNestedOneWithoutQuestionsInput
  }

  export type QuestionUncheckedCreateWithoutTagsInput = {
    id?: string
    isArchived?: boolean
    isDeleted?: boolean
    name: string
    content: string
    contentPlain: string
    options: JsonNullValueInput | InputJsonValue
    type: QuestionType
    attachments?: AttachmentUncheckedCreateNestedManyWithoutQuestionInput
    instances?: QuestionInstanceUncheckedCreateNestedManyWithoutQuestionInput
    ownerId: string
  }

  export type QuestionCreateOrConnectWithoutTagsInput = {
    where: QuestionWhereUniqueInput
    create: XOR<QuestionCreateWithoutTagsInput, QuestionUncheckedCreateWithoutTagsInput>
  }

  export type UserCreateWithoutTagsInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountCreateNestedManyWithoutUserInput
    courses?: CourseCreateNestedManyWithoutOwnerInput
    questions?: QuestionCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceCreateNestedManyWithoutOwnerInput
    sessions?: SessionCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionCreateNestedManyWithoutOwnerInput
  }

  export type UserUncheckedCreateWithoutTagsInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    courses?: CourseUncheckedCreateNestedManyWithoutOwnerInput
    questions?: QuestionUncheckedCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentUncheckedCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceUncheckedCreateNestedManyWithoutOwnerInput
    sessions?: SessionUncheckedCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementUncheckedCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionUncheckedCreateNestedManyWithoutOwnerInput
  }

  export type UserCreateOrConnectWithoutTagsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutTagsInput, UserUncheckedCreateWithoutTagsInput>
  }

  export type QuestionUpsertWithWhereUniqueWithoutTagsInput = {
    where: QuestionWhereUniqueInput
    update: XOR<QuestionUpdateWithoutTagsInput, QuestionUncheckedUpdateWithoutTagsInput>
    create: XOR<QuestionCreateWithoutTagsInput, QuestionUncheckedCreateWithoutTagsInput>
  }

  export type QuestionUpdateWithWhereUniqueWithoutTagsInput = {
    where: QuestionWhereUniqueInput
    data: XOR<QuestionUpdateWithoutTagsInput, QuestionUncheckedUpdateWithoutTagsInput>
  }

  export type QuestionUpdateManyWithWhereWithoutTagsInput = {
    where: QuestionScalarWhereInput
    data: XOR<QuestionUpdateManyMutationInput, QuestionUncheckedUpdateManyWithoutQuestionsInput>
  }

  export type UserUpsertWithoutTagsInput = {
    update: XOR<UserUpdateWithoutTagsInput, UserUncheckedUpdateWithoutTagsInput>
    create: XOR<UserCreateWithoutTagsInput, UserUncheckedCreateWithoutTagsInput>
  }

  export type UserUpdateWithoutTagsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUpdateManyWithoutUserNestedInput
    courses?: CourseUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUpdateManyWithoutOwnerNestedInput
  }

  export type UserUncheckedUpdateWithoutTagsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    courses?: CourseUncheckedUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUncheckedUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUncheckedUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUncheckedUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUncheckedUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUncheckedUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUncheckedUpdateManyWithoutOwnerNestedInput
  }

  export type SessionBlockCreateWithoutInstancesInput = {
    expiresAt?: Date | string | null
    timeLimit?: number | null
    randomSelection?: number | null
    session: SessionCreateNestedOneWithoutBlocksInput
  }

  export type SessionBlockUncheckedCreateWithoutInstancesInput = {
    id?: number
    expiresAt?: Date | string | null
    timeLimit?: number | null
    randomSelection?: number | null
    sessionId: string
  }

  export type SessionBlockCreateOrConnectWithoutInstancesInput = {
    where: SessionBlockWhereUniqueInput
    create: XOR<SessionBlockCreateWithoutInstancesInput, SessionBlockUncheckedCreateWithoutInstancesInput>
  }

  export type LearningElementCreateWithoutInstancesInput = {
    id?: string
    owner: UserCreateNestedOneWithoutLearningElementsInput
    course: CourseCreateNestedOneWithoutLearningElementsInput
  }

  export type LearningElementUncheckedCreateWithoutInstancesInput = {
    id?: string
    ownerId: string
    courseId: string
  }

  export type LearningElementCreateOrConnectWithoutInstancesInput = {
    where: LearningElementWhereUniqueInput
    create: XOR<LearningElementCreateWithoutInstancesInput, LearningElementUncheckedCreateWithoutInstancesInput>
  }

  export type MicroSessionCreateWithoutInstancesInput = {
    id?: string
    scheduledStartAt: Date | string
    scheduledEndAt: Date | string
    owner: UserCreateNestedOneWithoutMicroSessionsInput
    course: CourseCreateNestedOneWithoutMicroSessionsInput
  }

  export type MicroSessionUncheckedCreateWithoutInstancesInput = {
    id?: string
    scheduledStartAt: Date | string
    scheduledEndAt: Date | string
    ownerId: string
    courseId: string
  }

  export type MicroSessionCreateOrConnectWithoutInstancesInput = {
    where: MicroSessionWhereUniqueInput
    create: XOR<MicroSessionCreateWithoutInstancesInput, MicroSessionUncheckedCreateWithoutInstancesInput>
  }

  export type QuestionCreateWithoutInstancesInput = {
    id?: string
    isArchived?: boolean
    isDeleted?: boolean
    name: string
    content: string
    contentPlain: string
    options: JsonNullValueInput | InputJsonValue
    type: QuestionType
    attachments?: AttachmentCreateNestedManyWithoutQuestionInput
    tags?: TagCreateNestedManyWithoutQuestionsInput
    owner: UserCreateNestedOneWithoutQuestionsInput
  }

  export type QuestionUncheckedCreateWithoutInstancesInput = {
    id?: string
    isArchived?: boolean
    isDeleted?: boolean
    name: string
    content: string
    contentPlain: string
    options: JsonNullValueInput | InputJsonValue
    type: QuestionType
    attachments?: AttachmentUncheckedCreateNestedManyWithoutQuestionInput
    tags?: TagUncheckedCreateNestedManyWithoutQuestionsInput
    ownerId: string
  }

  export type QuestionCreateOrConnectWithoutInstancesInput = {
    where: QuestionWhereUniqueInput
    create: XOR<QuestionCreateWithoutInstancesInput, QuestionUncheckedCreateWithoutInstancesInput>
  }

  export type UserCreateWithoutQuestionInstancesInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountCreateNestedManyWithoutUserInput
    courses?: CourseCreateNestedManyWithoutOwnerInput
    questions?: QuestionCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentCreateNestedManyWithoutOwnerInput
    tags?: TagCreateNestedManyWithoutOwnerInput
    sessions?: SessionCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionCreateNestedManyWithoutOwnerInput
  }

  export type UserUncheckedCreateWithoutQuestionInstancesInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    courses?: CourseUncheckedCreateNestedManyWithoutOwnerInput
    questions?: QuestionUncheckedCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentUncheckedCreateNestedManyWithoutOwnerInput
    tags?: TagUncheckedCreateNestedManyWithoutOwnerInput
    sessions?: SessionUncheckedCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementUncheckedCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionUncheckedCreateNestedManyWithoutOwnerInput
  }

  export type UserCreateOrConnectWithoutQuestionInstancesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutQuestionInstancesInput, UserUncheckedCreateWithoutQuestionInstancesInput>
  }

  export type SessionBlockUpsertWithoutInstancesInput = {
    update: XOR<SessionBlockUpdateWithoutInstancesInput, SessionBlockUncheckedUpdateWithoutInstancesInput>
    create: XOR<SessionBlockCreateWithoutInstancesInput, SessionBlockUncheckedCreateWithoutInstancesInput>
  }

  export type SessionBlockUpdateWithoutInstancesInput = {
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    timeLimit?: NullableIntFieldUpdateOperationsInput | number | null
    randomSelection?: NullableIntFieldUpdateOperationsInput | number | null
    session?: SessionUpdateOneRequiredWithoutBlocksNestedInput
  }

  export type SessionBlockUncheckedUpdateWithoutInstancesInput = {
    id?: IntFieldUpdateOperationsInput | number
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    timeLimit?: NullableIntFieldUpdateOperationsInput | number | null
    randomSelection?: NullableIntFieldUpdateOperationsInput | number | null
    sessionId?: StringFieldUpdateOperationsInput | string
  }

  export type LearningElementUpsertWithoutInstancesInput = {
    update: XOR<LearningElementUpdateWithoutInstancesInput, LearningElementUncheckedUpdateWithoutInstancesInput>
    create: XOR<LearningElementCreateWithoutInstancesInput, LearningElementUncheckedCreateWithoutInstancesInput>
  }

  export type LearningElementUpdateWithoutInstancesInput = {
    id?: StringFieldUpdateOperationsInput | string
    owner?: UserUpdateOneRequiredWithoutLearningElementsNestedInput
    course?: CourseUpdateOneRequiredWithoutLearningElementsNestedInput
  }

  export type LearningElementUncheckedUpdateWithoutInstancesInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type MicroSessionUpsertWithoutInstancesInput = {
    update: XOR<MicroSessionUpdateWithoutInstancesInput, MicroSessionUncheckedUpdateWithoutInstancesInput>
    create: XOR<MicroSessionCreateWithoutInstancesInput, MicroSessionUncheckedCreateWithoutInstancesInput>
  }

  export type MicroSessionUpdateWithoutInstancesInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduledStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduledEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
    owner?: UserUpdateOneRequiredWithoutMicroSessionsNestedInput
    course?: CourseUpdateOneRequiredWithoutMicroSessionsNestedInput
  }

  export type MicroSessionUncheckedUpdateWithoutInstancesInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduledStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduledEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
    ownerId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type QuestionUpsertWithoutInstancesInput = {
    update: XOR<QuestionUpdateWithoutInstancesInput, QuestionUncheckedUpdateWithoutInstancesInput>
    create: XOR<QuestionCreateWithoutInstancesInput, QuestionUncheckedCreateWithoutInstancesInput>
  }

  export type QuestionUpdateWithoutInstancesInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    contentPlain?: StringFieldUpdateOperationsInput | string
    options?: JsonNullValueInput | InputJsonValue
    type?: EnumQuestionTypeFieldUpdateOperationsInput | QuestionType
    attachments?: AttachmentUpdateManyWithoutQuestionNestedInput
    tags?: TagUpdateManyWithoutQuestionsNestedInput
    owner?: UserUpdateOneRequiredWithoutQuestionsNestedInput
  }

  export type QuestionUncheckedUpdateWithoutInstancesInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    contentPlain?: StringFieldUpdateOperationsInput | string
    options?: JsonNullValueInput | InputJsonValue
    type?: EnumQuestionTypeFieldUpdateOperationsInput | QuestionType
    attachments?: AttachmentUncheckedUpdateManyWithoutQuestionNestedInput
    tags?: TagUncheckedUpdateManyWithoutQuestionsNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type UserUpsertWithoutQuestionInstancesInput = {
    update: XOR<UserUpdateWithoutQuestionInstancesInput, UserUncheckedUpdateWithoutQuestionInstancesInput>
    create: XOR<UserCreateWithoutQuestionInstancesInput, UserUncheckedCreateWithoutQuestionInstancesInput>
  }

  export type UserUpdateWithoutQuestionInstancesInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUpdateManyWithoutUserNestedInput
    courses?: CourseUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUpdateManyWithoutOwnerNestedInput
    tags?: TagUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUpdateManyWithoutOwnerNestedInput
  }

  export type UserUncheckedUpdateWithoutQuestionInstancesInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    courses?: CourseUncheckedUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUncheckedUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUncheckedUpdateManyWithoutOwnerNestedInput
    tags?: TagUncheckedUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUncheckedUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUncheckedUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUncheckedUpdateManyWithoutOwnerNestedInput
  }

  export type SessionCreateWithoutCourseInput = {
    id?: string
    namespace?: string
    execution?: number
    name: string
    displayName: string
    settings: JsonNullValueInput | InputJsonValue
    startedAt: Date | string
    finishedAt: Date | string
    accessMode?: AccessMode
    status: SessionStatus
    blocks?: SessionBlockCreateNestedManyWithoutSessionInput
    owner: UserCreateNestedOneWithoutSessionsInput
  }

  export type SessionUncheckedCreateWithoutCourseInput = {
    id?: string
    namespace?: string
    execution?: number
    name: string
    displayName: string
    settings: JsonNullValueInput | InputJsonValue
    startedAt: Date | string
    finishedAt: Date | string
    accessMode?: AccessMode
    status: SessionStatus
    blocks?: SessionBlockUncheckedCreateNestedManyWithoutSessionInput
    ownerId: string
  }

  export type SessionCreateOrConnectWithoutCourseInput = {
    where: SessionWhereUniqueInput
    create: XOR<SessionCreateWithoutCourseInput, SessionUncheckedCreateWithoutCourseInput>
  }

  export type SessionCreateManyCourseInputEnvelope = {
    data: Enumerable<SessionCreateManyCourseInput>
    skipDuplicates?: boolean
  }

  export type LearningElementCreateWithoutCourseInput = {
    id?: string
    instances?: QuestionInstanceCreateNestedManyWithoutLearningElementInput
    owner: UserCreateNestedOneWithoutLearningElementsInput
  }

  export type LearningElementUncheckedCreateWithoutCourseInput = {
    id?: string
    instances?: QuestionInstanceUncheckedCreateNestedManyWithoutLearningElementInput
    ownerId: string
  }

  export type LearningElementCreateOrConnectWithoutCourseInput = {
    where: LearningElementWhereUniqueInput
    create: XOR<LearningElementCreateWithoutCourseInput, LearningElementUncheckedCreateWithoutCourseInput>
  }

  export type LearningElementCreateManyCourseInputEnvelope = {
    data: Enumerable<LearningElementCreateManyCourseInput>
    skipDuplicates?: boolean
  }

  export type MicroSessionCreateWithoutCourseInput = {
    id?: string
    scheduledStartAt: Date | string
    scheduledEndAt: Date | string
    instances?: QuestionInstanceCreateNestedManyWithoutMicroSessionInput
    owner: UserCreateNestedOneWithoutMicroSessionsInput
  }

  export type MicroSessionUncheckedCreateWithoutCourseInput = {
    id?: string
    scheduledStartAt: Date | string
    scheduledEndAt: Date | string
    instances?: QuestionInstanceUncheckedCreateNestedManyWithoutMicroSessionInput
    ownerId: string
  }

  export type MicroSessionCreateOrConnectWithoutCourseInput = {
    where: MicroSessionWhereUniqueInput
    create: XOR<MicroSessionCreateWithoutCourseInput, MicroSessionUncheckedCreateWithoutCourseInput>
  }

  export type MicroSessionCreateManyCourseInputEnvelope = {
    data: Enumerable<MicroSessionCreateManyCourseInput>
    skipDuplicates?: boolean
  }

  export type UserCreateWithoutCoursesInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountCreateNestedManyWithoutUserInput
    questions?: QuestionCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentCreateNestedManyWithoutOwnerInput
    tags?: TagCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceCreateNestedManyWithoutOwnerInput
    sessions?: SessionCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionCreateNestedManyWithoutOwnerInput
  }

  export type UserUncheckedCreateWithoutCoursesInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    questions?: QuestionUncheckedCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentUncheckedCreateNestedManyWithoutOwnerInput
    tags?: TagUncheckedCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceUncheckedCreateNestedManyWithoutOwnerInput
    sessions?: SessionUncheckedCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementUncheckedCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionUncheckedCreateNestedManyWithoutOwnerInput
  }

  export type UserCreateOrConnectWithoutCoursesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutCoursesInput, UserUncheckedCreateWithoutCoursesInput>
  }

  export type SessionUpsertWithWhereUniqueWithoutCourseInput = {
    where: SessionWhereUniqueInput
    update: XOR<SessionUpdateWithoutCourseInput, SessionUncheckedUpdateWithoutCourseInput>
    create: XOR<SessionCreateWithoutCourseInput, SessionUncheckedCreateWithoutCourseInput>
  }

  export type SessionUpdateWithWhereUniqueWithoutCourseInput = {
    where: SessionWhereUniqueInput
    data: XOR<SessionUpdateWithoutCourseInput, SessionUncheckedUpdateWithoutCourseInput>
  }

  export type SessionUpdateManyWithWhereWithoutCourseInput = {
    where: SessionScalarWhereInput
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyWithoutSessionsInput>
  }

  export type LearningElementUpsertWithWhereUniqueWithoutCourseInput = {
    where: LearningElementWhereUniqueInput
    update: XOR<LearningElementUpdateWithoutCourseInput, LearningElementUncheckedUpdateWithoutCourseInput>
    create: XOR<LearningElementCreateWithoutCourseInput, LearningElementUncheckedCreateWithoutCourseInput>
  }

  export type LearningElementUpdateWithWhereUniqueWithoutCourseInput = {
    where: LearningElementWhereUniqueInput
    data: XOR<LearningElementUpdateWithoutCourseInput, LearningElementUncheckedUpdateWithoutCourseInput>
  }

  export type LearningElementUpdateManyWithWhereWithoutCourseInput = {
    where: LearningElementScalarWhereInput
    data: XOR<LearningElementUpdateManyMutationInput, LearningElementUncheckedUpdateManyWithoutLearningElementsInput>
  }

  export type MicroSessionUpsertWithWhereUniqueWithoutCourseInput = {
    where: MicroSessionWhereUniqueInput
    update: XOR<MicroSessionUpdateWithoutCourseInput, MicroSessionUncheckedUpdateWithoutCourseInput>
    create: XOR<MicroSessionCreateWithoutCourseInput, MicroSessionUncheckedCreateWithoutCourseInput>
  }

  export type MicroSessionUpdateWithWhereUniqueWithoutCourseInput = {
    where: MicroSessionWhereUniqueInput
    data: XOR<MicroSessionUpdateWithoutCourseInput, MicroSessionUncheckedUpdateWithoutCourseInput>
  }

  export type MicroSessionUpdateManyWithWhereWithoutCourseInput = {
    where: MicroSessionScalarWhereInput
    data: XOR<MicroSessionUpdateManyMutationInput, MicroSessionUncheckedUpdateManyWithoutMicroSessionsInput>
  }

  export type UserUpsertWithoutCoursesInput = {
    update: XOR<UserUpdateWithoutCoursesInput, UserUncheckedUpdateWithoutCoursesInput>
    create: XOR<UserCreateWithoutCoursesInput, UserUncheckedCreateWithoutCoursesInput>
  }

  export type UserUpdateWithoutCoursesInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUpdateManyWithoutUserNestedInput
    questions?: QuestionUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUpdateManyWithoutOwnerNestedInput
    tags?: TagUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUpdateManyWithoutOwnerNestedInput
  }

  export type UserUncheckedUpdateWithoutCoursesInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    questions?: QuestionUncheckedUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUncheckedUpdateManyWithoutOwnerNestedInput
    tags?: TagUncheckedUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUncheckedUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUncheckedUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUncheckedUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUncheckedUpdateManyWithoutOwnerNestedInput
  }

  export type SessionBlockCreateWithoutSessionInput = {
    expiresAt?: Date | string | null
    timeLimit?: number | null
    randomSelection?: number | null
    instances?: QuestionInstanceCreateNestedManyWithoutSessionBlockInput
  }

  export type SessionBlockUncheckedCreateWithoutSessionInput = {
    id?: number
    expiresAt?: Date | string | null
    timeLimit?: number | null
    randomSelection?: number | null
    instances?: QuestionInstanceUncheckedCreateNestedManyWithoutSessionBlockInput
  }

  export type SessionBlockCreateOrConnectWithoutSessionInput = {
    where: SessionBlockWhereUniqueInput
    create: XOR<SessionBlockCreateWithoutSessionInput, SessionBlockUncheckedCreateWithoutSessionInput>
  }

  export type SessionBlockCreateManySessionInputEnvelope = {
    data: Enumerable<SessionBlockCreateManySessionInput>
    skipDuplicates?: boolean
  }

  export type UserCreateWithoutSessionsInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountCreateNestedManyWithoutUserInput
    courses?: CourseCreateNestedManyWithoutOwnerInput
    questions?: QuestionCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentCreateNestedManyWithoutOwnerInput
    tags?: TagCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionCreateNestedManyWithoutOwnerInput
  }

  export type UserUncheckedCreateWithoutSessionsInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    courses?: CourseUncheckedCreateNestedManyWithoutOwnerInput
    questions?: QuestionUncheckedCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentUncheckedCreateNestedManyWithoutOwnerInput
    tags?: TagUncheckedCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceUncheckedCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementUncheckedCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionUncheckedCreateNestedManyWithoutOwnerInput
  }

  export type UserCreateOrConnectWithoutSessionsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
  }

  export type CourseCreateWithoutSessionsInput = {
    id?: string
    isArchived?: boolean
    name: string
    displayName: string
    description?: string | null
    learningElements?: LearningElementCreateNestedManyWithoutCourseInput
    microSessions?: MicroSessionCreateNestedManyWithoutCourseInput
    owner: UserCreateNestedOneWithoutCoursesInput
  }

  export type CourseUncheckedCreateWithoutSessionsInput = {
    id?: string
    isArchived?: boolean
    name: string
    displayName: string
    description?: string | null
    learningElements?: LearningElementUncheckedCreateNestedManyWithoutCourseInput
    microSessions?: MicroSessionUncheckedCreateNestedManyWithoutCourseInput
    ownerId: string
  }

  export type CourseCreateOrConnectWithoutSessionsInput = {
    where: CourseWhereUniqueInput
    create: XOR<CourseCreateWithoutSessionsInput, CourseUncheckedCreateWithoutSessionsInput>
  }

  export type SessionBlockUpsertWithWhereUniqueWithoutSessionInput = {
    where: SessionBlockWhereUniqueInput
    update: XOR<SessionBlockUpdateWithoutSessionInput, SessionBlockUncheckedUpdateWithoutSessionInput>
    create: XOR<SessionBlockCreateWithoutSessionInput, SessionBlockUncheckedCreateWithoutSessionInput>
  }

  export type SessionBlockUpdateWithWhereUniqueWithoutSessionInput = {
    where: SessionBlockWhereUniqueInput
    data: XOR<SessionBlockUpdateWithoutSessionInput, SessionBlockUncheckedUpdateWithoutSessionInput>
  }

  export type SessionBlockUpdateManyWithWhereWithoutSessionInput = {
    where: SessionBlockScalarWhereInput
    data: XOR<SessionBlockUpdateManyMutationInput, SessionBlockUncheckedUpdateManyWithoutBlocksInput>
  }

  export type SessionBlockScalarWhereInput = {
    AND?: Enumerable<SessionBlockScalarWhereInput>
    OR?: Enumerable<SessionBlockScalarWhereInput>
    NOT?: Enumerable<SessionBlockScalarWhereInput>
    id?: IntFilter | number
    expiresAt?: DateTimeNullableFilter | Date | string | null
    timeLimit?: IntNullableFilter | number | null
    randomSelection?: IntNullableFilter | number | null
    sessionId?: StringFilter | string
  }

  export type UserUpsertWithoutSessionsInput = {
    update: XOR<UserUpdateWithoutSessionsInput, UserUncheckedUpdateWithoutSessionsInput>
    create: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
  }

  export type UserUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUpdateManyWithoutUserNestedInput
    courses?: CourseUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUpdateManyWithoutOwnerNestedInput
    tags?: TagUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUpdateManyWithoutOwnerNestedInput
  }

  export type UserUncheckedUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    courses?: CourseUncheckedUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUncheckedUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUncheckedUpdateManyWithoutOwnerNestedInput
    tags?: TagUncheckedUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUncheckedUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUncheckedUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUncheckedUpdateManyWithoutOwnerNestedInput
  }

  export type CourseUpsertWithoutSessionsInput = {
    update: XOR<CourseUpdateWithoutSessionsInput, CourseUncheckedUpdateWithoutSessionsInput>
    create: XOR<CourseCreateWithoutSessionsInput, CourseUncheckedCreateWithoutSessionsInput>
  }

  export type CourseUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    learningElements?: LearningElementUpdateManyWithoutCourseNestedInput
    microSessions?: MicroSessionUpdateManyWithoutCourseNestedInput
    owner?: UserUpdateOneRequiredWithoutCoursesNestedInput
  }

  export type CourseUncheckedUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    learningElements?: LearningElementUncheckedUpdateManyWithoutCourseNestedInput
    microSessions?: MicroSessionUncheckedUpdateManyWithoutCourseNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type QuestionInstanceCreateWithoutSessionBlockInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    learningElement?: LearningElementCreateNestedOneWithoutInstancesInput
    microSession?: MicroSessionCreateNestedOneWithoutInstancesInput
    question: QuestionCreateNestedOneWithoutInstancesInput
    owner: UserCreateNestedOneWithoutQuestionInstancesInput
  }

  export type QuestionInstanceUncheckedCreateWithoutSessionBlockInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    learningElementId?: string | null
    microSessionId?: string | null
    questionId: string
    ownerId: string
  }

  export type QuestionInstanceCreateOrConnectWithoutSessionBlockInput = {
    where: QuestionInstanceWhereUniqueInput
    create: XOR<QuestionInstanceCreateWithoutSessionBlockInput, QuestionInstanceUncheckedCreateWithoutSessionBlockInput>
  }

  export type QuestionInstanceCreateManySessionBlockInputEnvelope = {
    data: Enumerable<QuestionInstanceCreateManySessionBlockInput>
    skipDuplicates?: boolean
  }

  export type SessionCreateWithoutBlocksInput = {
    id?: string
    namespace?: string
    execution?: number
    name: string
    displayName: string
    settings: JsonNullValueInput | InputJsonValue
    startedAt: Date | string
    finishedAt: Date | string
    accessMode?: AccessMode
    status: SessionStatus
    owner: UserCreateNestedOneWithoutSessionsInput
    course: CourseCreateNestedOneWithoutSessionsInput
  }

  export type SessionUncheckedCreateWithoutBlocksInput = {
    id?: string
    namespace?: string
    execution?: number
    name: string
    displayName: string
    settings: JsonNullValueInput | InputJsonValue
    startedAt: Date | string
    finishedAt: Date | string
    accessMode?: AccessMode
    status: SessionStatus
    ownerId: string
    courseId: string
  }

  export type SessionCreateOrConnectWithoutBlocksInput = {
    where: SessionWhereUniqueInput
    create: XOR<SessionCreateWithoutBlocksInput, SessionUncheckedCreateWithoutBlocksInput>
  }

  export type QuestionInstanceUpsertWithWhereUniqueWithoutSessionBlockInput = {
    where: QuestionInstanceWhereUniqueInput
    update: XOR<QuestionInstanceUpdateWithoutSessionBlockInput, QuestionInstanceUncheckedUpdateWithoutSessionBlockInput>
    create: XOR<QuestionInstanceCreateWithoutSessionBlockInput, QuestionInstanceUncheckedCreateWithoutSessionBlockInput>
  }

  export type QuestionInstanceUpdateWithWhereUniqueWithoutSessionBlockInput = {
    where: QuestionInstanceWhereUniqueInput
    data: XOR<QuestionInstanceUpdateWithoutSessionBlockInput, QuestionInstanceUncheckedUpdateWithoutSessionBlockInput>
  }

  export type QuestionInstanceUpdateManyWithWhereWithoutSessionBlockInput = {
    where: QuestionInstanceScalarWhereInput
    data: XOR<QuestionInstanceUpdateManyMutationInput, QuestionInstanceUncheckedUpdateManyWithoutInstancesInput>
  }

  export type SessionUpsertWithoutBlocksInput = {
    update: XOR<SessionUpdateWithoutBlocksInput, SessionUncheckedUpdateWithoutBlocksInput>
    create: XOR<SessionCreateWithoutBlocksInput, SessionUncheckedCreateWithoutBlocksInput>
  }

  export type SessionUpdateWithoutBlocksInput = {
    id?: StringFieldUpdateOperationsInput | string
    namespace?: StringFieldUpdateOperationsInput | string
    execution?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accessMode?: EnumAccessModeFieldUpdateOperationsInput | AccessMode
    status?: EnumSessionStatusFieldUpdateOperationsInput | SessionStatus
    owner?: UserUpdateOneRequiredWithoutSessionsNestedInput
    course?: CourseUpdateOneRequiredWithoutSessionsNestedInput
  }

  export type SessionUncheckedUpdateWithoutBlocksInput = {
    id?: StringFieldUpdateOperationsInput | string
    namespace?: StringFieldUpdateOperationsInput | string
    execution?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accessMode?: EnumAccessModeFieldUpdateOperationsInput | AccessMode
    status?: EnumSessionStatusFieldUpdateOperationsInput | SessionStatus
    ownerId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type QuestionInstanceCreateWithoutLearningElementInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlock?: SessionBlockCreateNestedOneWithoutInstancesInput
    microSession?: MicroSessionCreateNestedOneWithoutInstancesInput
    question: QuestionCreateNestedOneWithoutInstancesInput
    owner: UserCreateNestedOneWithoutQuestionInstancesInput
  }

  export type QuestionInstanceUncheckedCreateWithoutLearningElementInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlockId?: number | null
    microSessionId?: string | null
    questionId: string
    ownerId: string
  }

  export type QuestionInstanceCreateOrConnectWithoutLearningElementInput = {
    where: QuestionInstanceWhereUniqueInput
    create: XOR<QuestionInstanceCreateWithoutLearningElementInput, QuestionInstanceUncheckedCreateWithoutLearningElementInput>
  }

  export type QuestionInstanceCreateManyLearningElementInputEnvelope = {
    data: Enumerable<QuestionInstanceCreateManyLearningElementInput>
    skipDuplicates?: boolean
  }

  export type UserCreateWithoutLearningElementsInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountCreateNestedManyWithoutUserInput
    courses?: CourseCreateNestedManyWithoutOwnerInput
    questions?: QuestionCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentCreateNestedManyWithoutOwnerInput
    tags?: TagCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceCreateNestedManyWithoutOwnerInput
    sessions?: SessionCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionCreateNestedManyWithoutOwnerInput
  }

  export type UserUncheckedCreateWithoutLearningElementsInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    courses?: CourseUncheckedCreateNestedManyWithoutOwnerInput
    questions?: QuestionUncheckedCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentUncheckedCreateNestedManyWithoutOwnerInput
    tags?: TagUncheckedCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceUncheckedCreateNestedManyWithoutOwnerInput
    sessions?: SessionUncheckedCreateNestedManyWithoutOwnerInput
    microSessions?: MicroSessionUncheckedCreateNestedManyWithoutOwnerInput
  }

  export type UserCreateOrConnectWithoutLearningElementsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutLearningElementsInput, UserUncheckedCreateWithoutLearningElementsInput>
  }

  export type CourseCreateWithoutLearningElementsInput = {
    id?: string
    isArchived?: boolean
    name: string
    displayName: string
    description?: string | null
    sessions?: SessionCreateNestedManyWithoutCourseInput
    microSessions?: MicroSessionCreateNestedManyWithoutCourseInput
    owner: UserCreateNestedOneWithoutCoursesInput
  }

  export type CourseUncheckedCreateWithoutLearningElementsInput = {
    id?: string
    isArchived?: boolean
    name: string
    displayName: string
    description?: string | null
    sessions?: SessionUncheckedCreateNestedManyWithoutCourseInput
    microSessions?: MicroSessionUncheckedCreateNestedManyWithoutCourseInput
    ownerId: string
  }

  export type CourseCreateOrConnectWithoutLearningElementsInput = {
    where: CourseWhereUniqueInput
    create: XOR<CourseCreateWithoutLearningElementsInput, CourseUncheckedCreateWithoutLearningElementsInput>
  }

  export type QuestionInstanceUpsertWithWhereUniqueWithoutLearningElementInput = {
    where: QuestionInstanceWhereUniqueInput
    update: XOR<QuestionInstanceUpdateWithoutLearningElementInput, QuestionInstanceUncheckedUpdateWithoutLearningElementInput>
    create: XOR<QuestionInstanceCreateWithoutLearningElementInput, QuestionInstanceUncheckedCreateWithoutLearningElementInput>
  }

  export type QuestionInstanceUpdateWithWhereUniqueWithoutLearningElementInput = {
    where: QuestionInstanceWhereUniqueInput
    data: XOR<QuestionInstanceUpdateWithoutLearningElementInput, QuestionInstanceUncheckedUpdateWithoutLearningElementInput>
  }

  export type QuestionInstanceUpdateManyWithWhereWithoutLearningElementInput = {
    where: QuestionInstanceScalarWhereInput
    data: XOR<QuestionInstanceUpdateManyMutationInput, QuestionInstanceUncheckedUpdateManyWithoutInstancesInput>
  }

  export type UserUpsertWithoutLearningElementsInput = {
    update: XOR<UserUpdateWithoutLearningElementsInput, UserUncheckedUpdateWithoutLearningElementsInput>
    create: XOR<UserCreateWithoutLearningElementsInput, UserUncheckedCreateWithoutLearningElementsInput>
  }

  export type UserUpdateWithoutLearningElementsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUpdateManyWithoutUserNestedInput
    courses?: CourseUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUpdateManyWithoutOwnerNestedInput
    tags?: TagUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUpdateManyWithoutOwnerNestedInput
  }

  export type UserUncheckedUpdateWithoutLearningElementsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    courses?: CourseUncheckedUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUncheckedUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUncheckedUpdateManyWithoutOwnerNestedInput
    tags?: TagUncheckedUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUncheckedUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUncheckedUpdateManyWithoutOwnerNestedInput
    microSessions?: MicroSessionUncheckedUpdateManyWithoutOwnerNestedInput
  }

  export type CourseUpsertWithoutLearningElementsInput = {
    update: XOR<CourseUpdateWithoutLearningElementsInput, CourseUncheckedUpdateWithoutLearningElementsInput>
    create: XOR<CourseCreateWithoutLearningElementsInput, CourseUncheckedCreateWithoutLearningElementsInput>
  }

  export type CourseUpdateWithoutLearningElementsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sessions?: SessionUpdateManyWithoutCourseNestedInput
    microSessions?: MicroSessionUpdateManyWithoutCourseNestedInput
    owner?: UserUpdateOneRequiredWithoutCoursesNestedInput
  }

  export type CourseUncheckedUpdateWithoutLearningElementsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sessions?: SessionUncheckedUpdateManyWithoutCourseNestedInput
    microSessions?: MicroSessionUncheckedUpdateManyWithoutCourseNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type QuestionInstanceCreateWithoutMicroSessionInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlock?: SessionBlockCreateNestedOneWithoutInstancesInput
    learningElement?: LearningElementCreateNestedOneWithoutInstancesInput
    question: QuestionCreateNestedOneWithoutInstancesInput
    owner: UserCreateNestedOneWithoutQuestionInstancesInput
  }

  export type QuestionInstanceUncheckedCreateWithoutMicroSessionInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlockId?: number | null
    learningElementId?: string | null
    questionId: string
    ownerId: string
  }

  export type QuestionInstanceCreateOrConnectWithoutMicroSessionInput = {
    where: QuestionInstanceWhereUniqueInput
    create: XOR<QuestionInstanceCreateWithoutMicroSessionInput, QuestionInstanceUncheckedCreateWithoutMicroSessionInput>
  }

  export type QuestionInstanceCreateManyMicroSessionInputEnvelope = {
    data: Enumerable<QuestionInstanceCreateManyMicroSessionInput>
    skipDuplicates?: boolean
  }

  export type UserCreateWithoutMicroSessionsInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountCreateNestedManyWithoutUserInput
    courses?: CourseCreateNestedManyWithoutOwnerInput
    questions?: QuestionCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentCreateNestedManyWithoutOwnerInput
    tags?: TagCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceCreateNestedManyWithoutOwnerInput
    sessions?: SessionCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementCreateNestedManyWithoutOwnerInput
  }

  export type UserUncheckedCreateWithoutMicroSessionsInput = {
    id?: string
    isActive?: boolean
    isAAI?: boolean
    email: string
    shortname: string
    password: string
    salt: string
    description?: string | null
    lastLoginAt?: Date | string | null
    deletionToken?: string | null
    deletionRequestedAt?: Date | string | null
    role?: UserRole
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    courses?: CourseUncheckedCreateNestedManyWithoutOwnerInput
    questions?: QuestionUncheckedCreateNestedManyWithoutOwnerInput
    attachments?: AttachmentUncheckedCreateNestedManyWithoutOwnerInput
    tags?: TagUncheckedCreateNestedManyWithoutOwnerInput
    questionInstances?: QuestionInstanceUncheckedCreateNestedManyWithoutOwnerInput
    sessions?: SessionUncheckedCreateNestedManyWithoutOwnerInput
    learningElements?: LearningElementUncheckedCreateNestedManyWithoutOwnerInput
  }

  export type UserCreateOrConnectWithoutMicroSessionsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutMicroSessionsInput, UserUncheckedCreateWithoutMicroSessionsInput>
  }

  export type CourseCreateWithoutMicroSessionsInput = {
    id?: string
    isArchived?: boolean
    name: string
    displayName: string
    description?: string | null
    sessions?: SessionCreateNestedManyWithoutCourseInput
    learningElements?: LearningElementCreateNestedManyWithoutCourseInput
    owner: UserCreateNestedOneWithoutCoursesInput
  }

  export type CourseUncheckedCreateWithoutMicroSessionsInput = {
    id?: string
    isArchived?: boolean
    name: string
    displayName: string
    description?: string | null
    sessions?: SessionUncheckedCreateNestedManyWithoutCourseInput
    learningElements?: LearningElementUncheckedCreateNestedManyWithoutCourseInput
    ownerId: string
  }

  export type CourseCreateOrConnectWithoutMicroSessionsInput = {
    where: CourseWhereUniqueInput
    create: XOR<CourseCreateWithoutMicroSessionsInput, CourseUncheckedCreateWithoutMicroSessionsInput>
  }

  export type QuestionInstanceUpsertWithWhereUniqueWithoutMicroSessionInput = {
    where: QuestionInstanceWhereUniqueInput
    update: XOR<QuestionInstanceUpdateWithoutMicroSessionInput, QuestionInstanceUncheckedUpdateWithoutMicroSessionInput>
    create: XOR<QuestionInstanceCreateWithoutMicroSessionInput, QuestionInstanceUncheckedCreateWithoutMicroSessionInput>
  }

  export type QuestionInstanceUpdateWithWhereUniqueWithoutMicroSessionInput = {
    where: QuestionInstanceWhereUniqueInput
    data: XOR<QuestionInstanceUpdateWithoutMicroSessionInput, QuestionInstanceUncheckedUpdateWithoutMicroSessionInput>
  }

  export type QuestionInstanceUpdateManyWithWhereWithoutMicroSessionInput = {
    where: QuestionInstanceScalarWhereInput
    data: XOR<QuestionInstanceUpdateManyMutationInput, QuestionInstanceUncheckedUpdateManyWithoutInstancesInput>
  }

  export type UserUpsertWithoutMicroSessionsInput = {
    update: XOR<UserUpdateWithoutMicroSessionsInput, UserUncheckedUpdateWithoutMicroSessionsInput>
    create: XOR<UserCreateWithoutMicroSessionsInput, UserUncheckedCreateWithoutMicroSessionsInput>
  }

  export type UserUpdateWithoutMicroSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUpdateManyWithoutUserNestedInput
    courses?: CourseUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUpdateManyWithoutOwnerNestedInput
    tags?: TagUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUpdateManyWithoutOwnerNestedInput
  }

  export type UserUncheckedUpdateWithoutMicroSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    isAAI?: BoolFieldUpdateOperationsInput | boolean
    email?: StringFieldUpdateOperationsInput | string
    shortname?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    salt?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deletionToken?: NullableStringFieldUpdateOperationsInput | string | null
    deletionRequestedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    role?: EnumUserRoleFieldUpdateOperationsInput | UserRole
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    courses?: CourseUncheckedUpdateManyWithoutOwnerNestedInput
    questions?: QuestionUncheckedUpdateManyWithoutOwnerNestedInput
    attachments?: AttachmentUncheckedUpdateManyWithoutOwnerNestedInput
    tags?: TagUncheckedUpdateManyWithoutOwnerNestedInput
    questionInstances?: QuestionInstanceUncheckedUpdateManyWithoutOwnerNestedInput
    sessions?: SessionUncheckedUpdateManyWithoutOwnerNestedInput
    learningElements?: LearningElementUncheckedUpdateManyWithoutOwnerNestedInput
  }

  export type CourseUpsertWithoutMicroSessionsInput = {
    update: XOR<CourseUpdateWithoutMicroSessionsInput, CourseUncheckedUpdateWithoutMicroSessionsInput>
    create: XOR<CourseCreateWithoutMicroSessionsInput, CourseUncheckedCreateWithoutMicroSessionsInput>
  }

  export type CourseUpdateWithoutMicroSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sessions?: SessionUpdateManyWithoutCourseNestedInput
    learningElements?: LearningElementUpdateManyWithoutCourseNestedInput
    owner?: UserUpdateOneRequiredWithoutCoursesNestedInput
  }

  export type CourseUncheckedUpdateWithoutMicroSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sessions?: SessionUncheckedUpdateManyWithoutCourseNestedInput
    learningElements?: LearningElementUncheckedUpdateManyWithoutCourseNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type AccountCreateManyUserInput = {
    id?: string
    ssoType: string
    ssoId: string
  }

  export type CourseCreateManyOwnerInput = {
    id?: string
    isArchived?: boolean
    name: string
    displayName: string
    description?: string | null
  }

  export type QuestionCreateManyOwnerInput = {
    id?: string
    isArchived?: boolean
    isDeleted?: boolean
    name: string
    content: string
    contentPlain: string
    options: JsonNullValueInput | InputJsonValue
    type: QuestionType
  }

  export type AttachmentCreateManyOwnerInput = {
    id?: string
    name: string
    originalName: string
    description?: string | null
    type: AttachmentType
    questionId?: string | null
  }

  export type TagCreateManyOwnerInput = {
    id?: number
  }

  export type QuestionInstanceCreateManyOwnerInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlockId?: number | null
    learningElementId?: string | null
    microSessionId?: string | null
    questionId: string
  }

  export type SessionCreateManyOwnerInput = {
    id?: string
    namespace?: string
    execution?: number
    name: string
    displayName: string
    settings: JsonNullValueInput | InputJsonValue
    startedAt: Date | string
    finishedAt: Date | string
    accessMode?: AccessMode
    status: SessionStatus
    courseId: string
  }

  export type LearningElementCreateManyOwnerInput = {
    id?: string
    courseId: string
  }

  export type MicroSessionCreateManyOwnerInput = {
    id?: string
    scheduledStartAt: Date | string
    scheduledEndAt: Date | string
    courseId: string
  }

  export type AccountUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    ssoType?: StringFieldUpdateOperationsInput | string
    ssoId?: StringFieldUpdateOperationsInput | string
  }

  export type AccountUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    ssoType?: StringFieldUpdateOperationsInput | string
    ssoId?: StringFieldUpdateOperationsInput | string
  }

  export type AccountUncheckedUpdateManyWithoutAccountsInput = {
    id?: StringFieldUpdateOperationsInput | string
    ssoType?: StringFieldUpdateOperationsInput | string
    ssoId?: StringFieldUpdateOperationsInput | string
  }

  export type CourseUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sessions?: SessionUpdateManyWithoutCourseNestedInput
    learningElements?: LearningElementUpdateManyWithoutCourseNestedInput
    microSessions?: MicroSessionUpdateManyWithoutCourseNestedInput
  }

  export type CourseUncheckedUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    sessions?: SessionUncheckedUpdateManyWithoutCourseNestedInput
    learningElements?: LearningElementUncheckedUpdateManyWithoutCourseNestedInput
    microSessions?: MicroSessionUncheckedUpdateManyWithoutCourseNestedInput
  }

  export type CourseUncheckedUpdateManyWithoutCoursesInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type QuestionUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    contentPlain?: StringFieldUpdateOperationsInput | string
    options?: JsonNullValueInput | InputJsonValue
    type?: EnumQuestionTypeFieldUpdateOperationsInput | QuestionType
    attachments?: AttachmentUpdateManyWithoutQuestionNestedInput
    tags?: TagUpdateManyWithoutQuestionsNestedInput
    instances?: QuestionInstanceUpdateManyWithoutQuestionNestedInput
  }

  export type QuestionUncheckedUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    contentPlain?: StringFieldUpdateOperationsInput | string
    options?: JsonNullValueInput | InputJsonValue
    type?: EnumQuestionTypeFieldUpdateOperationsInput | QuestionType
    attachments?: AttachmentUncheckedUpdateManyWithoutQuestionNestedInput
    tags?: TagUncheckedUpdateManyWithoutQuestionsNestedInput
    instances?: QuestionInstanceUncheckedUpdateManyWithoutQuestionNestedInput
  }

  export type QuestionUncheckedUpdateManyWithoutQuestionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    contentPlain?: StringFieldUpdateOperationsInput | string
    options?: JsonNullValueInput | InputJsonValue
    type?: EnumQuestionTypeFieldUpdateOperationsInput | QuestionType
  }

  export type AttachmentUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    originalName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: EnumAttachmentTypeFieldUpdateOperationsInput | AttachmentType
    question?: QuestionUpdateOneWithoutAttachmentsNestedInput
  }

  export type AttachmentUncheckedUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    originalName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: EnumAttachmentTypeFieldUpdateOperationsInput | AttachmentType
    questionId?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type AttachmentUncheckedUpdateManyWithoutAttachmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    originalName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: EnumAttachmentTypeFieldUpdateOperationsInput | AttachmentType
    questionId?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type TagUpdateWithoutOwnerInput = {
    questions?: QuestionUpdateManyWithoutTagsNestedInput
  }

  export type TagUncheckedUpdateWithoutOwnerInput = {
    id?: IntFieldUpdateOperationsInput | number
    questions?: QuestionUncheckedUpdateManyWithoutTagsNestedInput
  }

  export type TagUncheckedUpdateManyWithoutTagsInput = {
    id?: IntFieldUpdateOperationsInput | number
  }

  export type QuestionInstanceUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    sessionBlock?: SessionBlockUpdateOneWithoutInstancesNestedInput
    learningElement?: LearningElementUpdateOneWithoutInstancesNestedInput
    microSession?: MicroSessionUpdateOneWithoutInstancesNestedInput
    question?: QuestionUpdateOneRequiredWithoutInstancesNestedInput
  }

  export type QuestionInstanceUncheckedUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    sessionBlockId?: NullableIntFieldUpdateOperationsInput | number | null
    learningElementId?: NullableStringFieldUpdateOperationsInput | string | null
    microSessionId?: NullableStringFieldUpdateOperationsInput | string | null
    questionId?: StringFieldUpdateOperationsInput | string
  }

  export type QuestionInstanceUncheckedUpdateManyWithoutQuestionInstancesInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    sessionBlockId?: NullableIntFieldUpdateOperationsInput | number | null
    learningElementId?: NullableStringFieldUpdateOperationsInput | string | null
    microSessionId?: NullableStringFieldUpdateOperationsInput | string | null
    questionId?: StringFieldUpdateOperationsInput | string
  }

  export type SessionUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    namespace?: StringFieldUpdateOperationsInput | string
    execution?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accessMode?: EnumAccessModeFieldUpdateOperationsInput | AccessMode
    status?: EnumSessionStatusFieldUpdateOperationsInput | SessionStatus
    blocks?: SessionBlockUpdateManyWithoutSessionNestedInput
    course?: CourseUpdateOneRequiredWithoutSessionsNestedInput
  }

  export type SessionUncheckedUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    namespace?: StringFieldUpdateOperationsInput | string
    execution?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accessMode?: EnumAccessModeFieldUpdateOperationsInput | AccessMode
    status?: EnumSessionStatusFieldUpdateOperationsInput | SessionStatus
    blocks?: SessionBlockUncheckedUpdateManyWithoutSessionNestedInput
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type SessionUncheckedUpdateManyWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    namespace?: StringFieldUpdateOperationsInput | string
    execution?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accessMode?: EnumAccessModeFieldUpdateOperationsInput | AccessMode
    status?: EnumSessionStatusFieldUpdateOperationsInput | SessionStatus
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type LearningElementUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    instances?: QuestionInstanceUpdateManyWithoutLearningElementNestedInput
    course?: CourseUpdateOneRequiredWithoutLearningElementsNestedInput
  }

  export type LearningElementUncheckedUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    instances?: QuestionInstanceUncheckedUpdateManyWithoutLearningElementNestedInput
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type LearningElementUncheckedUpdateManyWithoutLearningElementsInput = {
    id?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type MicroSessionUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduledStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduledEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
    instances?: QuestionInstanceUpdateManyWithoutMicroSessionNestedInput
    course?: CourseUpdateOneRequiredWithoutMicroSessionsNestedInput
  }

  export type MicroSessionUncheckedUpdateWithoutOwnerInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduledStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduledEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
    instances?: QuestionInstanceUncheckedUpdateManyWithoutMicroSessionNestedInput
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type MicroSessionUncheckedUpdateManyWithoutMicroSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduledStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduledEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
    courseId?: StringFieldUpdateOperationsInput | string
  }

  export type AttachmentCreateManyQuestionInput = {
    id?: string
    name: string
    originalName: string
    description?: string | null
    type: AttachmentType
    ownerId: string
  }

  export type QuestionInstanceCreateManyQuestionInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlockId?: number | null
    learningElementId?: string | null
    microSessionId?: string | null
    ownerId: string
  }

  export type AttachmentUpdateWithoutQuestionInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    originalName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: EnumAttachmentTypeFieldUpdateOperationsInput | AttachmentType
    owner?: UserUpdateOneRequiredWithoutAttachmentsNestedInput
  }

  export type AttachmentUncheckedUpdateWithoutQuestionInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    originalName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    type?: EnumAttachmentTypeFieldUpdateOperationsInput | AttachmentType
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type TagUpdateWithoutQuestionsInput = {
    owner?: UserUpdateOneRequiredWithoutTagsNestedInput
  }

  export type TagUncheckedUpdateWithoutQuestionsInput = {
    id?: IntFieldUpdateOperationsInput | number
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type QuestionInstanceUpdateWithoutQuestionInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    sessionBlock?: SessionBlockUpdateOneWithoutInstancesNestedInput
    learningElement?: LearningElementUpdateOneWithoutInstancesNestedInput
    microSession?: MicroSessionUpdateOneWithoutInstancesNestedInput
    owner?: UserUpdateOneRequiredWithoutQuestionInstancesNestedInput
  }

  export type QuestionInstanceUncheckedUpdateWithoutQuestionInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    sessionBlockId?: NullableIntFieldUpdateOperationsInput | number | null
    learningElementId?: NullableStringFieldUpdateOperationsInput | string | null
    microSessionId?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type QuestionInstanceUncheckedUpdateManyWithoutInstancesInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    sessionBlockId?: NullableIntFieldUpdateOperationsInput | number | null
    learningElementId?: NullableStringFieldUpdateOperationsInput | string | null
    microSessionId?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type QuestionUpdateWithoutTagsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    contentPlain?: StringFieldUpdateOperationsInput | string
    options?: JsonNullValueInput | InputJsonValue
    type?: EnumQuestionTypeFieldUpdateOperationsInput | QuestionType
    attachments?: AttachmentUpdateManyWithoutQuestionNestedInput
    instances?: QuestionInstanceUpdateManyWithoutQuestionNestedInput
    owner?: UserUpdateOneRequiredWithoutQuestionsNestedInput
  }

  export type QuestionUncheckedUpdateWithoutTagsInput = {
    id?: StringFieldUpdateOperationsInput | string
    isArchived?: BoolFieldUpdateOperationsInput | boolean
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    name?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    contentPlain?: StringFieldUpdateOperationsInput | string
    options?: JsonNullValueInput | InputJsonValue
    type?: EnumQuestionTypeFieldUpdateOperationsInput | QuestionType
    attachments?: AttachmentUncheckedUpdateManyWithoutQuestionNestedInput
    instances?: QuestionInstanceUncheckedUpdateManyWithoutQuestionNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type SessionCreateManyCourseInput = {
    id?: string
    namespace?: string
    execution?: number
    name: string
    displayName: string
    settings: JsonNullValueInput | InputJsonValue
    startedAt: Date | string
    finishedAt: Date | string
    accessMode?: AccessMode
    status: SessionStatus
    ownerId: string
  }

  export type LearningElementCreateManyCourseInput = {
    id?: string
    ownerId: string
  }

  export type MicroSessionCreateManyCourseInput = {
    id?: string
    scheduledStartAt: Date | string
    scheduledEndAt: Date | string
    ownerId: string
  }

  export type SessionUpdateWithoutCourseInput = {
    id?: StringFieldUpdateOperationsInput | string
    namespace?: StringFieldUpdateOperationsInput | string
    execution?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accessMode?: EnumAccessModeFieldUpdateOperationsInput | AccessMode
    status?: EnumSessionStatusFieldUpdateOperationsInput | SessionStatus
    blocks?: SessionBlockUpdateManyWithoutSessionNestedInput
    owner?: UserUpdateOneRequiredWithoutSessionsNestedInput
  }

  export type SessionUncheckedUpdateWithoutCourseInput = {
    id?: StringFieldUpdateOperationsInput | string
    namespace?: StringFieldUpdateOperationsInput | string
    execution?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accessMode?: EnumAccessModeFieldUpdateOperationsInput | AccessMode
    status?: EnumSessionStatusFieldUpdateOperationsInput | SessionStatus
    blocks?: SessionBlockUncheckedUpdateManyWithoutSessionNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type LearningElementUpdateWithoutCourseInput = {
    id?: StringFieldUpdateOperationsInput | string
    instances?: QuestionInstanceUpdateManyWithoutLearningElementNestedInput
    owner?: UserUpdateOneRequiredWithoutLearningElementsNestedInput
  }

  export type LearningElementUncheckedUpdateWithoutCourseInput = {
    id?: StringFieldUpdateOperationsInput | string
    instances?: QuestionInstanceUncheckedUpdateManyWithoutLearningElementNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type MicroSessionUpdateWithoutCourseInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduledStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduledEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
    instances?: QuestionInstanceUpdateManyWithoutMicroSessionNestedInput
    owner?: UserUpdateOneRequiredWithoutMicroSessionsNestedInput
  }

  export type MicroSessionUncheckedUpdateWithoutCourseInput = {
    id?: StringFieldUpdateOperationsInput | string
    scheduledStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    scheduledEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
    instances?: QuestionInstanceUncheckedUpdateManyWithoutMicroSessionNestedInput
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type SessionBlockCreateManySessionInput = {
    id?: number
    expiresAt?: Date | string | null
    timeLimit?: number | null
    randomSelection?: number | null
  }

  export type SessionBlockUpdateWithoutSessionInput = {
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    timeLimit?: NullableIntFieldUpdateOperationsInput | number | null
    randomSelection?: NullableIntFieldUpdateOperationsInput | number | null
    instances?: QuestionInstanceUpdateManyWithoutSessionBlockNestedInput
  }

  export type SessionBlockUncheckedUpdateWithoutSessionInput = {
    id?: IntFieldUpdateOperationsInput | number
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    timeLimit?: NullableIntFieldUpdateOperationsInput | number | null
    randomSelection?: NullableIntFieldUpdateOperationsInput | number | null
    instances?: QuestionInstanceUncheckedUpdateManyWithoutSessionBlockNestedInput
  }

  export type SessionBlockUncheckedUpdateManyWithoutBlocksInput = {
    id?: IntFieldUpdateOperationsInput | number
    expiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    timeLimit?: NullableIntFieldUpdateOperationsInput | number | null
    randomSelection?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type QuestionInstanceCreateManySessionBlockInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    learningElementId?: string | null
    microSessionId?: string | null
    questionId: string
    ownerId: string
  }

  export type QuestionInstanceUpdateWithoutSessionBlockInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    learningElement?: LearningElementUpdateOneWithoutInstancesNestedInput
    microSession?: MicroSessionUpdateOneWithoutInstancesNestedInput
    question?: QuestionUpdateOneRequiredWithoutInstancesNestedInput
    owner?: UserUpdateOneRequiredWithoutQuestionInstancesNestedInput
  }

  export type QuestionInstanceUncheckedUpdateWithoutSessionBlockInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    learningElementId?: NullableStringFieldUpdateOperationsInput | string | null
    microSessionId?: NullableStringFieldUpdateOperationsInput | string | null
    questionId?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type QuestionInstanceCreateManyLearningElementInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlockId?: number | null
    microSessionId?: string | null
    questionId: string
    ownerId: string
  }

  export type QuestionInstanceUpdateWithoutLearningElementInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    sessionBlock?: SessionBlockUpdateOneWithoutInstancesNestedInput
    microSession?: MicroSessionUpdateOneWithoutInstancesNestedInput
    question?: QuestionUpdateOneRequiredWithoutInstancesNestedInput
    owner?: UserUpdateOneRequiredWithoutQuestionInstancesNestedInput
  }

  export type QuestionInstanceUncheckedUpdateWithoutLearningElementInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    sessionBlockId?: NullableIntFieldUpdateOperationsInput | number | null
    microSessionId?: NullableStringFieldUpdateOperationsInput | string | null
    questionId?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
  }

  export type QuestionInstanceCreateManyMicroSessionInput = {
    id?: string
    questionData: JsonNullValueInput | InputJsonValue
    results: JsonNullValueInput | InputJsonValue
    sessionBlockId?: number | null
    learningElementId?: string | null
    questionId: string
    ownerId: string
  }

  export type QuestionInstanceUpdateWithoutMicroSessionInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    sessionBlock?: SessionBlockUpdateOneWithoutInstancesNestedInput
    learningElement?: LearningElementUpdateOneWithoutInstancesNestedInput
    question?: QuestionUpdateOneRequiredWithoutInstancesNestedInput
    owner?: UserUpdateOneRequiredWithoutQuestionInstancesNestedInput
  }

  export type QuestionInstanceUncheckedUpdateWithoutMicroSessionInput = {
    id?: StringFieldUpdateOperationsInput | string
    questionData?: JsonNullValueInput | InputJsonValue
    results?: JsonNullValueInput | InputJsonValue
    sessionBlockId?: NullableIntFieldUpdateOperationsInput | number | null
    learningElementId?: NullableStringFieldUpdateOperationsInput | string | null
    questionId?: StringFieldUpdateOperationsInput | string
    ownerId?: StringFieldUpdateOperationsInput | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}