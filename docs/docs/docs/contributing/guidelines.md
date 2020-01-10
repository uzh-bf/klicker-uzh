---
id: contributing_guidelines
title: Contributing Guidelines
---

When contributing to any KlickerUZH service or project, please ensure that you follow our guidelines. These have mainly been set to ensure consistency within our projects and should not be a cause of inconvenience.

Before considering any contribution, we recommend that you create an issue to discuss your proposed addition with the project contributors. If you have any questions, please feel free to reach out.

## Code Style

The code style of KlickerUZH is checked using ESLint (https://eslint.org/). Our configuration is based on the Airbnb Javascript style guide (https://github.com/airbnb/javascript). Some rules have been overridden to fit the style of our project. The linter can be manually executed with `npm run lint`; it will automatically run on pre-commit.

## Formatting

All KlickerUZH code is to be formatted with Prettier (https://prettier.io/) to ensure a consistent code formatting across all projects. To simplify this process, we have added the `npm run format` command as well as a git hook that will format your code automatically on pre-commit. Please note that our CI will check the formatting and throw if erroneous formatting is encountered.
