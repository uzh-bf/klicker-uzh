import { defineConfig } from "cypress";

export default defineConfig({
  projectId: 'y436dx',
  env: {
    URL_STUDENT: "http://127.0.0.1:3001",
    URL_LECTURER: "http://127.0.0.1:3002",
    LECTURER_EMAIL: "lecturer@bf.uzh.ch",
    LECTURER_PASSWORD: "abcd",
    STUDENT_USERNAME: "testuser1",
    STUDENT_PASSWORD: "testing",
  },

  e2e: {
    // includeShadowDom: true,
    setupNodeEvents(on, config) {
      /* on("task", {
        async "db:seed"() {
          // seed database with test data
          const { data } = await axios.post(`${testDataApiEndpoint}/seed`);
          return data;
        },
      }); */
    },
  },
});
