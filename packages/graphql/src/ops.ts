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

export type Course = {
  __typename?: 'Course';
  id?: Maybe<Scalars['ID']>;
  learningElements?: Maybe<Array<Maybe<LearningElement>>>;
};

export type LearningElement = {
  __typename?: 'LearningElement';
  course?: Maybe<Course>;
  id?: Maybe<Scalars['ID']>;
  instances?: Maybe<Array<Maybe<QuestionInstance>>>;
};

export type Mutation = {
  __typename?: 'Mutation';
  login: Scalars['ID'];
  registerParticipantFromLTI?: Maybe<ParticipantLearningData>;
};


export type MutationLoginArgs = {
  email: Scalars['String'];
  password: Scalars['String'];
};


export type MutationRegisterParticipantFromLtiArgs = {
  courseId: Scalars['ID'];
  participantEmail: Scalars['ID'];
  participantId: Scalars['ID'];
};

export type Participant = {
  __typename?: 'Participant';
  id?: Maybe<Scalars['ID']>;
};

export type ParticipantLearningData = {
  __typename?: 'ParticipantLearningData';
  course?: Maybe<Course>;
  participant: Participant;
  participantToken: Scalars['String'];
  participation?: Maybe<Participation>;
};

export type Participation = {
  __typename?: 'Participation';
  id?: Maybe<Scalars['ID']>;
};

export type Query = {
  __typename?: 'Query';
  learningElement?: Maybe<LearningElement>;
};


export type QueryLearningElementArgs = {
  id: Scalars['ID'];
};

export type QuestionInstance = {
  __typename?: 'QuestionInstance';
  id?: Maybe<Scalars['ID']>;
  questionData?: Maybe<Scalars['JSONObject']>;
};

export type RegisterParticipantFromLtiMutationVariables = Exact<{
  courseId: Scalars['ID'];
  participantId: Scalars['ID'];
  participantEmail: Scalars['ID'];
}>;


export type RegisterParticipantFromLtiMutation = { __typename?: 'Mutation', registerParticipantFromLTI?: { __typename?: 'ParticipantLearningData', participantToken: string, participant: { __typename?: 'Participant', id?: string | null }, participation?: { __typename?: 'Participation', id?: string | null } | null, course?: { __typename?: 'Course', id?: string | null } | null } | null };

export type GetLearningElementQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetLearningElementQuery = { __typename?: 'Query', learningElement?: { __typename?: 'LearningElement', id?: string | null, course?: { __typename?: 'Course', id?: string | null } | null, instances?: Array<{ __typename?: 'QuestionInstance', id?: string | null, questionData?: any | null } | null> | null } | null };



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
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  Course: ResolverTypeWrapper<Course>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']>;
  ID: ResolverTypeWrapper<Scalars['ID']>;
  JSONObject: ResolverTypeWrapper<Scalars['JSONObject']>;
  LearningElement: ResolverTypeWrapper<LearningElement>;
  Mutation: ResolverTypeWrapper<{}>;
  Participant: ResolverTypeWrapper<Participant>;
  ParticipantLearningData: ResolverTypeWrapper<ParticipantLearningData>;
  Participation: ResolverTypeWrapper<Participation>;
  Query: ResolverTypeWrapper<{}>;
  QuestionInstance: ResolverTypeWrapper<QuestionInstance>;
  String: ResolverTypeWrapper<Scalars['String']>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Scalars['Boolean'];
  Course: Course;
  DateTime: Scalars['DateTime'];
  ID: Scalars['ID'];
  JSONObject: Scalars['JSONObject'];
  LearningElement: LearningElement;
  Mutation: {};
  Participant: Participant;
  ParticipantLearningData: ParticipantLearningData;
  Participation: Participation;
  Query: {};
  QuestionInstance: QuestionInstance;
  String: Scalars['String'];
};

export type CourseResolvers<ContextType = any, ParentType extends ResolversParentTypes['Course'] = ResolversParentTypes['Course']> = {
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  learningElements?: Resolver<Maybe<Array<Maybe<ResolversTypes['LearningElement']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export interface JsonObjectScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSONObject'], any> {
  name: 'JSONObject';
}

export type LearningElementResolvers<ContextType = any, ParentType extends ResolversParentTypes['LearningElement'] = ResolversParentTypes['LearningElement']> = {
  course?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  instances?: Resolver<Maybe<Array<Maybe<ResolversTypes['QuestionInstance']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  login?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationLoginArgs, 'email' | 'password'>>;
  registerParticipantFromLTI?: Resolver<Maybe<ResolversTypes['ParticipantLearningData']>, ParentType, ContextType, RequireFields<MutationRegisterParticipantFromLtiArgs, 'courseId' | 'participantEmail' | 'participantId'>>;
};

export type ParticipantResolvers<ContextType = any, ParentType extends ResolversParentTypes['Participant'] = ResolversParentTypes['Participant']> = {
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipantLearningDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['ParticipantLearningData'] = ResolversParentTypes['ParticipantLearningData']> = {
  course?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType>;
  participant?: Resolver<ResolversTypes['Participant'], ParentType, ContextType>;
  participantToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  participation?: Resolver<Maybe<ResolversTypes['Participation']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Participation'] = ResolversParentTypes['Participation']> = {
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  learningElement?: Resolver<Maybe<ResolversTypes['LearningElement']>, ParentType, ContextType, RequireFields<QueryLearningElementArgs, 'id'>>;
};

export type QuestionInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuestionInstance'] = ResolversParentTypes['QuestionInstance']> = {
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  questionData?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  Course?: CourseResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  JSONObject?: GraphQLScalarType;
  LearningElement?: LearningElementResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Participant?: ParticipantResolvers<ContextType>;
  ParticipantLearningData?: ParticipantLearningDataResolvers<ContextType>;
  Participation?: ParticipationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  QuestionInstance?: QuestionInstanceResolvers<ContextType>;
};



export const RegisterParticipantFromLtiDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegisterParticipantFromLTI"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"participantId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"participantEmail"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registerParticipantFromLTI"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"participantId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"participantId"}}},{"kind":"Argument","name":{"kind":"Name","value":"participantEmail"},"value":{"kind":"Variable","name":{"kind":"Name","value":"participantEmail"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participantToken"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<RegisterParticipantFromLtiMutation, RegisterParticipantFromLtiMutationVariables>;
export const GetLearningElementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetLearningElement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"learningElement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"}}]}}]}}]}}]} as unknown as DocumentNode<GetLearningElementQuery, GetLearningElementQueryVariables>;

      export interface PossibleTypesResultData {
        possibleTypes: {
          [key: string]: string[]
        }
      }
      const result: PossibleTypesResultData = {
  "possibleTypes": {}
};
      export default result;
    