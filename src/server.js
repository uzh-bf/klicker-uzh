const bodyParser = require('body-parser')
const express = require('express')
const { graphqlExpress, graphiqlExpress } = require('graphql-server-express')
const schema = require('./graphql/schema')
const mongodb = require('mongodb')
const mongoose = require('mongoose')

mongoose.Promise = Promise

const db = new mongodb.Db('klicker', new mongodb.Server('localhost', 27017))
db.open().then(() => {
  mongoose.connect('mongodb://localhost/klicker')
  mongoose.connection
    .once('open', () => {
      console.log('hello mongo!')
    })
    .on('error', (error) => {
      console.warn('Warning', error)
    })
})

const dev = process.env.NODE_ENV !== 'production'

const server = express()

server.use('/graphql', bodyParser.json(), graphqlExpress({ schema }))
if (dev) server.use('/graphiql', graphiqlExpress({ endpointURL: '/graphql' }))

server.listen(3000, (err) => {
  if (err) throw err
  console.log('> Ready on http://localhost:3000')
})
