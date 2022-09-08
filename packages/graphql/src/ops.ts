import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  /** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
  DateTime: any;
  /** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSONObject: any;
};

export type BlockInput = {
  questionIds: Array<Scalars['Int']>;
  randomSelection?: InputMaybe<Scalars['Int']>;
  timeLimit?: InputMaybe<Scalars['Int']>;
};

export type Choice = {
  __typename?: 'Choice';
  correct?: Maybe<Scalars['Boolean']>;
  feedback?: Maybe<Scalars['String']>;
  value: Scalars['String'];
};

export type ChoicesQuestionData = QuestionData & {
  __typename?: 'ChoicesQuestionData';
  content: Scalars['String'];
  contentPlain: Scalars['String'];
  id: Scalars['Int'];
  isArchived: Scalars['Boolean'];
  isDeleted: Scalars['Boolean'];
  name: Scalars['String'];
  options: ChoicesQuestionOptions;
  type: Scalars['String'];
};

export type ChoicesQuestionOptions = {
  __typename?: 'ChoicesQuestionOptions';
  choices: Array<Choice>;
};

export type Course = {
  __typename?: 'Course';
  displayName: Scalars['String'];
  id: Scalars['ID'];
  learningElements: Array<LearningElement>;
  microSessions: Array<MicroSession>;
  name: Scalars['String'];
  sessions: Array<Session>;
};

export type FreeTextQuestionData = QuestionData & {
  __typename?: 'FreeTextQuestionData';
  content: Scalars['String'];
  contentPlain: Scalars['String'];
  id: Scalars['Int'];
  isArchived: Scalars['Boolean'];
  isDeleted: Scalars['Boolean'];
  name: Scalars['String'];
  options: FreeTextQuestionOptions;
  type: Scalars['String'];
};

export type FreeTextQuestionOptions = {
  __typename?: 'FreeTextQuestionOptions';
  restrictions?: Maybe<FreeTextRestrictions>;
  solutions?: Maybe<Array<Scalars['String']>>;
};

export type FreeTextRestrictions = {
  __typename?: 'FreeTextRestrictions';
  maxLength?: Maybe<Scalars['Int']>;
};

export type InstanceEvaluation = {
  __typename?: 'InstanceEvaluation';
  choices: Scalars['JSONObject'];
  feedbacks?: Maybe<Array<QuestionFeedback>>;
};

export type LearningElement = {
  __typename?: 'LearningElement';
  course: Course;
  id: Scalars['ID'];
  instances: Array<QuestionInstance>;
};

export type MicroSession = {
  __typename?: 'MicroSession';
  displayName: Scalars['String'];
  id: Scalars['ID'];
  name: Scalars['String'];
};

export type Mutation = {
  __typename?: 'Mutation';
  activateSessionBlock?: Maybe<Session>;
  createSession?: Maybe<Session>;
  deactivateSessionBlock?: Maybe<Session>;
  joinCourse?: Maybe<Participation>;
  leaveCourse?: Maybe<Participation>;
  loginParticipant?: Maybe<Scalars['ID']>;
  loginUser?: Maybe<Scalars['ID']>;
  registerParticipantFromLTI?: Maybe<ParticipantLearningData>;
  respondToQuestionInstance?: Maybe<QuestionInstance>;
  startSession?: Maybe<Session>;
};


export type MutationActivateSessionBlockArgs = {
  sessionBlockId: Scalars['Int'];
  sessionId: Scalars['ID'];
};


export type MutationCreateSessionArgs = {
  blocks: Array<BlockInput>;
  displayName?: InputMaybe<Scalars['String']>;
  name: Scalars['String'];
};


export type MutationDeactivateSessionBlockArgs = {
  sessionBlockId: Scalars['Int'];
  sessionId: Scalars['ID'];
};


export type MutationJoinCourseArgs = {
  courseId: Scalars['ID'];
};


export type MutationLeaveCourseArgs = {
  courseId: Scalars['ID'];
};


export type MutationLoginParticipantArgs = {
  password: Scalars['String'];
  username: Scalars['String'];
};


export type MutationLoginUserArgs = {
  email: Scalars['String'];
  password: Scalars['String'];
};


export type MutationRegisterParticipantFromLtiArgs = {
  courseId: Scalars['ID'];
  participantEmail: Scalars['String'];
  participantId: Scalars['ID'];
};


export type MutationRespondToQuestionInstanceArgs = {
  courseId: Scalars['ID'];
  id: Scalars['Int'];
  response: ResponseInput;
};


export type MutationStartSessionArgs = {
  id: Scalars['ID'];
};

export type NumericalQuestionData = QuestionData & {
  __typename?: 'NumericalQuestionData';
  content: Scalars['String'];
  contentPlain: Scalars['String'];
  id: Scalars['Int'];
  isArchived: Scalars['Boolean'];
  isDeleted: Scalars['Boolean'];
  name: Scalars['String'];
  options: NumericalQuestionOptions;
  type: Scalars['String'];
};

export type NumericalQuestionOptions = {
  __typename?: 'NumericalQuestionOptions';
  restrictions?: Maybe<NumericalRestrictions>;
  solutionRanges?: Maybe<Array<NumericalSolutionRange>>;
};

export type NumericalRestrictions = {
  __typename?: 'NumericalRestrictions';
  max?: Maybe<Scalars['Int']>;
  min?: Maybe<Scalars['Int']>;
};

export type NumericalSolutionRange = {
  __typename?: 'NumericalSolutionRange';
  max?: Maybe<Scalars['Float']>;
  min?: Maybe<Scalars['Float']>;
};

export type Participant = {
  __typename?: 'Participant';
  avatar: Scalars['String'];
  id: Scalars['ID'];
  username: Scalars['String'];
};

export type ParticipantLearningData = {
  __typename?: 'ParticipantLearningData';
  course: Course;
  id: Scalars['ID'];
  participant: Participant;
  participantToken: Scalars['String'];
  participation: Participation;
};

export type Participation = {
  __typename?: 'Participation';
  course: Course;
  id: Scalars['Int'];
  isActive: Scalars['Boolean'];
  points: Scalars['Int'];
};

export type Query = {
  __typename?: 'Query';
  getCourseOverviewData?: Maybe<ParticipantLearningData>;
  learningElement?: Maybe<LearningElement>;
  participations?: Maybe<Array<Participation>>;
  self?: Maybe<Participant>;
  session?: Maybe<Session>;
};


export type QueryGetCourseOverviewDataArgs = {
  courseId: Scalars['ID'];
};


export type QueryLearningElementArgs = {
  id: Scalars['ID'];
};


export type QuerySessionArgs = {
  id: Scalars['ID'];
};

export type QuestionData = {
  content: Scalars['String'];
  contentPlain: Scalars['String'];
  id: Scalars['Int'];
  isArchived: Scalars['Boolean'];
  isDeleted: Scalars['Boolean'];
  name: Scalars['String'];
  type: Scalars['String'];
};

export type QuestionFeedback = {
  __typename?: 'QuestionFeedback';
  correct: Scalars['Boolean'];
  feedback: Scalars['String'];
  ix: Scalars['Int'];
  value: Scalars['String'];
};

export type QuestionInstance = {
  __typename?: 'QuestionInstance';
  evaluation?: Maybe<InstanceEvaluation>;
  id: Scalars['Int'];
  questionData: QuestionData;
};

export type ResponseInput = {
  choices?: InputMaybe<Array<Scalars['Int']>>;
  value?: InputMaybe<Scalars['String']>;
};

export type Session = {
  __typename?: 'Session';
  activeBlock?: Maybe<SessionBlock>;
  blocks: Array<SessionBlock>;
  displayName: Scalars['String'];
  id: Scalars['ID'];
  isAudienceInteractionActive: Scalars['Boolean'];
  isFeedbackChannelPublic: Scalars['Boolean'];
  isGamificationEnabled: Scalars['Boolean'];
  name: Scalars['String'];
  namespace: Scalars['String'];
  status: SessionStatus;
};

export type SessionBlock = {
  __typename?: 'SessionBlock';
  execution: Scalars['Int'];
  expiresAt?: Maybe<Scalars['DateTime']>;
  id: Scalars['Int'];
  instances: Array<QuestionInstance>;
  randomSelection?: Maybe<Scalars['Boolean']>;
  status: SessionBlockStatus;
  timeLimit?: Maybe<Scalars['Int']>;
};

export enum SessionBlockStatus {
  Active = 'ACTIVE',
  Executed = 'EXECUTED',
  Scheduled = 'SCHEDULED'
}

export enum SessionStatus {
  Completed = 'COMPLETED',
  Prepared = 'PREPARED',
  Running = 'RUNNING',
  Scheduled = 'SCHEDULED'
}

export type QuestionDataFragment = { __typename?: 'QuestionInstance', questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'ChoicesQuestionOptions', choices: Array<{ __typename?: 'Choice', correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'FreeTextQuestionOptions', solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'NumericalQuestionOptions', restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } };

export type JoinCourseMutationVariables = Exact<{
  courseId: Scalars['ID'];
}>;


export type JoinCourseMutation = { __typename?: 'Mutation', joinCourse?: { __typename?: 'Participation', id: number, isActive: boolean, points: number } | null };

export type LeaveCourseMutationVariables = Exact<{
  courseId: Scalars['ID'];
}>;


export type LeaveCourseMutation = { __typename?: 'Mutation', leaveCourse?: { __typename?: 'Participation', id: number, isActive: boolean, points: number } | null };

export type LoginParticipantMutationVariables = Exact<{
  username: Scalars['String'];
  password: Scalars['String'];
}>;


export type LoginParticipantMutation = { __typename?: 'Mutation', loginParticipant?: string | null };

export type RegisterParticipantFromLtiMutationVariables = Exact<{
  courseId: Scalars['ID'];
  participantId: Scalars['ID'];
  participantEmail: Scalars['String'];
}>;


export type RegisterParticipantFromLtiMutation = { __typename?: 'Mutation', registerParticipantFromLTI?: { __typename?: 'ParticipantLearningData', id: string, participantToken: string, participant: { __typename?: 'Participant', id: string, avatar: string, username: string }, participation: { __typename?: 'Participation', id: number, isActive: boolean, points: number }, course: { __typename?: 'Course', id: string, name: string, displayName: string } } | null };

export type ResponseToQuestionInstanceMutationVariables = Exact<{
  courseId: Scalars['ID'];
  id: Scalars['Int'];
  response: ResponseInput;
}>;


export type ResponseToQuestionInstanceMutation = { __typename?: 'Mutation', respondToQuestionInstance?: { __typename?: 'QuestionInstance', id: number, evaluation?: { __typename?: 'InstanceEvaluation', choices: any, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback: string, correct: boolean, value: string }> | null } | null, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'ChoicesQuestionOptions', choices: Array<{ __typename?: 'Choice', correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'FreeTextQuestionOptions', solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'NumericalQuestionOptions', restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } } | null };

export type GetCourseOverviewDataQueryVariables = Exact<{
  courseId: Scalars['ID'];
}>;


export type GetCourseOverviewDataQuery = { __typename?: 'Query', getCourseOverviewData?: { __typename?: 'ParticipantLearningData', id: string, participant: { __typename?: 'Participant', id: string, avatar: string, username: string }, participation: { __typename?: 'Participation', id: number, isActive: boolean, points: number }, course: { __typename?: 'Course', id: string, name: string, displayName: string } } | null };

export type GetLearningElementQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetLearningElementQuery = { __typename?: 'Query', learningElement?: { __typename?: 'LearningElement', id: string, course: { __typename?: 'Course', id: string }, instances: Array<{ __typename?: 'QuestionInstance', id: number, evaluation?: { __typename?: 'InstanceEvaluation', choices: any, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback: string, correct: boolean, value: string }> | null } | null, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'ChoicesQuestionOptions', choices: Array<{ __typename?: 'Choice', correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'FreeTextQuestionOptions', solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'NumericalQuestionOptions', restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } }> } | null };

export type GetSessionQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetSessionQuery = { __typename?: 'Query', session?: { __typename?: 'Session', id: string, isAudienceInteractionActive: boolean, isFeedbackChannelPublic: boolean, isGamificationEnabled: boolean, namespace: string, name: string, displayName: string, status: SessionStatus, activeBlock?: { __typename?: 'SessionBlock', id: number, status: SessionBlockStatus, expiresAt?: any | null, timeLimit?: number | null, randomSelection?: boolean | null, execution: number, instances: Array<{ __typename?: 'QuestionInstance', id: number, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'ChoicesQuestionOptions', choices: Array<{ __typename?: 'Choice', correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'FreeTextQuestionOptions', solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'NumericalQuestionOptions', restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } }> } | null } | null };

export type ParticipationsQueryVariables = Exact<{ [key: string]: never; }>;


export type ParticipationsQuery = { __typename?: 'Query', participations?: Array<{ __typename?: 'Participation', id: number, points: number, course: { __typename?: 'Course', id: string, displayName: string, microSessions: Array<{ __typename?: 'MicroSession', id: string, displayName: string }>, sessions: Array<{ __typename?: 'Session', id: string, displayName: string }> } }> | null };

export type SelfQueryVariables = Exact<{ [key: string]: never; }>;


export type SelfQuery = { __typename?: 'Query', self?: { __typename?: 'Participant', id: string, username: string, avatar: string } | null };



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  BlockInput: BlockInput;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  Choice: ResolverTypeWrapper<Choice>;
  ChoicesQuestionData: ResolverTypeWrapper<ChoicesQuestionData>;
  ChoicesQuestionOptions: ResolverTypeWrapper<ChoicesQuestionOptions>;
  Course: ResolverTypeWrapper<Course>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']>;
  Float: ResolverTypeWrapper<Scalars['Float']>;
  FreeTextQuestionData: ResolverTypeWrapper<FreeTextQuestionData>;
  FreeTextQuestionOptions: ResolverTypeWrapper<FreeTextQuestionOptions>;
  FreeTextRestrictions: ResolverTypeWrapper<FreeTextRestrictions>;
  ID: ResolverTypeWrapper<Scalars['ID']>;
  InstanceEvaluation: ResolverTypeWrapper<InstanceEvaluation>;
  Int: ResolverTypeWrapper<Scalars['Int']>;
  JSONObject: ResolverTypeWrapper<Scalars['JSONObject']>;
  LearningElement: ResolverTypeWrapper<LearningElement>;
  MicroSession: ResolverTypeWrapper<MicroSession>;
  Mutation: ResolverTypeWrapper<{}>;
  NumericalQuestionData: ResolverTypeWrapper<NumericalQuestionData>;
  NumericalQuestionOptions: ResolverTypeWrapper<NumericalQuestionOptions>;
  NumericalRestrictions: ResolverTypeWrapper<NumericalRestrictions>;
  NumericalSolutionRange: ResolverTypeWrapper<NumericalSolutionRange>;
  Participant: ResolverTypeWrapper<Participant>;
  ParticipantLearningData: ResolverTypeWrapper<ParticipantLearningData>;
  Participation: ResolverTypeWrapper<Participation>;
  Query: ResolverTypeWrapper<{}>;
  QuestionData: ResolversTypes['ChoicesQuestionData'] | ResolversTypes['FreeTextQuestionData'] | ResolversTypes['NumericalQuestionData'];
  QuestionFeedback: ResolverTypeWrapper<QuestionFeedback>;
  QuestionInstance: ResolverTypeWrapper<QuestionInstance>;
  ResponseInput: ResponseInput;
  Session: ResolverTypeWrapper<Session>;
  SessionBlock: ResolverTypeWrapper<SessionBlock>;
  SessionBlockStatus: SessionBlockStatus;
  SessionStatus: SessionStatus;
  String: ResolverTypeWrapper<Scalars['String']>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  BlockInput: BlockInput;
  Boolean: Scalars['Boolean'];
  Choice: Choice;
  ChoicesQuestionData: ChoicesQuestionData;
  ChoicesQuestionOptions: ChoicesQuestionOptions;
  Course: Course;
  DateTime: Scalars['DateTime'];
  Float: Scalars['Float'];
  FreeTextQuestionData: FreeTextQuestionData;
  FreeTextQuestionOptions: FreeTextQuestionOptions;
  FreeTextRestrictions: FreeTextRestrictions;
  ID: Scalars['ID'];
  InstanceEvaluation: InstanceEvaluation;
  Int: Scalars['Int'];
  JSONObject: Scalars['JSONObject'];
  LearningElement: LearningElement;
  MicroSession: MicroSession;
  Mutation: {};
  NumericalQuestionData: NumericalQuestionData;
  NumericalQuestionOptions: NumericalQuestionOptions;
  NumericalRestrictions: NumericalRestrictions;
  NumericalSolutionRange: NumericalSolutionRange;
  Participant: Participant;
  ParticipantLearningData: ParticipantLearningData;
  Participation: Participation;
  Query: {};
  QuestionData: ResolversParentTypes['ChoicesQuestionData'] | ResolversParentTypes['FreeTextQuestionData'] | ResolversParentTypes['NumericalQuestionData'];
  QuestionFeedback: QuestionFeedback;
  QuestionInstance: QuestionInstance;
  ResponseInput: ResponseInput;
  Session: Session;
  SessionBlock: SessionBlock;
  String: Scalars['String'];
};

export type ChoiceResolvers<ContextType = any, ParentType extends ResolversParentTypes['Choice'] = ResolversParentTypes['Choice']> = {
  correct?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  feedback?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  value?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ChoicesQuestionDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['ChoicesQuestionData'] = ResolversParentTypes['ChoicesQuestionData']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  contentPlain?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isArchived?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  options?: Resolver<ResolversTypes['ChoicesQuestionOptions'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ChoicesQuestionOptionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['ChoicesQuestionOptions'] = ResolversParentTypes['ChoicesQuestionOptions']> = {
  choices?: Resolver<Array<ResolversTypes['Choice']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CourseResolvers<ContextType = any, ParentType extends ResolversParentTypes['Course'] = ResolversParentTypes['Course']> = {
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  learningElements?: Resolver<Array<ResolversTypes['LearningElement']>, ParentType, ContextType>;
  microSessions?: Resolver<Array<ResolversTypes['MicroSession']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sessions?: Resolver<Array<ResolversTypes['Session']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type FreeTextQuestionDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['FreeTextQuestionData'] = ResolversParentTypes['FreeTextQuestionData']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  contentPlain?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isArchived?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  options?: Resolver<ResolversTypes['FreeTextQuestionOptions'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FreeTextQuestionOptionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['FreeTextQuestionOptions'] = ResolversParentTypes['FreeTextQuestionOptions']> = {
  restrictions?: Resolver<Maybe<ResolversTypes['FreeTextRestrictions']>, ParentType, ContextType>;
  solutions?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FreeTextRestrictionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['FreeTextRestrictions'] = ResolversParentTypes['FreeTextRestrictions']> = {
  maxLength?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type InstanceEvaluationResolvers<ContextType = any, ParentType extends ResolversParentTypes['InstanceEvaluation'] = ResolversParentTypes['InstanceEvaluation']> = {
  choices?: Resolver<ResolversTypes['JSONObject'], ParentType, ContextType>;
  feedbacks?: Resolver<Maybe<Array<ResolversTypes['QuestionFeedback']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface JsonObjectScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSONObject'], any> {
  name: 'JSONObject';
}

export type LearningElementResolvers<ContextType = any, ParentType extends ResolversParentTypes['LearningElement'] = ResolversParentTypes['LearningElement']> = {
  course?: Resolver<ResolversTypes['Course'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  instances?: Resolver<Array<ResolversTypes['QuestionInstance']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MicroSessionResolvers<ContextType = any, ParentType extends ResolversParentTypes['MicroSession'] = ResolversParentTypes['MicroSession']> = {
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  activateSessionBlock?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationActivateSessionBlockArgs, 'sessionBlockId' | 'sessionId'>>;
  createSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationCreateSessionArgs, 'blocks' | 'name'>>;
  deactivateSessionBlock?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationDeactivateSessionBlockArgs, 'sessionBlockId' | 'sessionId'>>;
  joinCourse?: Resolver<Maybe<ResolversTypes['Participation']>, ParentType, ContextType, RequireFields<MutationJoinCourseArgs, 'courseId'>>;
  leaveCourse?: Resolver<Maybe<ResolversTypes['Participation']>, ParentType, ContextType, RequireFields<MutationLeaveCourseArgs, 'courseId'>>;
  loginParticipant?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType, RequireFields<MutationLoginParticipantArgs, 'password' | 'username'>>;
  loginUser?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType, RequireFields<MutationLoginUserArgs, 'email' | 'password'>>;
  registerParticipantFromLTI?: Resolver<Maybe<ResolversTypes['ParticipantLearningData']>, ParentType, ContextType, RequireFields<MutationRegisterParticipantFromLtiArgs, 'courseId' | 'participantEmail' | 'participantId'>>;
  respondToQuestionInstance?: Resolver<Maybe<ResolversTypes['QuestionInstance']>, ParentType, ContextType, RequireFields<MutationRespondToQuestionInstanceArgs, 'courseId' | 'id' | 'response'>>;
  startSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationStartSessionArgs, 'id'>>;
};

export type NumericalQuestionDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['NumericalQuestionData'] = ResolversParentTypes['NumericalQuestionData']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  contentPlain?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isArchived?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  options?: Resolver<ResolversTypes['NumericalQuestionOptions'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type NumericalQuestionOptionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['NumericalQuestionOptions'] = ResolversParentTypes['NumericalQuestionOptions']> = {
  restrictions?: Resolver<Maybe<ResolversTypes['NumericalRestrictions']>, ParentType, ContextType>;
  solutionRanges?: Resolver<Maybe<Array<ResolversTypes['NumericalSolutionRange']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type NumericalRestrictionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['NumericalRestrictions'] = ResolversParentTypes['NumericalRestrictions']> = {
  max?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  min?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type NumericalSolutionRangeResolvers<ContextType = any, ParentType extends ResolversParentTypes['NumericalSolutionRange'] = ResolversParentTypes['NumericalSolutionRange']> = {
  max?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  min?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipantResolvers<ContextType = any, ParentType extends ResolversParentTypes['Participant'] = ResolversParentTypes['Participant']> = {
  avatar?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipantLearningDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['ParticipantLearningData'] = ResolversParentTypes['ParticipantLearningData']> = {
  course?: Resolver<ResolversTypes['Course'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  participant?: Resolver<ResolversTypes['Participant'], ParentType, ContextType>;
  participantToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  participation?: Resolver<ResolversTypes['Participation'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Participation'] = ResolversParentTypes['Participation']> = {
  course?: Resolver<ResolversTypes['Course'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  points?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  getCourseOverviewData?: Resolver<Maybe<ResolversTypes['ParticipantLearningData']>, ParentType, ContextType, RequireFields<QueryGetCourseOverviewDataArgs, 'courseId'>>;
  learningElement?: Resolver<Maybe<ResolversTypes['LearningElement']>, ParentType, ContextType, RequireFields<QueryLearningElementArgs, 'id'>>;
  participations?: Resolver<Maybe<Array<ResolversTypes['Participation']>>, ParentType, ContextType>;
  self?: Resolver<Maybe<ResolversTypes['Participant']>, ParentType, ContextType>;
  session?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<QuerySessionArgs, 'id'>>;
};

export type QuestionDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuestionData'] = ResolversParentTypes['QuestionData']> = {
  __resolveType: TypeResolveFn<'ChoicesQuestionData' | 'FreeTextQuestionData' | 'NumericalQuestionData', ParentType, ContextType>;
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  contentPlain?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isArchived?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type QuestionFeedbackResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuestionFeedback'] = ResolversParentTypes['QuestionFeedback']> = {
  correct?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  feedback?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ix?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QuestionInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuestionInstance'] = ResolversParentTypes['QuestionInstance']> = {
  evaluation?: Resolver<Maybe<ResolversTypes['InstanceEvaluation']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  questionData?: Resolver<ResolversTypes['QuestionData'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SessionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Session'] = ResolversParentTypes['Session']> = {
  activeBlock?: Resolver<Maybe<ResolversTypes['SessionBlock']>, ParentType, ContextType>;
  blocks?: Resolver<Array<ResolversTypes['SessionBlock']>, ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isAudienceInteractionActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isFeedbackChannelPublic?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isGamificationEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  namespace?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SessionBlockResolvers<ContextType = any, ParentType extends ResolversParentTypes['SessionBlock'] = ResolversParentTypes['SessionBlock']> = {
  execution?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  expiresAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  instances?: Resolver<Array<ResolversTypes['QuestionInstance']>, ParentType, ContextType>;
  randomSelection?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionBlockStatus'], ParentType, ContextType>;
  timeLimit?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  Choice?: ChoiceResolvers<ContextType>;
  ChoicesQuestionData?: ChoicesQuestionDataResolvers<ContextType>;
  ChoicesQuestionOptions?: ChoicesQuestionOptionsResolvers<ContextType>;
  Course?: CourseResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  FreeTextQuestionData?: FreeTextQuestionDataResolvers<ContextType>;
  FreeTextQuestionOptions?: FreeTextQuestionOptionsResolvers<ContextType>;
  FreeTextRestrictions?: FreeTextRestrictionsResolvers<ContextType>;
  InstanceEvaluation?: InstanceEvaluationResolvers<ContextType>;
  JSONObject?: GraphQLScalarType;
  LearningElement?: LearningElementResolvers<ContextType>;
  MicroSession?: MicroSessionResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  NumericalQuestionData?: NumericalQuestionDataResolvers<ContextType>;
  NumericalQuestionOptions?: NumericalQuestionOptionsResolvers<ContextType>;
  NumericalRestrictions?: NumericalRestrictionsResolvers<ContextType>;
  NumericalSolutionRange?: NumericalSolutionRangeResolvers<ContextType>;
  Participant?: ParticipantResolvers<ContextType>;
  ParticipantLearningData?: ParticipantLearningDataResolvers<ContextType>;
  Participation?: ParticipationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  QuestionData?: QuestionDataResolvers<ContextType>;
  QuestionFeedback?: QuestionFeedbackResolvers<ContextType>;
  QuestionInstance?: QuestionInstanceResolvers<ContextType>;
  Session?: SessionResolvers<ContextType>;
  SessionBlock?: SessionBlockResolvers<ContextType>;
};


export const QuestionDataFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"contentPlain"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}}]}}]}}]} as unknown as DocumentNode<QuestionDataFragment, unknown>;
export const JoinCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}}]}}]} as unknown as DocumentNode<JoinCourseMutation, JoinCourseMutationVariables>;
export const LeaveCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}}]}}]} as unknown as DocumentNode<LeaveCourseMutation, LeaveCourseMutationVariables>;
export const LoginParticipantDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginParticipant"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginParticipant"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}]}}]} as unknown as DocumentNode<LoginParticipantMutation, LoginParticipantMutationVariables>;
export const RegisterParticipantFromLtiDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegisterParticipantFromLTI"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"participantId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"participantEmail"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registerParticipantFromLTI"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"participantId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"participantId"}}},{"kind":"Argument","name":{"kind":"Name","value":"participantEmail"},"value":{"kind":"Variable","name":{"kind":"Name","value":"participantEmail"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participantToken"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<RegisterParticipantFromLtiMutation, RegisterParticipantFromLtiMutationVariables>;
export const ResponseToQuestionInstanceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResponseToQuestionInstance"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"response"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ResponseInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"respondToQuestionInstance"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"response"},"value":{"kind":"Variable","name":{"kind":"Name","value":"response"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionData"}},{"kind":"Field","name":{"kind":"Name","value":"evaluation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choices"}}]}}]}}]}},...QuestionDataFragmentDoc.definitions]} as unknown as DocumentNode<ResponseToQuestionInstanceMutation, ResponseToQuestionInstanceMutationVariables>;
export const GetCourseOverviewDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCourseOverviewData"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getCourseOverviewData"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<GetCourseOverviewDataQuery, GetCourseOverviewDataQueryVariables>;
export const GetLearningElementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetLearningElement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"learningElement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionData"}},{"kind":"Field","name":{"kind":"Name","value":"evaluation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choices"}}]}}]}}]}}]}},...QuestionDataFragmentDoc.definitions]} as unknown as DocumentNode<GetLearningElementQuery, GetLearningElementQueryVariables>;
export const GetSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"session"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isAudienceInteractionActive"}},{"kind":"Field","name":{"kind":"Name","value":"isFeedbackChannelPublic"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"namespace"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"activeBlock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"randomSelection"}},{"kind":"Field","name":{"kind":"Name","value":"execution"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionData"}}]}}]}}]}}]}},...QuestionDataFragmentDoc.definitions]} as unknown as DocumentNode<GetSessionQuery, GetSessionQueryVariables>;
export const ParticipationsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Participations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"microSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ParticipationsQuery, ParticipationsQueryVariables>;
export const SelfDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Self"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"self"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]} as unknown as DocumentNode<SelfQuery, SelfQueryVariables>;

      export interface PossibleTypesResultData {
        possibleTypes: {
          [key: string]: string[]
        }
      }
      const result: PossibleTypesResultData = {
  "possibleTypes": {
    "QuestionData": [
      "ChoicesQuestionData",
      "FreeTextQuestionData",
      "NumericalQuestionData"
    ]
  }
};
      export default result;
    