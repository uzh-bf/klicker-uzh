import { PrismaClient } from '@klicker-uzh/prisma'
import { defineConfig } from 'cypress'

// ! Copy of seeded user ids from prisma/seedUsers.ts
const USER_ID_TEST = '76047345-3801-4628-ae7b-adbebcfe8821'
const USER_ID_TEST2 = '76047345-3801-4628-ae7b-adbebcfe8822'
const USER_ID_TEST3 = '76047345-3801-4628-ae7b-adbebcfe8823'
const USER_ID_TEST4 = '76047345-3801-4628-ae7b-adbebcfe8824'
const USER_ID_TEST5 = '76047345-3801-4628-ae7b-adbebcfe8825'

export default defineConfig({
  watchForFileChanges: true,
  projectId: 'y436dx',
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
        },
        // #endregion

        // ! Element creation
        // #region
        // TODO: create SC question
        // TODO: create MC question
        // TODO: create KPRIM question
        // TODO: create NR question
        // TODO: create FT question
        // TODO: create SE question
        // TODO: create CS question
        // TODO: create CT element
        // TODO: create Flashcard
        // #endregion

        // ! Practice Quiz queries / mutations
        // #region

        async getPracticeQuizInfo({ quizName }) {
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

            if (!answerCollection) {
              return false
            }

            return true
          } finally {
            await prisma.$disconnect()
          }
        },
        async verifyDeletionAnswerCollections() {
          const NUM_SEEDED_ANSWER_COLLECTIONS = 3 // 3 seeded answer collections that should not be removed through workflows

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

          try {
            const count = await prisma.answerCollection.count()
            return count === NUM_SEEDED_ANSWER_COLLECTIONS
          } finally {
            await prisma.$disconnect()
          }
        },
        async verifyDeletionCatalogCollections() {
          const NUM_SEEDED_CATALOG_COLLECTIONS = 1 // 1 seeded default catalog collections that should not be removed through workflows

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

          try {
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
        async updateLecturerPermissions({
          publicPreview,
          privatePreview,
        }: {
          publicPreview: boolean
          privatePreview: boolean
        }) {
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
