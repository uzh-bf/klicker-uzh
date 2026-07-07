const fs = require('fs');
const path = require('path');

const shardIndex = parseInt(process.argv[2], 10);
if (isNaN(shardIndex) || shardIndex < 1 || shardIndex > 5) {
  console.error('Invalid shard index. Must be between 1 and 5.');
  process.exit(1);
}

const testsDir = path.join(__dirname, '../../playwright/tests');
const allFiles = fs.readdirSync(testsDir).filter(file => file.endsWith('.spec.ts'));

// Define balanced groupings based on average run times
const group1 = ['O-live-quiz.spec.ts'];
const group2 = [
  'P-microlearning.spec.ts',
  '0-baseline-ops.spec.ts',
  'A-login.spec.ts',
  'B-feature-access.spec.ts',
  'C-control.spec.ts'
];
const group3 = [
  'S-group-activity.spec.ts',
  'D-elements-content.spec.ts',
  'E-elements-flashcards.spec.ts',
  'F-elements-sc.spec.ts',
  'G-elements-mc.spec.ts'
];
const group4 = [
  'U-catalog.spec.ts',
  'Q-practice-quiz.spec.ts',
  'H-elements-kprim.spec.ts',
  'I-elements-numerical.spec.ts'
];

// Group 5 gets all other files (ensures new test files are automatically run)
const definedFiles = new Set([...group1, ...group2, ...group3, ...group4]);
const group5 = allFiles.filter(file => !definedFiles.has(file));

let targetFiles;
switch (shardIndex) {
  case 1:
    targetFiles = group1;
    break;
  case 2:
    targetFiles = group2;
    break;
  case 3:
    targetFiles = group3;
    break;
  case 4:
    targetFiles = group4;
    break;
  case 5:
    targetFiles = group5;
    break;
}

// Map files to their relative path from the playwright package directory
const relativePaths = targetFiles.map(file => `tests/${file}`);
console.log(relativePaths.join(' '));
