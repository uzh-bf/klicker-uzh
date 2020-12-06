require('dotenv').config()

import * as pulumi from '@pulumi/pulumi'
import * as azure from '@pulumi/azure'

// Create an Azure resource (Storage Account)
const account = new azure.storage.Account('storage', {
  resourceGroupName: process.env.RESOURCE_GROUP_NAME as string,
  accountTier: 'Standard',
  accountReplicationType: 'LRS',
})

// Export the connection string for the storage account
export const connectionString = account.primaryConnectionString
