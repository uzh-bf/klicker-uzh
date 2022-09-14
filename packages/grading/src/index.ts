import { any, equals, toLower, trim } from "ramda";

interface GradeQuestionChoicesArgs {
  responseCount: number;
  response: number[];
  solution: number[];
}

// compute the hamming distance between a string a and string b
function hammingDistance({
  responseCount,
  response,
  solution,
}: GradeQuestionChoicesArgs) {
  const baseArr = new Array(responseCount).fill(0);

  const responseArr = baseArr.map((_, ix) => (response.includes(ix) ? 1 : 0));
  const solutionArr = baseArr.map((_, ix) => (solution.includes(ix) ? 1 : 0));

  let distance = 0;
  for (let i = 0; i < responseArr.length; i++) {
    if (responseArr[i] !== solutionArr[i]) distance++;
  }
  return distance;
}

export function gradeQuestionSC({
  response,
  solution,
}: GradeQuestionChoicesArgs): number | null {
  if (!solution || solution.length === 0) return null;

  if (equals(response, solution)) return 1;

  return 0;
}

export function gradeQuestionMC({
  responseCount,
  response,
  solution,
}: GradeQuestionChoicesArgs): number | null {
  if (!solution || solution.length === 0) return null;

  const distance = hammingDistance({
    responseCount,
    response,
    solution,
  });

  const percentageOfWrongAnswers = distance / responseCount;

  return Math.max(-2 * percentageOfWrongAnswers + 1, 0);
}

export function gradeQuestionKPRIM({
  responseCount,
  response,
  solution,
}: GradeQuestionChoicesArgs): number | null {
  if (!solution) return null;

  const distance = hammingDistance({
    responseCount,
    response,
    solution,
  });

  if (distance === 0) return 1;
  if (distance === 1) return 0.5;

  return 0;
}

interface GradeQuestionNumericalArgs {
  response: number;
  solutionRanges: {
    min?: number;
    max?: number;
  }[];
}

export function gradeQuestionNumerical({
  response,
  solutionRanges,
}: GradeQuestionNumericalArgs): number | null {
  if (!solutionRanges || solutionRanges.length === 0) return null;

  const withinRanges = solutionRanges.map(({ min, max }) => {
    if (min && response <= min) return false;
    if (max && response >= max) return false;
    return true;
  });

  // if the response is within any of the solution ranges
  if (any(Boolean, withinRanges)) return 1;

  // TODO: maybe incorporate distance from ranges for partial credit?

  return 0;
}

interface GradeQuestionFreeTextArgs {
  response: string;
  solutions: string[];
}

export function gradeQuestionFreeText({
  response,
  solutions,
}: GradeQuestionFreeTextArgs): number | null {
  if (!solutions || solutions.length === 0) return null;

  const matchingSolutions = solutions.map(
    (solution) => toLower(trim(solution)) === toLower(trim(response))
  );

  if (any(Boolean, matchingSolutions)) return 1;

  return 0;
}
