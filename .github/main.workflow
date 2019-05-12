workflow "New workflow" {
  on = "push"
  resolves = ["Validate formatting", "Lint sources", "Draft Release"]
}

action "Install dependencies" {
  uses = "actions/npm@3c8332795d5443adc712d30fa147db61fd520b5a"
  runs = "npm"
  args = "install"
}

action "Validate formatting" {
  uses = "actions/npm@3c8332795d5443adc712d30fa147db61fd520b5a"
  needs = ["Install dependencies"]
  runs = "npm"
  args = "run format:ci"
}

action "Lint sources" {
  uses = "actions/npm@3c8332795d5443adc712d30fa147db61fd520b5a"
  needs = ["Install dependencies"]
  runs = "npm"
  args = "run lint"
}

action "Draft Release" {
  uses = "toolmantim/release-drafter@v5.1.1"
  secrets = ["GITHUB_TOKEN"]
}
