import { defineConfig } from 'cypress'

export default defineConfig({
  projectId: 'y436dx',
  env: {
    URL_STUDENT: 'http://127.0.0.1:3001/login',
    URL_MANAGE: 'http://127.0.0.1:3002',
    URL_CONTROL: 'http://127.0.0.1:3003',
    LECTURER_EMAIL: 'lecturer@bf.uzh.ch',
    LECTURER_IDENTIFIER: 'lecturer',
    LECTURER_PASSWORD: 'abcd',
    STUDENT_USERNAME: 'testuser1',
    STUDENT_PASSWORD: 'abcd',

    codeCoverage: {
      expectBackendCoverageOnly: true,
      url: 'http://127.0.0.1:3000/__coverage__',
    },
  },

  e2e: {
    experimentalStudio: true,
    //   // includeShadowDom: true,
    setupNodeEvents(on, config) {
      require('@cypress/code-coverage/task')(on, config)
      /* on("task", {
          async "db:seed"() {
            // seed database with test data
            const { data } = await axios.post(`${testDataApiEndpoint}/seed`);
            return data;
          },
        }); */
      return config
    },
  },

  retries: {
    runMode: 2,
  },
})
