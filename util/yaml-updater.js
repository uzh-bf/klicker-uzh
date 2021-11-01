const YAML = require('yaml')

module.exports.readVersion = function (contents) {
  return YAML.parse(contents).version
}

module.exports.writeVersion = function (contents, version) {
  const yaml = YAML.parse(contents)
  yaml.version = version
  yaml.appVersion = `v${version}`
  return YAML.stringify(yaml)
}
