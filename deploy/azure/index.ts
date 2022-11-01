import * as pulumi from '@pulumi/pulumi'
import * as azure from '@pulumi/azure-native'
import * as k8s from '@pulumi/kubernetes'

const cfg = new pulumi.Config()

const PREFIX = 'klicker'
const LOCATION = 'westeurope'

const VERSION_INGRESS = '4.0.17'
const VERSION_CERT_MANAGER = '1.7.1'

const RG_MAIN = process.env['RESOURCE_GROUP_MAIN'] as string
const RG_AUX = process.env['RESOURCE_GROUP_AUX'] as string
const SUBNET_IBF = process.env['SUBNET_IBF'] as string
const SUBNET_UZH = process.env['SUBNET_UZH'] as string
const CERT_EMAIL = process.env['CERT_EMAIL'] as string

if (!CERT_EMAIL) process.exit(0)

const INGRESS_RECORDS = [
  {
    name: `${PREFIX}-wildcard-dns`,
    relativeRecordSetName: `*.klicker`,
  },
  //   {
  //     name: `${PREFIX}-prod`,
  //     relativeRecordSetName: '*.klicker-prod',
  //   },
  //   {
  //     name: `${PREFIX}-faculties`,
  //     relativeRecordSetName: '*.klicker-faculties',
  //   },
  {
    name: `${PREFIX}-qa`,
    relativeRecordSetName: '*.klicker-qa',
  },
]

const mainRG = new azure.resources.ResourceGroup(
  `${PREFIX}-rg`,
  {
    location: 'switzerlandnorth',
    resourceGroupName: RG_MAIN,
    tags: {
      'Org-Unit': 'IBF',
    },
  },
  {
    protect: true,
  }
)

const auxiliaryRG = new azure.resources.ResourceGroup(
  `devops-rg`,
  {
    location: 'switzerlandnorth',
    resourceGroupName: RG_AUX,
    tags: {
      'Org-Unit': 'IBF',
    },
  },
  {
    protect: true,
  }
)

// link to the bf-app.ch domain to work with DNS resources
const dnsZone = new azure.network.Zone(
  'bf-app',
  {
    location: 'global',
    resourceGroupName: auxiliaryRG.name,
    zoneName: 'bf-app.ch',
    zoneType: 'Public',
  },
  {
    protect: true,
  }
)

// ----- BOOTSTRAP AZURE RESOURCES -----

// create a new vnet that will be used for all internal communications
const vnet = new azure.network.VirtualNetwork(
  `${PREFIX}-vnet`,
  {
    location: LOCATION,
    resourceGroupName: mainRG.name,
    addressSpace: {
      addressPrefixes: ['10.8.0.0/16'],
    },
    enableDdosProtection: false,
  },
  {
    ignoreChanges: ['subnets'],
    protect: true,
  }
)

// create a default subnet for all internal communication
const defaultSubnet = new azure.network.Subnet(
  `${PREFIX}-subnet-default`,
  {
    resourceGroupName: mainRG.name,
    virtualNetworkName: vnet.name,
    // the default subnet consists of 4,094 usable hosts
    // more specifically, 10.8.0.1 - 10.8.15.254
    addressPrefix: '10.8.0.0/20',
    serviceEndpoints: [
      {
        locations: ['*'],
        service: 'Microsoft.AzureCosmosDB',
      },
    ],
  },
  {
    protect: true,
  }
)

// create a log analytics workspace for kubernetes monitoring
const logAnalytics = new azure.operationalinsights.Workspace(
  `${PREFIX}-logging`,
  {
    resourceGroupName: mainRG.name,
    location: LOCATION,
    sku: {
      name: azure.operationalinsights.WorkspaceSkuNameEnum.PerGB2018,
    },
    retentionInDays: 30,
    workspaceCapping: {
      dailyQuotaGb: 0.4,
    },
  }
)

const klickerProdCosmosDB = new azure.documentdb.DatabaseAccount(
  `${PREFIX}-cosmosdb`,
  {
    apiProperties: {
      serverVersion: azure.documentdb.ServerVersion.ServerVersion_4_0,
    },
    backupPolicy: {
      type: 'Continuous',
    },
    capabilities: [
      {
        name: 'EnableMongo',
      },
      {
        name: 'DisableRateLimitingResponses',
      },
      {
        name: 'EnableServerless',
      },
    ],
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session',
    },
    databaseAccountOfferType: 'Standard',
    defaultIdentity: 'FirstPartyIdentity',
    disableKeyBasedMetadataWriteAccess: false,
    enableAnalyticalStorage: false,
    enableAutomaticFailover: false,
    enableFreeTier: false,
    enableMultipleWriteLocations: false,
    isVirtualNetworkFilterEnabled: true,
    identity: {
      type: 'None',
    },
    ipRules: [
      {
        ipAddressOrRange: '51.138.0.0/16',
      },
      {
        ipAddressOrRange: '51.124.0.0/16',
      },
      {
        ipAddressOrRange: '20.50.2.42',
      },
      {
        ipAddressOrRange: '40.114.174.73',
      },
      {
        ipAddressOrRange: '20.126.0.0/16',
      },
      {
        ipAddressOrRange: '20.31.0.0/16',
      },
      {
        ipAddressOrRange: '20.105.0.0/16',
      },
    ],
    kind: 'MongoDB',
    location: LOCATION,
    locations: [
      {
        failoverPriority: 0,
        isZoneRedundant: false,
        locationName: LOCATION,
      },
    ],
    networkAclBypass: 'None',
    publicNetworkAccess: 'Enabled',
    resourceGroupName: mainRG.name,
    tags: {
      defaultExperience: 'Azure Cosmos DB for MongoDB API',
      'hidden-cosmos-mmspecial': '',
    },
    virtualNetworkRules: [
      {
        id: defaultSubnet.id,
        ignoreMissingVNetServiceEndpoint: false,
      },
    ],
  },
  {
    protect: true,
  }
)

// create a kubernetes cluster for workloads
const k8sCluster = new azure.containerservice.ManagedCluster(
  `${PREFIX}-k8s`,
  {
    addonProfiles: {
      aciConnectorLinux: {
        enabled: false,
      },
      // enable the azure policy addon to ensure compliance can be verified
      azurepolicy: {
        enabled: true,
      },
      httpApplicationRouting: {
        enabled: false,
      },
      // enable the container monitoring plugin to allow azure monitor to integrate with running containers
      omsagent: {
        enabled: true,
        config: {
          logAnalyticsWorkspaceResourceId: logAnalytics.id,
        },
      },
    },
    agentPoolProfiles: [
      {
        availabilityZones: ['1', '2', '3'],
        count: 3,
        enableAutoScaling: true,
        maxCount: 2,
        minCount: 1,
        enableFIPS: false,
        enableNodePublicIP: false,
        kubeletDiskType: 'OS',
        maxPods: 110,
        mode: 'User',
        name: 'apps',
        osDiskType: 'Ephemeral',
        osDiskSizeGB: 30,
        osType: 'Linux',
        orchestratorVersion: '1.22.4',
        osSKU: 'Ubuntu',
        type: 'VirtualMachineScaleSets',
        vmSize: 'Standard_D2as_v4',
        vnetSubnetID: defaultSubnet.id,
      },
      {
        availabilityZones: ['1', '2', '3'],
        count: 0,
        minCount: 0,
        maxCount: 1,
        enableAutoScaling: true,
        enableFIPS: false,
        enableNodePublicIP: false,
        kubeletDiskType: 'OS',
        maxPods: 110,
        mode: 'User',
        name: 'compute',
        osDiskType: 'Ephemeral',
        osDiskSizeGB: 30,
        osType: 'Linux',
        orchestratorVersion: '1.22.4',
        osSKU: 'Ubuntu',
        type: 'VirtualMachineScaleSets',
        vmSize: 'Standard_F4s_v2',
        vnetSubnetID: defaultSubnet.id,
        // add taints to all compute nodes to ensure that nothing is scheduled there
        // except workloads that explicitly tolerate the taint
        nodeTaints: ['key=compute:NoSchedule'],
      },
      {
        availabilityZones: ['1', '2', '3'],
        count: 1,
        enableAutoScaling: false,
        enableFIPS: false,
        enableNodePublicIP: false,
        kubeletDiskType: 'OS',
        maxPods: 110,
        mode: 'System',
        name: 'system',
        osDiskType: 'Ephemeral',
        osDiskSizeGB: 30,
        osType: 'Linux',
        orchestratorVersion: '1.22.4',
        osSKU: 'Ubuntu',
        type: 'VirtualMachineScaleSets',
        vmSize: 'Standard_D2as_v4',
        vnetSubnetID: defaultSubnet.id,
      },
    ],
    apiServerAccessProfile: {
      enablePrivateCluster: false,
      authorizedIPRanges: [SUBNET_IBF, SUBNET_UZH],
    },
    identity: {
      type: 'SystemAssigned',
    },
    dnsPrefix: `${PREFIX}-k8s-dns`,
    enableRBAC: true,
    kubernetesVersion: '1.22.4',
    location: LOCATION,
    networkProfile: {
      loadBalancerSku: 'Standard',
      networkPlugin: 'azure',
      networkPolicy: 'azure',
      outboundType: 'loadBalancer',
    },
    resourceGroupName: mainRG.name,
    servicePrincipalProfile: {
      clientId: 'msi',
    },
    sku: {
      name: 'Basic',
      tier: 'Free',
    },
  },
  {
    protect: true,
  }
)

const k8sCredentials = pulumi
  .all([mainRG.name, k8sCluster.name])
  .apply((args) =>
    azure.containerservice.listManagedClusterAdminCredentials({
      resourceGroupName: args[0],
      resourceName: args[1],
    })
  )

const kubeConfig = k8sCredentials.kubeconfigs[0].value.apply((enc) =>
  Buffer.from(enc, 'base64').toString('utf-8')
)

// ----- BOOTSTRAP KUBERNETES CLUSTER -----

// get access to the kubeconfig of the previously created cluster
// crucial to include this in all subsequent operations, otherwise it will use the currently activated kubectl context
const k8sProvider = new k8s.Provider(`${PREFIX}-k8s-provider`, {
  kubeconfig: kubeConfig,
})

// deploy ingress-nginx
const ingressNginx = new k8s.helm.v3.Release(
  `${PREFIX}-ingress-nginx`,
  {
    chart: 'ingress-nginx',
    version: VERSION_INGRESS,
    namespace: 'ingress-nginx',
    createNamespace: true,
    repositoryOpts: {
      repo: 'https://kubernetes.github.io/ingress-nginx',
    },
    values: {
      controller: {
        replicaCount: 2,
        service: {
          externalTrafficPolicy: 'Local',
        },
        nodeSelector: {
          'beta.kubernetes.io/os': 'linux',
        },
        admissionWebhooks: {
          patch: {
            nodeSelector: {
              'beta.kubernetes.io/os': 'linux',
            },
          },
        },
        watchIngressWithoutClass: true,
      },
      defaultBackend: {
        nodeSelector: {
          'beta.kubernetes.io/os': 'linux',
        },
      },
    },
  },
  {
    provider: k8sProvider,
  }
)

// get a handle to the ingress controller to fetch the external ip
const ingressController = k8s.core.v1.Service.get(
  `${PREFIX}-ingress-controller`,
  pulumi.interpolate`${ingressNginx.status.namespace}/${ingressNginx.status.name}-controller`,
  {
    provider: k8sProvider,
  }
)

// deploy cert-manager
const certManager = new k8s.helm.v3.Release(
  `${PREFIX}-cert-manager`,
  {
    chart: 'cert-manager',
    version: VERSION_CERT_MANAGER,
    namespace: 'ingress-nginx',
    repositoryOpts: {
      repo: 'https://charts.jetstack.io',
    },
    values: {
      installCRDs: true,
      nodeSelector: {
        'kubernetes.io/os': 'linux',
      },
      webhook: {
        nodeSelector: {
          'kubernetes.io/os': 'linux',
        },
      },
      cainjector: {
        nodeSelector: {
          'kubernetes.io/os': 'linux',
        },
      },
    },
  },
  {
    provider: k8sProvider,
    dependsOn: [ingressNginx],
  }
)

const lbRecordSet = new azure.network.RecordSet(`${PREFIX}-lb-dns`, {
  resourceGroupName: auxiliaryRG.name,
  zoneName: dnsZone.name,
  recordType: 'A',
  relativeRecordSetName: 'klicker',
  ttl: 360,
  aRecords: [
    {
      ipv4Address: ingressController.status.loadBalancer.ingress[0].ip,
    },
  ],
})

const ingressRecordSets = INGRESS_RECORDS.map(
  ({ name, relativeRecordSetName }) =>
    new azure.network.RecordSet(name, {
      resourceGroupName: auxiliaryRG.name,
      zoneName: dnsZone.name,
      recordType: 'A',
      relativeRecordSetName,
      ttl: 360,
      targetResource: {
        id: lbRecordSet.id,
      },
    })
)

// deploy the clusterissuer for letsencrypt
const certManagerIssuer = new k8s.yaml.ConfigGroup(
  `${PREFIX}-cert-manager-issuer`,
  {
    yaml: `
  apiVersion: cert-manager.io/v1
  kind: ClusterIssuer
  metadata:
      name: letsencrypt
  spec:
      acme:
          server: https://acme-v02.api.letsencrypt.org/directory
          email: ${CERT_EMAIL}
          privateKeySecretRef:
              name: letsencrypt
          solvers:
              - http01:
                    ingress:
                        class: nginx
                    podTemplate:
                        spec:
                            nodeSelector:
                                'kubernetes.io/os': linux
      `,
  },
  {
    provider: k8sProvider,
    dependsOn: [certManager],
  }
)

// deploy the a storageclass for ZRS
const storageClassZRS = new k8s.yaml.ConfigGroup(
  `${PREFIX}-storage-zrs`,
  {
    yaml: `
kind: StorageClass
apiVersion: storage.k8s.io/v1
metadata:
  name: default-zrs
  labels:
    addonmanager.kubernetes.io/mode: EnsureExists
    kubernetes.io/cluster-service: 'true'
provisioner: disk.csi.azure.com
parameters:
  skuname: StandardSSD_ZRS
reclaimPolicy: Delete
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
    `,
  },
  {
    provider: k8sProvider,
  }
)
