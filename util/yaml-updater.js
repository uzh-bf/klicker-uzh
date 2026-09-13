const YAML = require('yaml')

module.exports.readVersion = (contents) => YAML.parse(contents).version

module.exports.writeVersion = (contents, version) => {
  const yaml = YAML.parse(contents)
  yaml.version = version
  yaml.appVersion = `v${version}`
  return YAML.stringify(yaml)
}
