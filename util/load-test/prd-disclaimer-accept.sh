#!/bin/zsh
set -euo pipefail
# Values-free disclaimer acceptance helper.
# Accepts the usage disclaimer for one chatbot, then prints only booleans/statuses.

CHATBOT_ID="$1"
BASE_URL="https://chat.klicker.uzh.ch"
API_URL="https://backend-sls.klicker.uzh.ch"

LOGIN_HASH='8e3ea39b64b0408ac5e307fc0778e8ad583268eec5569d98873ddec90598c384'

LOGIN_BODY=$(cat <<EOF
{"operationName":"LoginParticipant","variables":{"usernameOrEmail":"$KLICKER_PARTICIPANT_USERNAME_OR_EMAIL","password":"$KLICKER_PARTICIPANT_PASSWORD"},"extensions":{"persistedQuery":{"version":1,"sha256Hash":"$LOGIN_HASH"}}}
EOF
)

RESPONSE_HEADERS=$(mktemp)
curl -s -D "$RESPONSE_HEADERS" -o /dev/null \
  -H 'content-type: application/json' \
  -H 'x-graphql-yoga-csrf: true' \
  --data "$LOGIN_BODY" \
  "$API_URL/api/graphql"

TOKEN=$(grep -o 'participant_token=[^;]*' "$RESPONSE_HEADERS" | head -n 1 | cut -d= -f2-)
rm -f "$RESPONSE_HEADERS"

if [[ -z "$TOKEN" ]]; then
  echo '{"login": false}'
  exit 1
fi
echo "{"login": true}"

# GET current disclaimer status (values-free: only the boolean fields)
STATUS_JSON=$(curl -s "$BASE_URL/api/chatbots/$CHATBOT_ID/disclaimer" \
  -H "Cookie: participant_token=$TOKEN")
REQUIRED=$(printf '%s' "$STATUS_JSON" | LC_ALL=C tr -d '\000-\010\013\014\016-\037' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.status.required)}catch{console.log('parse_error')}})")
ACCEPTED=$(printf '%s' "$STATUS_JSON" | LC_ALL=C tr -d '\000-\010\013\014\016-\037' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.status.accepted)}catch{console.log('parse_error')}})")
echo "{"disclaimerRequired": $REQUIRED, "disclaimerAccepted": $ACCEPTED}"

if [[ "$REQUIRED" == "true" && "$ACCEPTED" != "true" ]]; then
DISCLAIMER_ID=$(printf '%s' "$STATUS_JSON" | LC_ALL=C tr -d '\000-\010\013\014\016-\037' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.disclaimer.id)}catch{console.log('')}})")
  ACCEPT_BODY=$(cat <<EOF2
{"action":"accept","disclaimerId":"$DISCLAIMER_ID"}
EOF2
)
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/chatbots/$CHATBOT_ID/disclaimer" \
    -H "Cookie: participant_token=$TOKEN" \
    -H 'content-type: application/json' \
    --data "$ACCEPT_BODY")
  echo "{"disclaimerAcceptHttpStatus": $HTTP_CODE}"
fi
