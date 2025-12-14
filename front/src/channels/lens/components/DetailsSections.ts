import { IDetailsSection } from "./ObjectDetails";

export const objectSections = new Map<string,IDetailsSection[]>()

objectSections.set('Ingress', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
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
                source: ['metadata.namespace'],
                format: 'string'
            },
            {
                name: 'labels',
                text: 'Labels',
                source: ['metadata.labels'],
                format: 'objectprops',
                style: ['column']
            },
            {
                name: 'annotations',
                text: 'Annotations',
                source: ['metadata.annotations'],
                format: 'objectprops',
                style: ['column']
            },
            {
                name: 'ingressClass',
                text: 'Ingress class',
                source: ['spec.ingressClassName'],
                format: 'string',
                style: ['bold']
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
                format: 'objectobject',
                content: [
                    {
                        name: 'host',
                        text: '',   // no text header => show property value as header
                        source: ['host'],
                        format: 'string',
                        style:['bold']
                    },
                    {
                        name: 'paths',
                        text: '',   // no text header => show property value as header
                        source: ['http.paths'],
                        format: 'objectobject',
                        content: [
                            {
                                name: 'path',
                                text: 'Path',   // no text header => show property value as header
                                source: ['path'],
                                format: 'string'
                            },
                            {
                                name: 'pathType',
                                text: 'Type',   // no text header => show property value as header
                                source: ['pathType'],
                                format: 'string'
                            },
                            {
                                name: 'backend',
                                text: 'Backend',
                                source: ['backend.service.name', '$:', 'backend.service.port.number'],
                                format: 'string'
                            }
                        ],
                        style: ['table']
                    }
                ],
                style: ['column']
            },
        ]
    }
])

objectSections.set('Service', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
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
                source: ['metadata.namespace'],
                format: 'string'
            },
            {
                name: 'labels',
                text: 'Labels',
                source: ['metadata.labels'],
                format: 'objectprops',
                style: ['column']
            },
            {
                name: 'annotations',
                text: 'Annotations',
                source: ['metadata.annotations'],
                format: 'objectprops',
                style: ['column']
            },
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

objectSections.set('Namespace', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
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
                style: ['column']
            },
            {
                name: 'annotations',
                text: 'Annotations',
                source: ['metadata.annotations'],
                format: 'objectprops',
                style: ['column']
            },
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
            {
                name: 'creation',
                text: 'Creation',
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
                style: ['column']
            },
            {
                name: 'annotations',
                text: 'Annotations',
                source: ['metadata.annotations'],
                format: 'objectprops',
                style: ['column']
            },
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
                text: 'Container runtime',
                source: ['status.nodeInfo.containerRuntimeVersion'],
                format: 'string',
            },
            {
                name: 'kubeletVersion',
                text: 'Kubelet version',
                source: ['status.nodeInfo.kubeletVersion'],
                format: 'string',
            },
            {
                name: 'conditions',
                text: 'Conditions',
                source: ['status.conditions'],
                format: 'objectlist',
                content: [
                    {
                        name: 'type',
                        text: 'Type',
                        source: ['type', '$\u00a0(', 'status', '$)'],
                        format: 'string',
                        style: ['False:red', 'True:green']
                    },
                ]
            },
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
            {
                name: 'name',
                text: 'Name',
                source: ['metadata.name'],
                format: 'string'
            },
            {
                name: 'namespace',
                text: 'Namespace',
                source: ['metadata.namespace'],
                format: 'string'
            },
            {
                name: 'labels',
                text: 'Labels',
                source: ['metadata.labels'],
                format: 'objectprops',
                style: ['column']
            },
            {
                name: 'annotations',
                text: 'Annotations',
                source: ['metadata.annotations'],
                format: 'objectprops',
                style: ['column']
            },
        ]
    },
    {
        name: 'data',
        text: 'Data',
        items: [
            {
                name: 'item',
                text: 'Item',
                source: ['data'],
                format: 'objectprops',
                style: ['column', 'edit', 'keybold']
            },
        ]
    },
])

objectSections.set('Pod', [
    {
        name: 'properties',
        text: 'Properties',
        items: [
            {
                name: 'name',
                text: 'Name',
                source: ['metadata.name'],
                format: 'string'
            },
            {
                name: 'namespace',
                text: 'Namespace',
                source: ['metadata.namespace'],
                format: 'string'
            },
            {
                name: 'labels',
                text: 'Labels',
                source: ['metadata.labels'],
                format: 'objectprops',
                style: ['column']
            },
            {
                name: 'annotations',
                text: 'Annotations',
                source: ['metadata.annotations'],
                format: 'objectprops',
                style: ['column']
            },
            {
                name: 'controlledby',
                text: 'Controlled By',
                source: ['metadata.ownerReferences.0.kind', '$\u00A0', 'metadata.ownerReferences.0.name'],
                format: 'string'
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
                source: ['spec.nodeName'],
                format: 'string'
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
                source: ['spec.serviceAccount'],
                format: 'string'
            },
            {
                name: 'qosclass',
                text: 'QoS Class',
                source: ['status.qosClass'],
                format: 'string'
            },
            {
                name: 'conditions',
                text: 'Conditions',
                source: ['status.conditions'],
                format: 'objectlist',
                content: [
                    {
                        name: 'type',
                        text: 'Type',
                        source: ['type'],
                        format: 'string'
                    },
                ]
            },
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
                text: 'Container',
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
                        style: ['edit', 'editline']
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
                        format: 'objectprops'
                    },
                    {
                        name: 'limits',
                        text: 'Limits',
                        source: ['resources.limits'],
                        format: 'objectprops'
                    },
                ],
                style: ['column']
            }
        ]
    },
])
