import { defineConfig } from 'cypress'

export default defineConfig({
  projectId: 'y436dx',
  env: {
    URL_STUDENT: 'http://127.0.0.1:3001/login',
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
      require('@cypress/code-coverage/task')(on, config)
      return config
    },
  },

  retries: {
    runMode: 5,
  },
})
