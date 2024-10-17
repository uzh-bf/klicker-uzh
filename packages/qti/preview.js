const express = require('express')
const path = require('path')
const app = express()

app.use(express.static(path.join(__dirname, 'out')))

app.listen(8080, () => {
  console.log('Server successfully running on port 8080')
})
