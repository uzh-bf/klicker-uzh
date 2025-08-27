// jest.config.ts
import type { JestConfigWithTsJest } from 'ts-jest'

const jestConfig: JestConfigWithTsJest = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@klicker-uzh/prisma$': '<rootDir>/../prisma/src/index.ts',
    '^@klicker-uzh/prisma/client$': '<rootDir>/../prisma/dist/client.js',
    '^@klicker-uzh/types$': '<rootDir>/../types/src/index.ts',
    '^@klicker-uzh/grading$': '<rootDir>/../grading/src/index.ts',
    '^@klicker-uzh/util$': '<rootDir>/../util/src/index.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        isolatedModules: true,
        tsconfig: {
          module: 'ESNext',
          target: 'ESNext',
        },
      },
    ],
  },
  // Allow transformation of @klicker-uzh and prisma packages
  transformIgnorePatterns: ['node_modules/(?!(@klicker-uzh|@prisma|.prisma)/)'],
}

export default jestConfig
