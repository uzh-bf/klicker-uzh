#!/bin/sh -e
cd prisma
npm run build
npm publish
cd ../graphql
npm run build
npm publish
cd ../grading
npm run build
npm publish
cd ../lti
npm run build
npm publish
cd ../markdown
npm run build
npm publish
