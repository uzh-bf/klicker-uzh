import { ObjectAccess } from '@klicker-uzh/prisma'

// mock user 1
export const userOne = {
  id: 'b086deed-291d-4dc3-9271-c84d4c2840f2',
  sub: 'b086deed-291d-4dc3-9271-c84d4c2840f2',
  email: 'first@example.com',
  shortname: 'firstuser',
}

// mock user 2
export const userTwo = {
  id: '5deec433-7ead-4c9c-9f6d-96cd5ef1758a',
  sub: '5deec433-7ead-4c9c-9f6d-96cd5ef1758a',
  email: 'second@example.com',
  shortname: 'seconduser',
}

// mock user 3
export const userThree = {
  id: 'e9a2e2f8-6d1d-4a6d-8d7f-7f3d4d4a1f4a',
  sub: 'e9a2e2f8-6d1d-4a6d-8d7f-7f3d4d4a1f4a',
  email: 'third@example.com',
  shortname: 'thirduser',
}

// mock user 4
export const userFour = {
  id: 'f3c7d4f3-4e3d-4f3d-4f3d-4f3d4f3d4f3d',
  sub: 'f3c7d4f3-4e3d-4f3d-4f3d-4f3d4f3d4f3d',
  email: 'fourth@example.com',
  shortname: 'fourthuser',
}

// mock user 5
export const userFive = {
  id: 'f3c7d4f3-4e3d-4f3d-4f3d-4f3d4f3d4f3e',
  sub: 'f3c7d4f3-4e3d-4f3d-4f3d-4f3d4f3d4f3e',
  email: 'fifth@example.com',
  shortname: 'fifthuser',
}

// answer collection 1
export const answerCollection1 = {
  name: 'Answer Collection 1',
  description: 'This is the first answer collection',
  entries: ['entry1', 'entry2', 'entry3', 'entry4'],
}

// answer collection 2
export const answerCollection2 = {
  name: 'Answer Collection 2',
  description: 'This is the second answer collection',
  entries: ['entry5', 'entry6', 'entry7', 'entry8'],
}

// catalog collection 1 (public)
export const catalogCollection1 = {
  name: 'Public Catalog Collection',
  access: ObjectAccess.PUBLIC,
}

// catalog collection 2 (restricted)
export const catalogCollection2 = {
  name: 'Restricted Catalog Collection',
  access: ObjectAccess.RESTRICTED,
}
