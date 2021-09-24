#!/bin/bash
rclone sync aws-klicker-prod:tc-klicker-prod/images exo-klicker-qa:klicker-qa
exo storage setacl sos://klicker-qa/ --recursive public-read
