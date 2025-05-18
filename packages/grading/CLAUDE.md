# CLAUDE.md - Grading Package

This file provides guidance to Claude Code for working specifically with the Grading logic in the KlickerUZH project.

## Package Overview

The Grading package implements the core scoring logic for KlickerUZH, handling the evaluation of student responses across different question types and calculating awarded points and experience (XP) in the gamification system.

### Key Responsibilities

- Evaluating correctness of responses for different question types (SC, MC, KPRIM, etc.)
- Computing awarded points based on response correctness and timing
- Calculating experience points for gamification features
- Providing a unified grading interface for all activity types
- Supporting both synchronous (live) and asynchronous (practice) scoring models

## Grading Functions by Question Type

### Choice-Based Questions

These functions evaluate responses where the user selects one or more options:

- `gradeQuestionSC`: Single-choice questions (1 point for correct answer, 0 for incorrect)
- `gradeQuestionMC`: Multiple-choice questions (partial credit based on Hamming distance)
- `gradeQuestionKPRIM`: KPRIM questions (1 point for all correct, 0.5 for one mistake, 0 otherwise)
- `gradeQuestionSelection`: Selection questions (partial credit based on ratio of correct selections)

### Open-Ended Questions

These functions evaluate responses where the user provides free-form input:

- `gradeQuestionNumerical`: Numerical questions (checks if response is within defined ranges)
- `gradeQuestionFreeText`: Free text questions (case-insensitive exact match with provided solutions)

### Complex Questions

- `gradeQuestionCaseStudy`: Case study questions (evaluates multiple criteria across cases)

## Points and Experience Calculation

The package implements two main algorithms for awarding points:

- `computeAwardedPoints`: Used in synchronous activities (like LiveQuiz), with time-based bonus
- `computeSimpleAwardedPoints`: Used in asynchronous activities (like PracticeQuiz), without time factor
- `computeAwardedXp`: Determines experience points awarded based on response correctness

### Points Algorithm Details

#### Synchronous (Live) Points Logic

For live quizzes, points are calculated with:

- Base points awarded independent of correctness (optional)
- Correctness-based points proportional to the response's percentage score
- Time-based bonus decreasing linearly from submission time
- Optional point multipliers for special cases

```typescript
function computeAwardedPoints({
  firstResponseReceivedAt, // timestamp of first response
  responseTimestamp, // timestamp of current response
  maxBonus, // maximum time bonus possible
  timeToZeroBonus, // seconds until bonus reaches zero
  getsMaxPoints, // flag if answer is fully correct
  defaultPoints, // base points for participation
  defaultCorrectPoints, // points for correct answers
  pointsPercentage, // percentage score (0.0-1.0)
  basePoints, // flag if base points should be awarded
  pointsMultiplier, // optional multiplier for special cases
}): number
```

#### Asynchronous (Practice) Points Logic

For practice quizzes and microlearnings, points are simpler:

- Points are awarded proportional to correctness percentage
- No time-based bonus
- Optional multiplier can be applied

```typescript
function computeSimpleAwardedPoints({
  points, // maximum possible points
  pointsPercentage, // percentage score (0.0-1.0)
  pointsMultiplier, // optional multiplier
}): number
```

## Hamming Distance Algorithm

The package uses the Hamming distance algorithm to evaluate multiple-choice questions, measuring how many positions differ between the student's answer and the correct solution:

```typescript
function hammingDistance({
  responseCount, // total number of options
  response, // array of selected option indices
  solution, // array of correct option indices
}): number
```

## Integration with Other Packages

### GraphQL Service Integration

The Grading package is used by the GraphQL package in:

- `stacks.ts`: For evaluating element stacks in practice quizzes
- `liveQuizzes.ts`: For calculating points in live quizzes
- `microLearning.ts`: For scoring microlearning elements
- `groupActivities.ts`: For evaluating group submissions

### Response Processor Integration

The Response Processor uses these functions to:

- Evaluate incoming responses in real-time
- Calculate and store points in the database
- Update leaderboards based on awarded points

## Testing Grading Functions

When testing grading functions:

1. Cover all edge cases for each question type
2. Test different combinations of correct/incorrect answers
3. Verify boundary conditions for numerical ranges
4. Check time-based calculations with various time differences
5. Ensure point calculations match the expected gamification behavior

## Best Practices

1. Always handle null/undefined inputs gracefully
2. Return null for unevaluable questions (no solution provided)
3. Use Number.EPSILON for floating-point comparisons to avoid precision issues
4. Ensure all numerical outputs are properly rounded to integers where appropriate
5. Keep logic consistent between different question types where possible
6. Document complex scoring algorithms clearly

## Performance Considerations

The grading functions are used extensively during response processing, so efficiency is important:

1. Use efficient algorithms for matching (e.g., Set for duplicates)
2. Avoid unnecessary array iterations
3. Consider caching results for repeated evaluations
4. Use appropriate data structures for fast lookups (Maps/Objects vs. Arrays)

## Future Development

When extending the grading system:

1. Follow the established pattern for new question types
2. Maintain backward compatibility with existing scoring systems
3. Document the grading algorithm clearly in comments
4. Add unit tests covering all edge cases
5. Consider performance implications for high-volume scenarios

## Examples

### Grading a Single-Choice Question

```typescript
const result = gradeQuestionSC({
  responseCount: 4,
  response: [2], // Student selected option 2
  solution: [2], // Correct answer is option 2
})
// result = 1 (full points)
```

### Calculating Points with Time Bonus

```typescript
const points = computeAwardedPoints({
  firstResponseReceivedAt: '1620000000000', // First response timestamp
  responseTimestamp: 1620000010000, // 10 seconds later
  maxBonus: 10, // Maximum 10 point bonus
  timeToZeroBonus: 20, // Bonus reaches 0 after 20 seconds
  getsMaxPoints: true, // Answer is correct
  defaultPoints: 5, // 5 base points
  defaultCorrectPoints: 10, // 10 points for correct answer
  pointsPercentage: null, // No partial credit
  basePoints: true, // Award base points
})
// points = 20 (5 base + 10 correct + 5 time bonus)
```
