const server = require('./app')

server.listen(process.env.PORT, (err) => {
  if (err) throw err
  console.log(`> API ready on http://localhost:${process.env.PORT}!`)
})
