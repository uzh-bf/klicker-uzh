# Changelog

## 1.1.0

- Perform major upgrade to NextJS 7.0.0 with Webpack 4
- Improve display of QR codes throughout the application (include link)
- Add a participation redirection to the application landing page
- Rework the fingerprint computation logic (add on-the-fly recomputation)
- Rework all interactions with session/local storage with extended error handling
- Add Elastic APM RUM as an additional performance logger
- Evaluation: Rework all statistical calculations to make use of math-js
- Evaluation: Introduce react-sizeme as a wrapper for chart components
- Evaluation: Add font-size variations depending on min-width of the evaluation screen
- Evaluation: Improve responsiveness for evaluation on mobile devices
- Fix: Cloud chart not displayed in the correct full screen view
- Upgrade minor/patch dependencies

## 1.0.3

- Fix: Errors with rounding decimals in the HistogramChart component
- Fix: Ensure that responses to delete are sent as strings
- Upgrade depencencies

## 1.0.2

- Update the Klicker introductory video
- Update public roadmap link for Github project
- Fix: Downgrade react to fix logrocket incompatibility
- Fix: Naming of TravisCI environment variables for staging environments

## 1.0.1

- Fix: Add default zero values for difficulty and speed when submitting confusion
- Fix: Ensure that the response sent for FREE and NR questions is a string
- Fix: Add a codeclimate config to make use of ESLint v4
- Upgrade dependencies

## 1.0.0

- Initial release
