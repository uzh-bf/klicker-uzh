import { gradeQuestionMC } from "../src/index";

describe("@klicker-uzh/grading", () => {
  it("should grade MC questions correctly", () => {
    const points = gradeQuestionMC({
      responseCount: 6,
      response: [0, 1, 2, 3, 4, 5],
      solution: [0, 1, 3],
    });

    expect(points).toEqual(0);
  });
});
