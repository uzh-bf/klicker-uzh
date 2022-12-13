import { defineConfig } from "cypress";

export default defineConfig({
  env: {
    URL_STUDENT: "http://127.0.0.1:3001",
    URL_LECTURER: "http://127.0.0.1:3002",
  },

  e2e: {
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
