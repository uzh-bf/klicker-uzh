import { PrismaClient } from '@klicker-uzh/prisma'
import { defineConfig } from 'cypress'

export default defineConfig({
  // TODO: no watch mode in CI
  watchForFileChanges: true,
  projectId: 'y436dx',
  env: {
    URL_STUDENT: 'http://127.0.0.1:3001',
    URL_STUDENT_LOGIN: 'http://127.0.0.1:3001/login',
    URL_MANAGE: 'http://127.0.0.1:3002',
    URL_CONTROL: 'http://127.0.0.1:3003',
    LECTURER_EMAIL: 'lecturer@df.uzh.ch',
    LECTURER_IDENTIFIER: 'lecturer',
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
      })
      return config
    },
  },

  retries: {
    runMode: 5,
  },
})
