workflow "New workflow" {
  on = "push"
  resolves = ["Validate formatting", "Lint sources"]
}

action "Install dependencies" {
  uses = "actions/npm@3c8332795d5443adc712d30fa147db61fd520b5a"
  runs = "yarn"
  args = "install"
}

action "Validate formatting" {
  uses = "actions/npm@3c8332795d5443adc712d30fa147db61fd520b5a"
  needs = ["Install dependencies"]
  runs = "yarn"
  args = "format:ci"
}

action "Lint sources" {
  uses = "actions/npm@3c8332795d5443adc712d30fa147db61fd520b5a"
  needs = ["Install dependencies"]
  runs = "yarn"
  args = "lint"
}
