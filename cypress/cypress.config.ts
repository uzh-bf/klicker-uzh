import { ElementType, PermissionLevel, PrismaClient } from '@klicker-uzh/prisma'
import {
  CaseStudyCaseCriterionSolution,
  CaseStudyCaseSolution,
  ElementOptionsCaseStudy,
  ElementOptionsChoices,
  ElementOptionsContent,
  ElementOptionsFlashcard,
  ElementOptionsFreeText,
  ElementOptionsNumerical,
  ElementOptionsSelection,
} from '@klicker-uzh/types'
import { defineConfig } from 'cypress'

// ! Copy of seeded user ids from prisma/seedUsers.ts
const USER_ID_TEST = '76047345-3801-4628-ae7b-adbebcfe8821'
const USER_ID_TEST2 = '76047345-3801-4628-ae7b-adbebcfe8822'
const USER_ID_TEST3 = '76047345-3801-4628-ae7b-adbebcfe8823'
const USER_ID_TEST4 = '76047345-3801-4628-ae7b-adbebcfe8824'
const USER_ID_TEST5 = '76047345-3801-4628-ae7b-adbebcfe8825'
const MISSING_CATALOG_COLLECTION_ID = 'fde06b3c-d515-4907-99cf-c2ba67583155'

async function connect() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

  return prisma
}

export default defineConfig({
  watchForFileChanges: true,
  projectId: 'y436dx',
  trashAssetsBeforeRuns: true,
  video: true,
  env: {
    URL_STUDENT: 'http://127.0.0.1:3001',
    URL_STUDENT_LOGIN: 'http://127.0.0.1:3001/login',
    URL_MANAGE: 'http://127.0.0.1:3002',
    URL_CONTROL: 'http://127.0.0.1:3003',
    URL_AUTH: 'http://127.0.0.1:3010',
    LECTURER_ID: USER_ID_TEST,
    LECTURER_EMAIL: 'lecturer@df.uzh.ch',
    LECTURER_SHORTNAME: 'lecturer',
    LECTURER_IND_ID: USER_ID_TEST3,
    LECTURER_IND_SHORTNAME: 'pro1',
    LECTURER_IND_EMAIL: 'pro1@df.uzh.ch',
    LECTURER_INST_ID: USER_ID_TEST4,
    LECTURER_INST_SHORTNAME: 'pro2',
    LECTURER_INST_EMAIL: 'pro2@df.uzh.ch',
    LECTURER_INST2_ID: USER_ID_TEST5,
    LECTURER_INST2_SHORTNAME: 'pro3',
    LECTURER_INST2_EMAIL: 'pro3@df.uzh.ch',
    LECTURER_PASSWORD: 'abcd',
    STUDENT_USERNAME: 'testuser1',
    STUDENT_USERNAME2: 'testuser2',
    STUDENT_USERNAME3: 'testuser3',
    STUDENT_USERNAME4: 'testuser4',
    STUDENT_USERNAME5: 'testuser5',
    STUDENT_USERNAME6: 'testuser6',
    STUDENT_USERNAME7: 'testuser7',
    STUDENT_USERNAME8: 'testuser8',
    STUDENT_USERNAME9: 'testuser9',
    STUDENT_USERNAME10: 'testuser10',
    STUDENT_USERNAME11: 'testuser11',
    STUDENT_USERNAME12: 'testuser12',
    STUDENT_USERNAME15: 'testuser15',
    STUDENT_NOGROUP: 'testuser40',
    STUDENT_EMAIL: 'testuser1@test.uzh.ch',
    STUDENT_PASSWORD: 'abcdabcd',

    // codeCoverage: {
    //   expectBackendCoverageOnly: true,
    //   url: 'http://127.0.0.1:3000/__coverage__',
    // },
  },

  e2e: {
    experimentalStudio: true,
    //   // includeShadowDom: true,
    setupNodeEvents(on, config) {
      // merge process.env with config.env
      config.env = { ...config.env, ...process.env }

      require('@cypress/code-coverage/task')(on, config)
      on('task', {
        // ! Helper functions
        // #region
        async connectToDB() {
          const prisma = await connect()
          return prisma
        },
        // #endregion

        // ! Element creation
        // #region
        async createQuestionChoices({
          type,
          name,
          content,
          explanation,
          multiplier,
          choices,
          userId,
        }: {
          type: ElementType
          name: string
          content: string
          explanation?: string
          multiplier?: number
          choices: { value: string; correct?: boolean; feedback?: string }[]
          userId: string
        }) {
          if (type === ElementType.SC && choices.length < 2) {
            throw new Error('SC questions require at least 2 choices')
          }

          if (type === ElementType.MC && choices.length < 2) {
            throw new Error('MC questions require at least 2 choices')
          }

          if (type === ElementType.KPRIM && choices.length !== 4) {
            throw new Error('KPRIM questions require exactly 4 choices')
          }

          const hasSampleSolution = choices.some(
            (choice) => typeof choice.correct !== 'undefined'
          )
          const hasAnswerFeedbacks = choices.every(
            (choice) => typeof choice.feedback !== 'undefined'
          )

          const prisma = await connect()

          try {
            const ChoicesQuestion = await prisma.element.create({
              data: {
                type,
                name,
                content,
                explanation: explanation ?? undefined,
                basePoints: true,
                pointsMultiplier: multiplier,
                options: {
                  hasSampleSolution,
                  hasAnswerFeedbacks,
                  displayMode: 'LIST',
                  choices: choices.map((choice, ix) => ({
                    ix,
                    value: choice.value,
                    correct: hasSampleSolution
                      ? (choice.correct ?? false)
                      : undefined,
                    feedback: hasAnswerFeedbacks ? choice.feedback : undefined,
                  })),
                } as ElementOptionsChoices,
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created element
            await prisma.derivedPermission.create({
              data: {
                permissionLevel: PermissionLevel.OWNER,
                element: {
                  connect: { id: ChoicesQuestion.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
            })

            return true
          } finally {
            await prisma.$disconnect()
          }
        },
        async createQuestionNumerical({
          name,
          content,
          explanation,
          multiplier,
          min,
          max,
          unit,
          accuracy,
          solutionRanges,
          exactSolutions,
          userId,
        }: {
          name: string
          content: string
          explanation?: string
          multiplier?: number
          min?: string
          max?: string
          unit?: string
          accuracy?: string
          solutionRanges?: { min: string; max: string }[] | null
          exactSolutions?: string[] | null
          userId: string
        }) {
          const hasSampleSolution =
            typeof solutionRanges !== 'undefined' &&
            solutionRanges !== null &&
            solutionRanges.length > 0

          const prisma = await connect()

          try {
            const NumericalQuestion = await prisma.element.create({
              data: {
                type: 'NUMERICAL',
                name,
                content,
                explanation: explanation ?? undefined,
                basePoints: true,
                pointsMultiplier: multiplier,
                options: {
                  hasSampleSolution,
                  unit,
                  accuracy: accuracy ? parseFloat(accuracy) : undefined,
                  restrictions:
                    typeof min !== 'undefined' || typeof max !== 'undefined'
                      ? {
                          min: min ? parseFloat(min) : null,
                          max: max ? parseFloat(max) : null,
                        }
                      : undefined,
                  solutionRanges: solutionRanges
                    ? solutionRanges.map((range) => ({
                        min: parseFloat(range.min),
                        max: parseFloat(range.max),
                      }))
                    : undefined,
                  exactSolutions: exactSolutions
                    ? exactSolutions.map((solution) => parseFloat(solution))
                    : undefined,
                } as ElementOptionsNumerical,
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created element
            await prisma.derivedPermission.create({
              data: {
                permissionLevel: PermissionLevel.OWNER,
                element: {
                  connect: { id: NumericalQuestion.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
            })

            return true
          } finally {
            await prisma.$disconnect()
          }
        },
        async createQuestionFreeText({
          name,
          content,
          explanation,
          multiplier,
          maxLength,
          solutions,
          userId,
        }: {
          name: string
          content: string
          explanation?: string
          multiplier?: number
          maxLength?: string
          solutions?: string[]
          userId: string
        }) {
          const hasSampleSolution =
            typeof solutions !== 'undefined' && solutions.length > 0

          const prisma = await connect()

          try {
            const FreeTextQuestion = await prisma.element.create({
              data: {
                type: 'FREE_TEXT',
                name,
                content,
                explanation: explanation ?? undefined,
                basePoints: true,
                pointsMultiplier: multiplier,
                options: {
                  hasSampleSolution,
                  restrictions: {
                    maxLength: maxLength ? parseInt(maxLength) : undefined,
                  },
                  solutions,
                } as ElementOptionsFreeText,
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created element
            await prisma.derivedPermission.create({
              data: {
                permissionLevel: PermissionLevel.OWNER,
                element: {
                  connect: { id: FreeTextQuestion.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
            })

            return true
          } finally {
            await prisma.$disconnect()
          }
        },
        async createQuestionSelection({
          name,
          content,
          explanation,
          multiplier,
          collectionName,
          numberOfInputs,
          correctAnswers,
          userId,
        }: {
          name: string
          content: string
          explanation?: string
          multiplier?: number
          collectionName: string
          numberOfInputs: number
          correctAnswers?: string[]
          userId: string
        }) {
          const prisma = await connect()

          try {
            const dbAnswerCollection = await prisma.answerCollection.findFirst({
              where: {
                name: collectionName,
                isDeleted: false,
                permissions: {
                  some: {
                    userId: userId,
                  },
                },
              },
            })

            if (!dbAnswerCollection) {
              throw new Error(`Answer collection ${collectionName} not found`)
            }

            const hasSampleSolution =
              typeof correctAnswers !== 'undefined' && correctAnswers.length > 0
            const dbAnswerCollectionItems = hasSampleSolution
              ? await prisma.answerCollectionEntry.findMany({
                  where: {
                    collectionId: dbAnswerCollection.id,
                    value: {
                      in: correctAnswers,
                    },
                  },
                })
              : []

            if (
              hasSampleSolution &&
              correctAnswers.length !== dbAnswerCollectionItems.length
            ) {
              throw new Error(
                `Answer collection ${collectionName} does not contain all correct answers`
              )
            }

            const SelectionQuestion = await prisma.element.create({
              data: {
                type: 'SELECTION',
                name,
                content,
                explanation,
                pointsMultiplier: multiplier,
                options: {
                  hasSampleSolution,
                  numberOfInputs,
                } as ElementOptionsSelection,
                // connect answer collection
                answerCollection: {
                  connect: {
                    id: dbAnswerCollection.id,
                  },
                },
                // connect answer collection entries (if defined)
                answerCollectionItems: hasSampleSolution
                  ? {
                      connect: dbAnswerCollectionItems.map((item) => ({
                        id: item.id,
                      })),
                    }
                  : undefined,
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created element
            await prisma.derivedPermission.create({
              data: {
                permissionLevel: PermissionLevel.OWNER,
                element: {
                  connect: { id: SelectionQuestion.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
            })

            // create a derived permission for the answer collection (if not already created)
            // (existing permission level does not need to be checked - can only be equal or larger)
            await prisma.derivedPermission.upsert({
              where: {
                answerCollectionId_userId: {
                  answerCollectionId: dbAnswerCollection.id,
                  userId: userId,
                },
              },
              create: {
                permissionLevel: PermissionLevel.READ,
                derived: true,
                answerCollection: {
                  connect: { id: dbAnswerCollection.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
              update: {},
            })

            return true
          } finally {
            await prisma.$disconnect()
          }
        },
        async createQuestionCaseStudy({
          name,
          content,
          explanation,
          multiplier,
          collectionName,
          selectedItems,
          criteria,
          cases,
          solutions,
          userId,
        }: {
          name: string
          content: string
          explanation?: string
          multiplier?: number
          collectionName: string
          selectedItems: string[]
          criteria: {
            mode: 'range' | 'steps'
            id: string
            name: string
            // range criterion attributes
            min?: number
            max?: number
            step?: number
            unit?: string
            // steps criterion attribute
            steps?: number
            labels?: {
              min: string
              mid?: string
              max: string
            }
          }[]
          cases: {
            id: string
            title: string
            description: string
          }[]
          solutions?: {
            [caseIx: string]: {
              [itemIx: string]: {
                [criterionIx: string]: {
                  lower: number
                  upper: number
                }
              }
            }
          }
          userId: string
        }) {
          const prisma = await connect()

          try {
            const dbAnswerCollection = await prisma.answerCollection.findFirst({
              where: {
                name: collectionName,
                isDeleted: false,
                permissions: {
                  some: {
                    userId: userId,
                  },
                },
              },
            })

            if (!dbAnswerCollection) {
              throw new Error(`Answer collection ${collectionName} not found`)
            }

            const dbAnswerCollectionItems =
              await prisma.answerCollectionEntry.findMany({
                where: {
                  collectionId: dbAnswerCollection.id,
                  value: {
                    in: selectedItems,
                  },
                },
              })

            if (
              !dbAnswerCollectionItems ||
              selectedItems.length !== dbAnswerCollectionItems.length
            ) {
              throw new Error(
                `Answer collection ${collectionName} does not contain all required items for this case study`
              )
            }

            const hasSampleSolution = !!solutions
            const CaseStudyQuestion = await prisma.element.create({
              data: {
                type: 'CASE_STUDY',
                name,
                content,
                explanation,
                pointsMultiplier: multiplier,
                options: {
                  hasSampleSolution,
                  criteria: criteria.map((criterion, ix) => ({
                    id: criterion.id,
                    name: criterion.name,
                    order: ix,
                    min: criterion.mode === 'steps' ? 1 : criterion.min,
                    max:
                      criterion.mode === 'steps'
                        ? criterion.steps
                        : criterion.max,
                    step: criterion.mode === 'steps' ? 1 : criterion.step,
                    unit: criterion.unit,
                    labels:
                      criterion.mode === 'steps' ? criterion.labels : undefined,
                  })),
                  cases: cases.map((caseItem, caseIx) => {
                    const caseSolutionsObject = solutions
                      ? solutions[caseIx]
                      : undefined

                    if (!!solutions && !caseSolutionsObject) {
                      throw new Error(
                        `Case study ${name} does not contain all required solutions`
                      )
                    }

                    const caseSolutions = solutions
                      ? Object.entries(caseSolutionsObject).reduce<
                          CaseStudyCaseSolution[]
                        >((acc, [itemIx, itemSolutions]) => {
                          const item = dbAnswerCollectionItems[parseInt(itemIx)]

                          if (!item) {
                            throw new Error(
                              `Case study ${name} does not contain all required solutions`
                            )
                          }

                          const criteriaSolutions = Object.entries(
                            itemSolutions
                          ).reduce<CaseStudyCaseCriterionSolution[]>(
                            (criterionAcc, [criterionIx, solution]) => {
                              const criterion = criteria[parseInt(criterionIx)]

                              if (!criterion) {
                                throw new Error(
                                  `Case study ${name} does not contain all required solutions`
                                )
                              }

                              criterionAcc.push({
                                criterionId: criterion.id,
                                min: solution.lower,
                                max: solution.upper,
                              })

                              return criterionAcc
                            },
                            []
                          )

                          acc.push({
                            itemId: item.id,
                            criteriaSolutions,
                          })

                          return acc
                        }, [])
                      : undefined

                    return {
                      id: caseItem.id,
                      order: caseIx,
                      title: caseItem.title,
                      description: caseItem.description,
                      solutions: caseSolutions,
                    }
                  }),
                } as ElementOptionsCaseStudy,
                // connect answer collection
                answerCollection: {
                  connect: {
                    id: dbAnswerCollection.id,
                  },
                },
                // connect answer collection entries (if defined)
                answerCollectionItems: {
                  connect: dbAnswerCollectionItems.map((item) => ({
                    id: item.id,
                  })),
                },
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created element
            await prisma.derivedPermission.create({
              data: {
                permissionLevel: PermissionLevel.OWNER,
                element: {
                  connect: { id: CaseStudyQuestion.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
            })

            // create a derived permission for the answer collection (if not already created)
            // (existing permission level does not need to be checked - can only be equal or larger)
            await prisma.derivedPermission.upsert({
              where: {
                answerCollectionId_userId: {
                  answerCollectionId: dbAnswerCollection.id,
                  userId: userId,
                },
              },
              create: {
                permissionLevel: PermissionLevel.READ,
                derived: true,
                answerCollection: {
                  connect: { id: dbAnswerCollection.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
              update: {},
            })

            return true
          } finally {
            await prisma.$disconnect()
          }
        },
        async createContentElement({
          name,
          content,
          userId,
        }: {
          name: string
          content: string
          userId: string
        }) {
          const prisma = await connect()

          try {
            const ContentElement = await prisma.element.create({
              data: {
                type: 'CONTENT',
                name,
                content,
                options: {} as ElementOptionsContent,
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created element
            await prisma.derivedPermission.create({
              data: {
                permissionLevel: PermissionLevel.OWNER,
                element: {
                  connect: { id: ContentElement.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
            })

            return true
          } finally {
            await prisma.$disconnect()
          }
        },
        async createFlashcard({
          name,
          content,
          explanation,
          userId,
        }: {
          name: string
          content: string
          explanation: string
          userId: string
        }) {
          const prisma = await connect()

          try {
            const Flashcard = await prisma.element.create({
              data: {
                type: 'FLASHCARD',
                name,
                content,
                explanation,
                options: {} as ElementOptionsFlashcard,
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created element
            await prisma.derivedPermission.create({
              data: {
                permissionLevel: PermissionLevel.OWNER,
                element: {
                  connect: { id: Flashcard.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
            })

            return true
          } finally {
            await prisma.$disconnect()
          }
        },
        // #endregion

        // ! Practice Quiz queries / mutations
        // #region
        async getPracticeQuizInfo({ quizName }) {
          const prisma = await connect()

          try {
            const practiceQuizzes = await prisma.practiceQuiz.findMany({
              where: {
                name: quizName,
              },
            })

            if (!practiceQuizzes || practiceQuizzes.length === 0) {
              return null
            }

            return {
              id: practiceQuizzes[0].id,
              courseId: practiceQuizzes[0].courseId,
            }
          } finally {
            await prisma.$disconnect()
          }
        },
        async removeSoftDeletedPracticeQuiz({ quizName }) {
          const prisma = await connect()

          try {
            const practiceQuizzes = await prisma.practiceQuiz.deleteMany({
              where: {
                name: quizName,
                isDeleted: true,
              },
            })

            if (!practiceQuizzes) {
              return false
            }

            return true
          } finally {
            await prisma.$disconnect()
          }
        },
        // #endregion

        // ! Microlearning queries / mutations
        // #region
        async getMicroLearningInfo({ mlName }) {
          const prisma = await connect()

          try {
            const microLearnings = await prisma.microLearning.findMany({
              where: {
                name: mlName,
              },
            })

            if (!microLearnings || microLearnings.length === 0) {
              return null
            }

            return {
              id: microLearnings[0].id,
              courseId: microLearnings[0].courseId,
            }
          } finally {
            await prisma.$disconnect()
          }
        },
        async removeSoftDeletedMicrolearning({ mlName }) {
          const prisma = await connect()

          try {
            const microLearnings = await prisma.microLearning.deleteMany({
              where: {
                name: mlName,
                isDeleted: true,
              },
            })

            if (!microLearnings) {
              return false
            }

            return true
          } finally {
            await prisma.$disconnect()
          }
        },
        // #endregion

        // ! Answer Collection queries / mutations
        // #region
        async createAnswerCollection({
          name,
          description,
          entries,
          userId,
        }: {
          name: string
          description: string
          entries: string[]
          userId: string
        }) {
          const prisma = await connect()

          try {
            const answerCollection = await prisma.answerCollection.create({
              data: {
                name,
                description,
                entries: {
                  create: entries.map((entry) => ({
                    value: entry,
                  })),
                },
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created answer collection
            await prisma.derivedPermission.create({
              data: {
                permissionLevel: PermissionLevel.OWNER,
                answerCollection: {
                  connect: { id: answerCollection.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
            })

            return true
          } finally {
            await prisma.$disconnect()
          }
        },
        async verifyDeletionAnswerCollections() {
          const NUM_SEEDED_ANSWER_COLLECTIONS = 3 // 3 seeded answer collections that should not be removed through workflows

          const prisma = await connect()

          try {
            // delete all answer collections that have no derived permissions on them
            await prisma.answerCollection.deleteMany({
              where: {
                permissions: {
                  none: {},
                },
              },
            })

            // verify that only the seeded answer collections remain
            const count = await prisma.answerCollection.count()
            return count === NUM_SEEDED_ANSWER_COLLECTIONS
          } finally {
            await prisma.$disconnect()
          }
        },
        async verifyDeletionCatalogCollections() {
          const NUM_SEEDED_CATALOG_COLLECTIONS = 1 // 1 seeded default catalog collections that should not be removed through workflows

          const prisma = await connect()

          try {
            // delete all catalog collections that have no derived permissions on them
            await prisma.catalogCollection.deleteMany({
              where: {
                id: {
                  not: MISSING_CATALOG_COLLECTION_ID,
                },
                permissions: {
                  none: {},
                },
              },
            })

            // verify that only the seeded catalog collections remain
            const count = await prisma.catalogCollection.count()
            return count === NUM_SEEDED_CATALOG_COLLECTIONS
          } finally {
            await prisma.$disconnect()
          }
        },
        // #endregion

        // ! Live Quiz queries / mutations
        // #region
        async removeSoftDeletedLiveQuiz({ lqName }) {
          const prisma = await connect()

          try {
            const liveQuizzes = await prisma.liveQuiz.deleteMany({
              where: {
                name: lqName,
                isDeleted: true,
              },
            })

            if (!liveQuizzes) {
              return false
            }

            return true
          } finally {
            await prisma.$disconnect()
          }
        },
        // #endregion

        // ! Group Activity queries / mutations
        // #region
        async removeSoftDeletedGroupActivity({ gaName }) {
          const prisma = await connect()

          try {
            const groupActivities = await prisma.groupActivity.deleteMany({
              where: {
                name: gaName,
                isDeleted: true,
              },
            })

            if (!groupActivities) {
              return false
            }

            return true
          } finally {
            await prisma.$disconnect()
          }
        },
        // #endregion

        // ! Permission queries / mutations
        // #region
        async updateLecturerPreviewFlags({
          publicPreview,
          privatePreview,
        }: {
          publicPreview: boolean
          privatePreview: boolean
        }) {
          const prisma = await connect()

          try {
            const user = await prisma.user.update({
              where: {
                shortname: 'lecturer',
              },
              data: {
                publicPreview,
                privatePreview,
              },
            })

            return !!user
          } finally {
            await prisma.$disconnect()
          }
        },
        // #endregion
      })
      return config
    },
  },

  retries: {
    runMode: 5,
  },
})
