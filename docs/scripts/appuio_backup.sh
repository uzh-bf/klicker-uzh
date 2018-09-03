#!/bin/bash

# http://docs.appuio.ch/en/latest/baas.html
oc -n uniz-klicker apply -f - <<EOF
apiVersion: appuio.ch/v1alpha1
kind: Backup
metadata:
  name: klicker-backup
spec:
  schedule: "04 * * * *"
  checkSchedule: "30 0 * * 7" # When the checks should run default once a week
  keepJobs: 4 # How many job objects should be kept to check logs
  backend:
    s3:
      endpoint: https://s3.eu-central-1.amazonaws.com
      bucket: klicker-backup
  retention: # Default 14 days
    keepLast: 2 # Absolute amount of snapshots to keep overwrites all other settings
    keepDaily: 0
    # Available retention settings:
    # keepLast
    # keepHourly
    # keepDaily
    # keepWeekly
    # keepMonthly
    # keepYearly
EOF
