import { IDetailsItem, IDetailsSection } from "./DetailsObject"

export const objectSections = new Map<string,IDetailsSection[]>()

// common properties and attributes to use in sections
let basicCluster:IDetailsItem[] = [
    {
        name: 'created',
        text: 'Created',
        source: ['metadata.creationTimestamp'],
        format: 'string'
    },
    {
        name: 'name',
        text: 'Name',
        source: ['metadata.name'],
        format: 'string'
    },
    {
        name: 'labels',
        text: 'Labels',
        source: ['metadata.labels'],
        format: 'objectprops',
        style: ['column', 'ifpresent']
    },
    {
        name: 'annotations',
        text: 'Annotations',
        source: ['metadata.annotations'],
        format: 'objectprops',
        style: ['column','char:50','ifpresent']
    }
]

let basicNamespaced:IDetailsItem[] = [
    {
        name: 'created',
        text: 'Created',
        source: ['metadata.creationTimestamp'],
        format: 'string'
    },
    {
        name: 'name',
        text: 'Name',
        source: ['metadata.name'],
        format: 'string'
    },
    {
        name: 'namespace',
        text: 'Namespace',
        source: ['#metadata.namespace'],
        format: 'string',
        style: ['link:$Namespace:metadata.namespace']
    },
    {
        name: 'labels',
        text: 'Labels',
        source: ['metadata.labels'],
        format: 'objectprops',
        style: ['column', 'ifpresent']
    },
    {
        name: 'annotations',
        text: 'Annotations',
        source: ['metadata.annotations'],
        format: 'objectprops',
        style: ['column','char:50','ifpresent']
    }
]

let conditions:IDetailsItem = {
    name: 'conditions',
    text: 'Conditions',
    source: ['status.conditions'],
    format: 'objectlist',
    content: [
        {
            name: 'type',
            text: 'Type',
            source: ['type'],
            format: 'string',
            style: ['property:status:True:green', 'property:status:False:red']
            //source: ['type', '$\u00a0(', 'status', '$)'],
            //style: ['False:red', 'True:green']
        },
    ]
}

objectSections.set('PersistentVolumeClaim', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'finalizers',
                text: 'Finalizers',
                source: ['metadata.finalizers'],
                format: 'stringlist',
           },
           {
                name: 'accessModes',
                text: 'Access Modes',
                source: ['spec.accessModes'],
                format: 'stringlist',
           },
           {
                name: 'storageClassName',
                text: 'Storage Class',
                source: ['#spec.storageClassName'],
                format: 'string',
                style: ['link:$StorageClass:spec.storageClassName']
           },

           {
                name: 'storage',
                text: 'Storage',
                source: ['spec.resources.requests.storage'],
                format: 'string',
           },
           {
                name: 'pods',
                text: 'Pods',
                source: ['$n/a'],
                format: 'string',
           },
           {
                name: 'status',
                text: 'Status',
                source: ['status.phase'],
                format: 'string',
           }
        ]
    }
])

objectSections.set('PersistentVolume', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicCluster,
            {
                name: 'finalizers',
                text: 'Finalizers',
                source: ['metadata.finalizers'],
                format: 'stringlist',
           },
            {
                name: 'capacity',
                text: 'Capacity',
                source: ['spec.capacity.storage'],
                format: 'string',
           },
           {
                name: 'accessModes',
                text: 'Access Modes',
                source: ['spec.accessModes'],
                format: 'stringlist',
           },
           {
                name: 'persistentVolumeReclaimPolicy',
                text: 'Reclaim Policy',
                source: ['spec.persistentVolumeReclaimPolicy'],
                format: 'string',
           },
           {
                name: 'storageClassName',
                text: 'Storage Class',
                source: ['#spec.storageClassName'],
                format: 'string',
                style: ['link:$StorageClass:spec.storageClassName']
           },
           {
                name: 'status',
                text: 'Status',
                source: ['status.phase'],
                format: 'string',
           }
        ]
    },
])

objectSections.set('StorageClass', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicCluster,
            {
                name: 'provisioner',
                text: 'Provisioner',
                source: ['provisioner'],
                format: 'string',
           },
            {
                name: 'volumeBindingMode',
                text: 'Binding Mode',
                source: ['volumeBindingMode'],
                format: 'string',
           },
            {
                name: 'reclaimPolicy',
                text: 'Reclaim Policy',
                source: ['reclaimPolicy'],
                format: 'string',
           }           
        ]
    },
])

objectSections.set('NetworkPolicy', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicCluster,
            {
                name: 'podSelector',
                text: 'Pod Selector',
                source: ['spec.podSelector.matchLabels'],
                format: 'objectprops'
            },
        ]
    }
])

objectSections.set('Service', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'selector',
                text: 'Selector',
                source: ['spec.selector'],
                format: 'objectprops',
                style: ['column']
            },
        ]
    },
    {
        name: 'connection',
        text: 'Connection',
        items: [
            {
                name: 'clusterIp',
                text: 'Cluster IP',
                source: ['spec.clusterIP'],
                format: 'string'
            },
            {
                name: 'clusterIps',
                text: 'Cluster IPs',
                source: ['spec.clusterIPs'],
                format: 'stringlist'
            },
            {
                name: 'ipFamilies',
                text: 'IP families',
                source: ['spec.ipFamilies'],
                format: 'stringlist'
            },
            {
                name: 'ipFamilyPolicy',
                text: 'IP family policy',
                source: ['spec.ipFamilyPolicy'],
                format: 'string'
            },
            {
                name: 'ports',
                text: 'Ports',
                source: ['spec.ports'],
                format: 'objectlist',
                content: [
                    {
                        name: 'type',
                        text: '',
                        source: ['port','$:', 'name','$/','protocol'],
                        format: 'string'
                    },                    
                ]
            },
        ]
    }
])

objectSections.set('Endpoints', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            //...basicNamespaced
        ]
    },
    {
        name: 'subsets',
        text: 'Subsets',
        items: [
            {
                name: 'subsetlist',
                text: '',
                source: ['subsets'],
                format: 'objectlist',
                content: [
                    {
                        name: 'address',
                        text: 'Address',
                        source: ['addresses'],
                        format: 'objectlist',
                        style:['table'],
                        content: [
                            {
                                name: 'ip',
                                text: 'IP',
                                source: ['ip'],
                                format: 'string'
                            },
                            {
                                name: 'target',
                                text: 'Target',
                                source: ['targetRef.kind', '$\u00a0', '#targetRef.name', '$\u00a0(', 'targetRef.namespace', '$)'],
                                format: 'string',
                                style: ['link:targetRef.kind:targetRef.name']
                            }
                        ]
                    },                    
                ]
            },

        ]
    }
])

objectSections.set('Ingress', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'ingressClass',
                text: 'Ingress class',
                source: ['#spec.ingressClassName'],
                format: 'string',
                style: ['bold', 'link:$IngressClass:spec.ingressClassName']
            },
        ]
    },
    {
        name: 'rules',
        text: 'Rules',
        items: [
            {
                name: 'host',
                text: 'Host',
                source: ['spec.rules'],
                format: 'objectlist',
                style: ['table'],
                content: [
                    {
                        name: 'host',
                        text: 'Host',  
                        source: ['host'],
                        format: 'string',
                        style:['bold']
                    },
                    {
                        name: 'paths',
                        text: 'Paths',  
                        source: ['http.paths'],
                        format: 'objectlist',
                        style: ['column'],
                        content: [
                            {
                                name: 'path',
                                text: 'Path',  
                                source: ['path', '$\u00a0(', '#backend.service.name', '$:', 'backend.service.port.number', '$)', ],
                                format: 'string',
                                style: [ 'link:$Service:backend.service.name']
                            },
                        ]
                    }
                ],
            },
        ]
    }
])

objectSections.set('IngressClass', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicCluster,
            {
                name: 'controller',
                text: 'Controller',
                source: ['spec.controller'],
                format: 'string'
            },
        ]
    }
])

objectSections.set('Namespace', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicCluster,
            {
                name: 'status',
                text: 'Status',
                source: ['status.phase'],
                format: 'string',
                style: ['Active:green']
            },
        ]
    },
])

objectSections.set('Node', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicCluster,
            {
                name: 'finallizers',
                text: 'Finalizers',
                source: ['metadata.finalizers'],
                format: 'stringlist',
                style: ['column']
            },
            {
                name: 'addresses',
                text: 'Addresses',
                source: ['status.addresses'],
                format: 'objectlist',
                content: [
                    {
                        name: 'type',
                        text: '',
                        source: ['type','$:\u00A0', 'address'],
                        format: 'string'
                    },
                ],
                style:['column']
            },
            {
                name: 'os',
                text: 'OS',
                source: ['status.nodeInfo.operatingSystem', '$(', 'status.nodeInfo.architecture', '$)'],
                format: 'string',
            },
            {
                name: 'osImage',
                text: 'OS Image',
                source: ['status.nodeInfo.osImage'],
                format: 'string',
            },
            {
                name: 'kernelVersion',
                text: 'Kernel version',
                source: ['status.nodeInfo.kernelVersion'],
                format: 'string',
            },
            {
                name: 'containerRuntime',
                text: 'CRI',
                source: ['status.nodeInfo.containerRuntimeVersion'],
                format: 'string',
            },
            {
                name: 'kubeletVersion',
                text: 'Kubelet',
                source: ['status.nodeInfo.kubeletVersion'],
                format: 'string',
            },
            conditions
        ]
    },
    {
        name: 'compute',
        text: 'Compute',
        items: [
            {
                name: 'capacity',
                text: 'Capacity',
                source: ['status.capacity'],
                format: 'objectprops',
                style: ['table']
            },
            {
                name: 'allocatable',
                text: 'Allocatable',
                source: ['status.allocatable'],
                format: 'objectprops',
                style: ['table']
            },
        ]
    },
])

objectSections.set('ConfigMap', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
        ]
    },
    {
        name: 'data',
        text: 'Data',
        items: [
            {
                name: 'item',
                text: '',
                source: ['data'],
                format: 'objectprops',
                style: ['column', 'edit', 'keybold']
            },
        ]
    },
])

objectSections.set('Secret', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'type',
                text: 'Type',
                source: ['type'],
                format: 'string'
            },
        ]
    },
    {
        name: 'data',
        text: 'Data',
        items: [
            {
                name: 'item',
                text: '',
                source: ['data'],
                format: 'objectprops',
                style: ['column', 'edit', 'keybold']
            },
        ]
    },
])

objectSections.set('LimitRange', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
        ]
    },
    {
        name: 'limits',
        text: 'Limits',
        items: [
            {
                name: 'limits',
                text: 'Limits',
                source: ['spec.limits'],
                format: 'objectlist',
                content: [
                    {
                        name: 'type',
                        text: 'Type',  
                        source: ['type'],
                        format: 'string'
                    },
                    {
                        name: 'max',
                        text: 'Max',  
                        source: ['max'],
                        format: 'objectprops',
                        style:['column'],
                        content: [
                            {
                                name: "cpu",
                                text: "CPU",
                                source: ['cpu'],
                                format: "string"
                            },
                            {
                                name: "memory",
                                text: "Memory",
                                source: ['memory'],
                                format: "string"
                            }
                        ]
                    },
                    {
                        name: 'min',
                        text: 'Min',  
                        source: ['min'],
                        format: 'objectprops',
                        style:['column'],
                        content: [
                            {
                                name: "cpu",
                                text: "CPU",
                                source: ['cpu'],
                                format: "string"
                            },
                            {
                                name: "memory",
                                text: "Memory",
                                source: ['memory'],
                                format: "string"
                            }
                        ]
                    },
                    {
                        name: 'default',
                        text: 'Default',  
                        source: ['default'],
                        format: 'objectprops',
                        style:['column'],
                        content: [
                            {
                                name: "cpu",
                                text: "CPU",
                                source: ['cpu'],
                                format: "string"
                            },
                            {
                                name: "memory",
                                text: "Memory",
                                source: ['memory'],
                                format: "string"
                            }
                        ]
                    },
                    {
                        name: 'defaultRequest',
                        text: 'DefaultRequest',  
                        source: ['defaultRequest'],
                        format: 'objectprops',
                        style:['column'],
                        content: [
                            {
                                name: "cpu",
                                text: "CPU",
                                source: ['cpu'],
                                format: "string"
                            },
                            {
                                name: "memory",
                                text: "Memory",
                                source: ['memory'],
                                format: "string"
                            }
                        ]
                    },
                ],
                style: ['table']
            },
        ]
    },
])

objectSections.set('HorizontalPodAutoscaler', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'reference',
                text: 'Reference',
                source: ['spec.scaleTargetRef.kind', '$\u00A0/\u00A0', 'spec.scaleTargetRef.name'],
                format: 'string'
            },
            {
                name: 'minPods',
                text: 'Min Pods',
                source: ['spec.minReplicas'],
                format: 'string'
            },
            {
                name: 'maxPods',
                text: 'Max Pods',
                source: ['spec.maxReplicas'],
                format: 'string'
            },
            {
                name: 'replicas',
                text: 'Replicas',
                source: ['status.desiredReplicas'],
                format: 'string'
            }
        ]
    },
    {
        name: 'metrics',
        text: 'Metrics',
        items: [
            {
                name: 'limits',
                text: 'Limits',
                source: ['spec.metrics'],
                format: 'objectlist',
                content: [
                    {
                        name: 'type',
                        text: 'Type',  
                        source: ['type'],
                        format: 'string'
                    },
                    {
                        name: 'resource',
                        text: 'Resource',  
                        source: ['resource'],
                        format: 'objectprops',
                        style:['column'],
                        content: [
                            {
                                name: 'name',
                                text: 'Name',
                                source: ['name'],
                                format: 'string'
                            },
                            {
                                name: 'target',
                                text: 'Target',
                                source: ['target'],
                                format: 'objectprops',
                                style: ['column'],
                                content: [
                                    {
                                        name: 'type',
                                        text: 'Type',
                                        source: ['type'],
                                        format: 'string'
                                    },
                                    {
                                        name: 'avgUtil',
                                        text: 'Average Utilization',
                                        source: ['averageUtilization'],
                                        format: 'string'
                                    },
                                ],
                            }
                        ]
                    },
                ],
                style: ['table']
            },
        ]
    },
])

objectSections.set('PodDisruptionBudget', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'minAvailable',
                text: 'Min Available',
                source: ['spec.minAvailable'],
                format: 'string'
            },
            {
                name: 'selector',
                text: 'Selector',
                source: ['spec.selector.matchLabels'],
                format: 'objectprops'
            },
        ]
    },
    //+++ more
])

objectSections.set('PriorityClass', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicCluster,
            {
                name: 'preemptionPolicy',
                text: 'Policy',
                source: ['preemptionPolicy'],
                format: 'string'
            },
        ]
    },
])

objectSections.set('RuntimeClass', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicCluster,
            {
                name: 'handler',
                text: 'Handler',
                source: ['handler'],
                format: 'string'
            },
        ]
    },
])

objectSections.set('Lease', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'holderIdentity',
                text: 'Holder',
                source: ['#spec.holderIdentity'],
                format: 'string',
                style: ['link:$Pod:spec.holderIdentity']
            },
            {
                name: 'leaseDurationSeconds',
                text: 'Duration',
                source: ['spec.leaseDurationSeconds'],
                format: 'string'
            },
            {
                name: 'acquireTime',
                text: 'Acquire',
                source: ['spec.acquireTime'],
                format: 'string'
            },
            {
                name: 'renewTime',
                text: 'Renew',
                source: ['spec.renewTime'],
                format: 'string'
            },
            {
                name: 'leaseTransitions',
                text: 'Transitions',
                source: ['spec.leaseTransitions'],
                format: 'string'
            },
        ]
    },
])

objectSections.set('ValidatingWebhookConfiguration', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicCluster,
            {
                name: 'webhooks',
                text: 'Webhooks',
                source: ['webhooks'],
                format: 'objectlist',
                style: ['table'],
                content: [
                    {
                        name: 'name',
                        text: 'Name',
                        source: ['name'],
                        format: 'string'
                    },
                    {
                        name: 'clientConfig',
                        text: 'Client Config',
                        source: ['clientConfig.service'],
                        format: 'objectprops',
                        content: [
                            {
                                name: 'name',
                                text: 'Name',
                                source: ['name'],
                                format: 'string'
                            },
                            {
                                name: 'namespace',
                                text: 'Namespace',
                                source: ['#namespace'],
                                format: 'string',
                                style: ['link:$Namespace:namespace']
                            },
                        ],
                    },
                    {
                        name: 'rules',
                        text: 'Rules',
                        source: ['rules'],
                        format: 'objectlist',
                        style: ['column'],
                        content: [
                            {
                                name: 'scope',
                                text: 'Scope',
                                source: ['scope'],
                                format: 'string',
                                style: ['header']
                            },
                            {
                                name: 'operations',
                                text: 'operations',
                                source: ['operations'],
                                format: 'stringlist',
                                style:['header']
                            },
                            {
                                name: 'apiGroups',
                                text: 'Gruoups',
                                source: ['apiGroups'],
                                format: 'stringlist',
                                style:['header']
                            },
                            {
                                name: 'apiVersions',
                                text: 'API Versions',
                                source: ['apiVersions'],
                                format: 'stringlist',
                                style:['header']
                            },
                            {
                                name: 'resources',
                                text: 'Resources',
                                source: ['resources'],
                                format: 'stringlist',
                                style:['header']
                            },
                          
                        ],
                    },
                ],
            },
        ]
    },
])

objectSections.set('MutatingWebhookConfiguration', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicCluster,
            {
                name: 'webhooks',
                text: 'Webhooks',
                source: ['webhooks'],
                format: 'objectlist',
                content: [
                    {
                        name: 'name',
                        text: 'Name',
                        source: ['name'],
                        format: 'string'
                    },
                    {
                        name: 'clientConfig',
                        text: 'Client Config',
                        source: ['clientConfig.service'],
                        format: 'objectprops',
                        content: [
                            {
                                name: 'name',
                                text: 'Name',
                                source: ['name'],
                                format: 'string'
                            },
                            {
                                name: 'namespace',
                                text: 'Namespace',
                                source: ['#namespace'],
                                format: 'string',
                                style: ['link:$Namespace:namespace']
                            },
                        ],
                    },
                    {
                        name: 'rules',
                        text: 'Rules',
                        source: ['rules'],
                        format: 'objectlist',
                        style: ['column'],
                        content: [
                            {
                                name: 'scope',
                                text: 'Scope',
                                source: ['scope'],
                                format: 'string',
                                style: ['header']
                            },
                            {
                                name: 'operations',
                                text: 'operations',
                                source: ['operations'],
                                format: 'stringlist',
                                style:['header']
                            },
                            {
                                name: 'apiGroups',
                                text: 'Gruoups',
                                source: ['apiGroups'],
                                format: 'stringlist',
                                style:['header']
                            },
                            {
                                name: 'apiVersions',
                                text: 'API Versions',
                                source: ['apiVersions'],
                                format: 'stringlist',
                                style:['header']
                            },
                            {
                                name: 'resources',
                                text: 'Resources',
                                source: ['resources'],
                                format: 'stringlist',
                                style:['header']
                            },
                          
                        ],
                    },
                ],
                style: ['table']
            },
        ]
    },
])

objectSections.set('Pod', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'controlledby',
                text: 'Controlled By',
                source: ['metadata.ownerReferences.0.kind', '$\u00A0', '#metadata.ownerReferences.0.name'],
                format: 'string',
                style: ['link:metadata.ownerReferences.0.kind:metadata.ownerReferences.0.name']
            },
            {
                name: 'status',
                text: 'Status',
                source: ['status.phase'],
                format: 'string',
                style: ['Running:green', 'Pending:orange']
            },
            {
                name: 'node',
                text: 'Node',
                source: ['#spec.nodeName'],
                format: 'string',
                style: ['link:$Node:spec.nodeName']
            },
            {
                name: 'podip',
                text: 'Pod IP',
                source: ['status.podIP'],
                format: 'string'
            },
            {
                name: 'podips',
                text: 'Pod IPs',
                source: ['status.podIPs'],
                format: 'objectlist',
                content: [
                    {
                        name: 'ip',
                        text: 'IP',
                        source: ['ip'],
                        format: 'string'
                    },
                ]
            },
            {
                name: 'sa',
                text: 'Service Account',
                source: ['#spec.serviceAccount'],
                format: 'string',
                style: ['link:$ServiceAccount:spec.serviceAccount']
            },
            {
                name: 'qosclass',
                text: 'QoS Class',
                source: ['status.qosClass'],
                format: 'string'
            },
            conditions,
            {
                name: 'tolerations',
                text: 'Tolerations',
                source: ['spec.tolerations'],
                format: 'table',
                content: [
                    {
                        name: 'key',
                        text: 'Key',
                        source: ['key'],
                        format: 'string'
                    },
                    {
                        name: 'operator',
                        text: 'Operator',
                        source: ['operator'],
                        format: 'string'
                    },
                    {
                        name: 'value',
                        text: 'Value',
                        source: ['value'],
                        format: 'string'
                    },
                    {
                        name: 'effect',
                        text: 'Effect',
                        source: ['effect'],
                        format: 'string'
                    },
                    {
                        name: 'seconds',
                        text: 'Seconds',
                        source: ['tolerationSeconds'],
                        format: 'string'
                    },
                ]
            },
        ]
    },
    {
        name: 'volumes',
        text: 'Volumes',
        items: [
            {
                name: 'volume',
                text: 'Volume',
                source: ['spec.volumes'],
                format: 'table',
                content: [
                    {
                        name: 'name',
                        text: 'Name',
                        source: ['name'],
                        format: 'string'
                    },
                    {
                        name: 'mode',
                        text: 'Mount Mode',
                        source: ['projected.defaultMode'],
                        format: 'string'
                    },
                    {
                        name: 'secret',
                        text: 'Secret',
                        source: ['secret.secretName'],
                        format: 'string'
                    },
                ]
            },
        ]
    },
    {
        name: 'containers',
        text: 'Containers',
        items: [
            {
                name: 'container',
                text: '',
                source: ['status.containerStatuses|spec.containers:name'],
                format: 'objectobject',
                content: [
                    {
                        name: 'name',
                        text: '',   // no text header => show property value as header
                        source: ['name'],
                        format: 'string',
                        style:['bold']
                    },
                    {
                        name: 'state',
                        text: 'State',
                        source: ['state'],
                        format: 'keylist',
                        style: ['running:green', 'waiting:orange']
                    },
                    {
                        name: 'image',
                        text: 'Image',
                        source: ['image'],
                        format: 'string',
                        style: ['edit']
                    },
                    {
                        name: 'ports',
                        text: 'Ports',
                        source: ['ports'],
                        format: 'objectlist',
                        content: [
                            {
                                name: 'port',
                                text: 'Port',
                                source: ['name','$: ', 'containerPort','$/','protocol'],
                                format: 'string'
                            }
                            
                        ]
                    },
                    {
                        name: 'envs',
                        text: 'Environment',
                        source: ['env'],
                        format: 'objectlist',
                        content: [
                            {
                                name: 'oneenv',
                                text: 'Env',
                                source: ['name','$: ', 'value'],
                                format: 'string'
                            }
                            
                        ],
                        style:['column']
                    },
                    {
                        name: 'mounts',
                        text: 'Mounts',
                        source: ['volumeMounts'],
                        format: 'table',
                        content: [
                            {
                                name: 'name',
                                text: 'Name',
                                source: ['name'],
                                format: 'string'
                            },
                            {
                                name: 'path',
                                text: 'Path',
                                source: ['mountPath'],
                                format: 'string'
                            }
                            
                        ]
                    },
                    {
                        name: 'requests',
                        text: 'Requests',
                        source: ['resources.requests'],
                        format: 'objectprops',
                        style: ['table', 'ifpresent']
                    },
                    {
                        name: 'limits',
                        text: 'Limits',
                        source: ['resources.limits'],
                        format: 'objectprops',
                        style: ['table','ifpresent']
                    },
                ],
                style: ['column']
            }
        ]
    },
])

objectSections.set('Deployment', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'selector',
                text: 'Selector',
                source: ['spec.selector.matchLabels'],
                format: 'objectprops',
                style:['column']
            },
            {
                name: 'strategyType',
                text: 'Strategy Type',
                source: ['spec.strategy.type'],
                format: 'string',
            },
            {
                name: 'status',
                text: 'Status',
                source: ['#'],
                format: 'string',
                style: ['running:green']
            },
            conditions
        ]
    },
    {
        name: 'pods',
        text: 'Pods',
        items: [
            {
                name: 'pods',
                text: 'Pods',
                source: ['#'],
                //invoke: () => { return ['aa',`bb`]},
                format: 'objectlist',
                style: ['table'],
                content: [
                    {
                        name: 'name',
                        text: 'Name',
                        source: ['#metadata.name'],
                        format: 'string',
                        style: ['link:$Pod:metadata.name']
                    },
                    {
                        name: 'node',
                        text: 'Node',
                        source: ['#spec.nodeName'],
                        format: 'string',
                        style: ['link:$Node:spec.nodeName']
                    }
                ]
            }
        ]
    }

])

objectSections.set('DaemonSet', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'selector',
                text: 'Selector',
                source: ['spec.selector.matchLabels'],
                format: 'objectprops',
                style:['column']
            },
            {
                name: 'images',
                text: 'Images',
                source: ['spec.template.spec.containers'],
                format: 'objectlist',
                content: [
                    {
                        name: 'image',
                        text: '',
                        source: ['image'],
                        format: 'string'
                    },
                ],
                style:['column']
            },
            {
                name: 'strategy',
                text: 'Strategy',
                source: ['spec.updateStrategy.type'],
                format: 'string',
            },
            {
                name: 'tolerations',
                text: 'Tolerations',
                source: ['spec.template.spec.tolerations'],
                format: 'objectlist',
                content: [
                    {
                        name: 'key',
                        text: 'Key',
                        source: ['key'],
                        format: 'string'
                    },
                    {
                        name: 'operator',
                        text: 'Operator',
                        source: ['operator'],
                        format: 'string'
                    },
                    {
                        name: 'effect',
                        text: 'Effect',
                        source: ['effect'],
                        format: 'string'
                    },
                ],
                style:['table']
            },
        ]
    },
    {
        name: 'pods',
        text: 'Pods',
        items: [
            {
                name: 'pods',
                text: 'Pods',
                source: ['#'],
                //invoke: () => { return ['aa',`bb`]},
                format: 'objectlist',
                style: ['table'],
                content: [
                    {
                        name: 'name',
                        text: 'Name',
                        source: ['#metadata.name'],
                        format: 'string',
                        style: ['link:$Pod:metadata.name']
                    },
                    {
                        name: 'node',
                        text: 'Node',
                        source: ['#spec.nodeName'],
                        format: 'string',
                        style: ['link:$Node:spec.nodeName']
                    }
                ]
            }
        ]
    }

])

objectSections.set('ReplicaSet', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'controlledby',
                text: 'Controlled By',
                source: ['metadata.ownerReferences.0.kind', '$\u00A0', '#metadata.ownerReferences.0.name'],
                format: 'string',
                style: ['link:metadata.ownerReferences.0.kind:metadata.ownerReferences.0.name']
            },
            {
                name: 'images',
                text: 'Images',
                source: ['spec.template.spec.containers'],
                format: 'objectlist',
                content: [
                    {
                        name: 'image',
                        text: '',
                        source: ['image'],
                        format: 'string'
                    },
                ],
                style:['column']
            },
            {
                name: 'replicas',
                text: 'Replicas',
                source: ['status.readyReplicas', '$\u00A0/\u00A0', 'spec.replicas'],
                format: 'string',
            },
        ]
    },
    {
        name: 'pods',
        text: 'Pods',
        items: [
            {
                name: 'pods',
                text: 'Pods',
                source: ['#'],
                //invoke: () => { return ['aa',`bb`]},
                format: 'objectlist',
                style: ['table'],
                content: [
                    {
                        name: 'name',
                        text: 'Name',
                        source: ['#metadata.name'],
                        format: 'string',
                        style: ['link:$Pod:metadata.name']
                    },
                    {
                        name: 'node',
                        text: 'Node',
                        source: ['#spec.nodeName'],
                        format: 'string',
                        style: ['link:$Node:spec.nodeName']
                    }
                ]
            }
        ]
    }

])

objectSections.set('StatefulSet', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'controlledby',
                text: 'Controlled By',
                source: ['metadata.ownerReferences.0.kind', '$\u00A0', '#metadata.ownerReferences.0.name'],
                format: 'string',
                style: ['link:metadata.ownerReferences.0.kind:metadata.ownerReferences.0.name']
            }
        ]
    }
])

objectSections.set('Job', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'selector',
                text: 'Selector',
                source: ['spec.selector.matchLabels'],
                format: 'objectprops',
            },
            {
                name: 'nodeSelector',
                text: 'Node Selector',
                source: ['spec.template.spec.nodeSelector'],
                format: 'objectprops',
                style: ['ifpresent']
            },
            {
                name: 'images',
                text: 'Images',
                source: ['spec.template.spec.containers'],
                format: 'objectlist',
                content: [
                    {
                        name: 'image',
                        text: '',
                        source: ['image'],
                        format: 'string'
                    },
                ],
                style:['column']
            },
            conditions,
            {
                name: 'completions',
                text: 'Completions',
                source: ['spec.completions'],
                format: 'string',
            },
            {
                name: 'parallelism',
                text: 'Parallelism',
                source: ['spec.parallelism'],
                format: 'string',
            },
        ]
    },
])

objectSections.set('CronJob', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'schedule',
                text: 'Schedule',
                source: ['spec.schedule'],
                format: 'string',
            },
            {
                name: 'suspend',
                text: 'Suspend',
                source: ['spec.suspend'],
                format: 'string',
                style: ['ifpresent']
            },
            {
                name: 'lastSchedule',
                text: 'Last Schedule',
                source: ['status.lastScheduleTime'],
                format: 'string',
                style: ['ifpresent']
            },
            {
                name: 'lastSuccessful',
                text: 'Last Success',
                source: ['status.lastSuccessfulTime'],
                format: 'string',
                style: ['ifpresent']
            },
        ]
    },
    {
        name: 'history',
        text: 'History',
        items: [
            {
                name: 'jobs',
                text: 'Jobs',
                source: ['#'],
                //invoke: () => { return ['aa',`bb`]},
                format: 'objectlist',
                style: ['table'],
                content: [
                    {
                        name: 'name',
                        text: 'Name',
                        source: ['#metadata.name'],
                        format: 'string',
                        style: ['link:$Job:metadata.name']
                    },
                    {
                        name: 'age',
                        text: 'Age',
                        source: ['status.startTime'],
                        format: 'age',
                    }
                ]
            }
        ]
    }

])

objectSections.set('ServiceAccount', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicCluster,
            {
                name: 'tokens',
                text: 'Tokens',
                source: ['#'],
                //invoke: () => { return ['aa',`bb`]},
                format: 'stringlist',
                style: ['column', 'char:30', 'ifpresent']
            },
        ]
    }
])

objectSections.set('ClusterRole', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicCluster
        ]
    },
    {
        name: 'rules',
        text: 'Rules',
        items: [
            {
                name: 'rules',
                text: 'Rules',
                source: ['rules'],
                format: 'objectlist',
                content: [
                    {
                        name: 'verbs',
                        text: 'Verbs',  
                        source: ['verbs'],
                        format: 'stringlist',
                        style: ['column']
                    },
                    {
                        name: 'apiGroups',
                        text: 'API Groups',  
                        source: ['apiGroups'],
                        format: 'stringlist',
                        style: ['column']
                    },
                    {
                        name: 'resources',
                        text: 'Resources',
                        source: ['resources'],
                        format: 'stringlist',
                        style: ['column']
                    },
                ],
                style: ['table']
            },
        ]
    }
])

objectSections.set('Role', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced
        ]
    },
    {
        name: 'rules',
        text: 'Rules',
        items: [
            {
                name: 'rules',
                text: 'Rules',
                source: ['rules'],
                format: 'objectlist',
                content: [
                    {
                        name: 'verbs',
                        text: 'Verbs',  
                        source: ['verbs'],
                        format: 'stringlist',
                        style: ['column']
                    },
                    {
                        name: 'apiGroups',
                        text: 'API Groups',  
                        source: ['apiGroups'],
                        format: 'stringlist',
                        style: ['column']
                    },
                    {
                        name: 'resources',
                        text: 'Resources',
                        source: ['resources'],
                        format: 'stringlist',
                        style: ['column']
                    },
                ],
                style: ['table']
            },
        ]
    }
])

objectSections.set('ClusterRoleBinding', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicCluster
        ]
    },
    {
        name: 'reference',
        text: 'Reference',
        items: [
            {
                name: 'kind',
                text: 'Kind',
                source: ['roleRef.kind'],
                format: 'string'
            },
            {
                name: 'name',
                text: 'Name',
                source: ['roleRef.name'],
                format: 'string'
            },
            {
                name: 'apiGroup',
                text: 'API Group',
                source: ['roleRef.apiGroup'],
                format: 'string'
            },
        ]
    },
    {
        name: 'subjects',
        text: 'Subjects',
        items: [
            {
                name: 'bindings',
                text: 'Bindings',
                source: ['subjects'],
                format: 'objectlist',
                content: [
                    {
                        name: 'kind',
                        text: 'Kind',
                        source: ['kind'],
                        format: 'string'
                    },
                    {
                        name: 'name',
                        text: 'Name',
                        source: ['name'],
                        format: 'string'
                    },
                    {
                        name: 'namespace',
                        text: 'Namespace',
                        source: ['#namespace'],
                        format: 'string',
                        style: ['link:$Namespace:namespace']
                    }
                ],
                style: ['table']
            },
        ]
    }
])

objectSections.set('RoleBinding', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
        ]
    },
    {
        name: 'reference',
        text: 'Reference',
        items: [
            {
                name: 'kind',
                text: 'Kind',
                source: ['roleRef.kind'],
                format: 'string'
            },
            {
                name: 'name',
                text: 'Name',
                source: ['roleRef.name'],
                format: 'string'
            },
            {
                name: 'apiGroup',
                text: 'API Group',
                source: ['roleRef.apiGroup'],
                format: 'string'
            },
        ]
    },
    {
        name: 'subjects',
        text: 'Subjects',
        items: [
            {
                name: 'bindings',
                text: 'Bindings',
                source: ['subjects'],
                format: 'objectlist',
                content: [
                    {
                        name: 'kind',
                        text: 'Kind',
                        source: ['kind'],
                        format: 'string'
                    },                    
                    {
                        name: 'name',
                        text: 'Name',
                        source: ['name'],
                        format: 'string'
                    },                    
                    {
                        name: 'namespace',
                        text: 'Namespace',
                        source: ['#namespace'],
                        format: 'string',
                        style: ['link:$Namespace:namespace']
                    },                    
                ],
                style: ['table']
            },
        ]
    }
])

objectSections.set('ResourceQuota', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
        ]
    },
    {
        name: 'quotas',
        text: 'Quotas',
        items: [
            {
                name: 'limitcpu',
                text: 'Limit CPU',
                source: ['status.used[\'limits.cpu\']','status.hard[\'limits.cpu\']'],
                format: 'bar',
                style: ['ifpresent']
            },
            {
                name: 'limitmemory',
                text: 'Limit Memory',
                source: ['status.used[\'limits.memory\']','status.hard[\'limits.memory\']'],
                format: 'bar',
                style: ['ifpresent']
            },
            {
                name: 'requestcpu',
                text: 'Request CPU',
                source: ['status.used[\'requests.cpu\']','status.hard[\'requests.cpu\']'],
                format: 'bar',
                style: ['ifpresent']
            },
            {
                name: 'requestmemory',
                text: 'Request Memory',
                source: ['status.used[\'requests.memory\']','status.hard[\'requests.memory\']'],
                format: 'bar',
                style: ['ifpresent']
            },
            {
                name: 'pods',
                text: 'Pods',
                source: ['status.used[\'count/pods\']','status.hard[\'count/pods\']'],
                format: 'bar',
                style: ['ifpresent']
            },
            {
                name: 'persistentvolumeclaims',
                text: 'PVCs',
                source: ['status.used[\'count/persistentvolumeclaims\']','status.hard[\'count/persistentvolumeclaims\']'],
                format: 'bar',
                style: ['ifpresent']
            },
            {
                name: 'services',
                text: 'Services',
                source: ['status.used[\'count/services\']','status.hard[\'count/services\']'],
                format: 'bar',
                style: ['ifpresent']
            },
            {
                name: 'configmaps',
                text: 'ConfigMaps',
                source: ['status.used[\'count/configmaps\']','status.hard[\'count/configmaps\']'],
                format: 'bar',
                style: ['ifpresent']
            },
            {
                name: 'secrets',
                text: 'Secrets',
                source: ['status.used[\'count/secrets\']','status.hard[\'count/secrets\']'],
                format: 'bar',
                style: ['ifpresent']
            },
        ]
    },
])

objectSections.set('CustomResourceDefinition', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicCluster,
            {
                name: 'group',
                text: 'Group',
                source: ['spec.group'],
                format: 'string',
            },
            {
                name: 'versions',
                text: 'Versions',
                source: ['spec.versions'],
                format: 'objectlist',
                style: ['table'],
                content: [
                    {
                        name: 'name',
                        text: 'Name',
                        source: ['name'],
                        format: 'string',
                    },
                    {
                        name: 'served',
                        text: 'Served',
                        source: ['served'],
                        format: 'boolean',
                    },
                    {
                        name: 'storage',
                        text: 'Storage',
                        source: ['storage'],
                        format: 'boolean',
                    },
                ]
            },
            conditions
        ]
    },
    {
        name: 'names',
        text: 'Names',
        items: [
            {
                name: 'singular',
                text: 'Singular',
                source: ['spec.names.singular'],
                format: 'string',
            },
            {
                name: 'plural',
                text: 'Plural',
                source: ['spec.names.plural'],
                format: 'string',
            },
            {
                name: 'kind',
                text: 'Kind',
                source: ['spec.names.kind'],
                format: 'string',
            },
            {
                name: 'listKind',
                text: 'List Kind',
                source: ['spec.names.listKind'],
                format: 'string',
            },
        ]
    }
])

objectSections.set('#crdinstance#', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            ...basicNamespaced,
            {
                name: 'source',
                text: 'Source',
                source: ['spec.source'],
                format: 'string',
            },
            {
                name: 'checksum',
                text: 'checksum',
                source: ['spec.checksum'],
                format: 'string',
                style: ['char:80']
            },
        ]
    },
])
