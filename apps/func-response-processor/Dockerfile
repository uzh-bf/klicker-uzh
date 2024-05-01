# To enable ssh & remote debugging on app service change the base image to the one below
# FROM mcr.microsoft.com/azure-functions/node:4-node18-appservice
FROM mcr.microsoft.com/azure-functions/node:4-node18

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

COPY . /home/site/wwwroot

WORKDIR /home/site/wwwroot

# replace the string "workspace:*" in /home/site/wwwroot/package.json with "*"
# this will force NPM to download the latest version of the package
# instead of using the one in the PNPM workspace (which is problematic with Docker)
RUN sed -i 's/workspace:\*/\*/g' package.json

RUN set -x && npm install
