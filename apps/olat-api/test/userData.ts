import { v4 as uuidv4 } from 'uuid'

export interface User {
  id: string
  email: string
  shortname: string
  provider: string
  providerAccountId: string
}

export interface Course {
  id: string
  owner: User
  name: string
}

export const userOne: User = {
  id: uuidv4(),
  email: 'first@example.com',
  shortname: 'firstuser',
  provider: 'firstprovider',
  providerAccountId: '1234567890@firstprovider.ch',
}

export const userTwo: User = {
  id: uuidv4(),
  email: 'second@example.com',
  shortname: 'seconduser',
  provider: 'secondprovider',
  providerAccountId: '2345678901@secondprovider.ch',
}

export const courseOne: Course = {
  id: uuidv4(),
  owner: userOne,
  name: 'Test Course One',
}

export const courseTwo: Course = {
  id: uuidv4(),
  owner: userOne,
  name: 'Test Course Two',
}

export const courseThree: Course = {
  id: uuidv4(),
  owner: userTwo,
  name: 'Test Course Three',
}

export const courseFour: Course = {
  id: uuidv4(),
  owner: userTwo,
  name: 'Test Course Four',
}

export const courseFive: Course = {
  id: uuidv4(),
  owner: userTwo,
  name: 'Test Course Five',
}
