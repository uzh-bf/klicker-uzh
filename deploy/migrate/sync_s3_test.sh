#!/bin/bash
rclone sync --dry-run aws-klicker-prod:tc-klicker-prod/images exo-klicker-qa:klicker-qa
