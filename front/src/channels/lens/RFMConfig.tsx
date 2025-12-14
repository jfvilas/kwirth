import { ISpace } from "@jfvilas/react-file-manager"
import { Add, BarChart, Delete, Edit, Info, PauseCircle, StopCircle, Subject, Terminal } from "@mui/icons-material"

const spaces=new Map<string, ISpace>()

const menu = [
    {   name: "Overview",
        isDirectory: true,
        path: "/overview",
        class: 'classmenu',
        layout: 'own',   
        //children: showOverview+++
    },



    // Cluster
    {   name: "Cluster",
        isDirectory: true,
        path: "/cluster",
        class: 'classmenu'
    },
    {   name: "Node",
        isDirectory: true,
        path: "/cluster/node",
        class: 'classmenu',
        children: 'node'
    },
    {   name: "Namespace",
        isDirectory: true,
        path: "/cluster/namespace",
        class: 'classnamespace',
        children: 'namespace'
    },



    // Network
    {   name: "Network",
        isDirectory: true,
        path: "/network",
        class: 'classmenu'
    },
    {   name: "Service",
        isDirectory: true,
        path: "/network/service",
        layout: 'list',  
        class: 'classservice',
        children: 'service'
    },
    {   name: "Ingress",
        isDirectory: true,
        path: "/network/ingress",
        layout: 'list',  
        class: 'classingress',
        children: 'ingress'
    },



    // Workload
    {   name: "Workload",
        isDirectory: true,
        path: "/workload",
        class: 'classmenu'
    },
    {   name: "Overview",
        isDirectory: true,
        path: "/workload/overview",
        class: 'classmenu',
        layout: 'own',   
        //children: showWorkloadOverview+++
    },
    {   name: "Pod",
        isDirectory: true,
        path: "/workload/pod",
        layout: 'list',  
        class: 'classpod',
        children: 'pod'
    },
    {   name: "Deployment",
        isDirectory: true,
        path: "/workload/deployment",
        class: 'classmenu',
        children: 'deployment'
    },
    {   name: "Daemon Set",
        isDirectory: true,
        path: "/workload/daemonset",
        class: 'classmenu',
        children: 'daemonset'
    },
    {   name: "Replica Set",
        isDirectory: true,
        path: "/workload/replicaset",
        class: 'classmenu',
        children: 'replicaset'
    },
    {   name: "Stateful Set",
        isDirectory: true,
        path: "/workload/statefulset",
        class: 'classmenu',
        children: 'statefulset'
    },



    //Config
    {   name: "Config",
        isDirectory: true,
        path: "/config",
        class: 'classmenu'
    },
    {   name: "Config Map",
        isDirectory: true,
        path: "/config/configmap",
        class: 'classconfigmap',
        children: 'configmap'
    },
    {   name: "Secret",
        isDirectory: true,
        path: "/config/secret",
        class: 'classmenu',
        children: 'secret'
    },


    //Storage
    {   name: "Storage",
        isDirectory: true,
        path: "/storage",
        class: 'classmenu'
    },
    {   name: "Persistent volume claims",
        isDirectory: true,
        path: "/storage/persistentvolumeclaim",
        class: 'classpersistentvolumeclaim',
        children: 'persistentvolumeclaim'
    },
    {   name: "Persistent volumes",
        isDirectory: true,
        path: "/storage/persistentvolume",
        class: 'classpersistentvolume',
        children: 'persistentvolume'
    },
    {   name: "Storage classes",
        isDirectory: true,
        path: "/storage/storageclass",
        class: 'classstorageclass',
        children: 'storageclass'
    },


    //Storage
    {   name: "Access",
        isDirectory: true,
        path: "/access",
        class: 'classmenu'
    },
    {   name: "Service accounts",
        isDirectory: true,
        path: "/access/serviceaccount",
        class: 'classserviceaccount',
        children: 'serviceaccount'
    },
    {   name: "Cluster roles",
        isDirectory: true,
        path: "/access/clusterrole",
        class: 'classclusterrole',
        children: 'clusterrole'
    },
    {   name: "Roles",
        isDirectory: true,
        path: "/access/role",
        class: 'classrole',
        children: 'role'
    },
    {   name: "Cluster role bindings",
        isDirectory: true,
        path: "/access/clusterrolebinding",
        class: 'classclusterrolebinding',
        children: 'clusterrolebinding'
    },
    {   name: "Role bindings",
        isDirectory: true,
        path: "/access/rolebinding",
        class: 'classrolebinding',
        children: 'rolebinding'
    },
]

// General
spaces.set('classmenu',
    {
    }
)

// Network
spaces.set('classservice',
    {
        leftItems: [
            {
                name:'create',
                icon: <Add fontSize="small"/>,
                text: 'New service',
                permission: true,
                //onClick: () => {}
            }
        ]
    }
)
spaces.set('classingress',
    {
        leftItems: [
            {
                name: 'create',
                icon: <Add fontSize="small"/>,
                text: 'New ingress',
                permission: true,
            }
        ]
    }
)
spaces.set('ingress',
    {
        text:'Name',
        source:'name',
        width:40,
        leftItems: [
            {
                name: 'details',
                icon: <Info fontSize="small"/>,
                text: 'Details',
                permission: true,
            },
            {
                name: 'delete',
                icon: <Delete fontSize="small"/>,
                text: 'Delete',
                multi: true,
                permission: true,
            },
            {
                name: 'edit',
                icon: <Edit fontSize="small"/>,
                text: 'Edit',
                permission: true,
            }
        ],
        properties: [
            {
                name: 'namespace',
                text: 'Namespace',
                source: 'namespace',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'loadBalancers',
                text: 'LoadBalancers',
                source: 'loadBalancers',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'rules',
                text: 'Rules',
                source: 'rules',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'creationTimestamp',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 10,
                visible: true
            },
        ]
    }
)
spaces.set('service',
    {
        text:'Service name',
        source:'name',
        width:40,
        leftItems: [
            {
                name: 'details',
                icon: <Info fontSize="small"/>,
                text: 'Details',
                permission: true,
            },
            {
                name: 'delete',
                icon: <Delete fontSize="small"/>,
                text: 'Delete',
                multi: true,
                permission: true,
            },
            {
                name: 'edit',
                icon: <Edit fontSize="small"/>,
                text: 'Edit service',
                permission: true,
            }
        ],
        properties: [
            {
                name: 'namespace',
                text: 'Namespace',
                source: 'namespace',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'type',
                text: 'Type',
                source: 'type',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'clusterIp',
                text: 'ClusterIP',
                source: 'clusterIp',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'ports',
                text: 'Ports',
                source: 'ports',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'externalIp',
                text: 'ExternalIP',
                source: 'externalIp',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'selector',
                text: 'Selector',
                source: 'selector',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'creationTimestamp',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 10,
                visible: true
            }
        ]
    }
)

// Config
spaces.set('classconfigmap',
    {
        leftItems: [
            {
                icon: <Add fontSize="small"/>,
                text: 'Create',
                permission: true
            }
        ]
    }
)
spaces.set('classsecret',
    {
        leftItems: [
            {
                icon: <Add fontSize="small"/>,
                text: 'Create',
                permission: true
            }
        ]
    }
)
spaces.set('configmap',
    {
        text:'Config Map name',
        source:'name',
        width:35,
        leftItems: [
            {
                name:'details',
                icon: <Info fontSize='small'/>,
                text: 'Details',
                multi: true,
                permission: true,
            },
            {
                name: 'edit',
                icon: <Edit fontSize='small'/>,
                text: 'Edit',
                permission: true,
            },
            {
                name: 'delete',
                icon: <Delete fontSize='small'/>,
                text: 'Delete',
                multi: true,
                permission: true,
            }
        ],
        properties: [
            {
                name: 'namespace',
                text: 'Namespace',
                source: 'namespace',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'keys',
                text: 'Keys',
                source: 'keys',
                format: 'string',
                width: 40,
                visible: true
            },
            {
                name: 'creationTimestamp',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 10,
                visible: true
            }
        ]
    }
)
spaces.set('secret',
    {
        text:'Secret name',
        source:'name',
        width:40,
        leftItems: [
            {
                name:'details',
                icon: <Info fontSize='small'/>,
                text: 'Details',
                multi: true,
                permission: true,
            },
            {
                name: 'edit',
                icon: <Edit fontSize='small'/>,
                text: 'Edit',
                permission: true,
            },
            {
                name: 'delete',
                icon: <Delete fontSize='small'/>,
                text: 'Delete',
                multi: true,
                permission: true,
            }
        ],
        properties: [
            {
                name: 'namespace',
                text: 'Namespace',
                source: 'namespace',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'type',
                text: 'Type',
                source: 'type',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'keys',
                text: 'Keys',
                source: 'keys',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'creationTimestamp',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 15,
                visible: true
            }
        ]
    }
)

// Cluster
spaces.set('classnamespace',
    {
        leftItems: [
            {
                name:'create',
                icon: <Add fontSize="small"/>,
                text: 'New namespace',
                permission: true,
            }
        ]
    }
)
spaces.set('namespace',
    {
        text:'Name',
        source:'name',
        width:40,
        leftItems: [
            {
                name: 'details',
                icon: <Info fontSize="small"/>,
                text: 'Details',
                permission: true,
            },
            {
                name: 'delete',
                icon: <Delete fontSize="small"/>,
                text: 'Delete',
                multi: true,
                permission: true,
            },
            {
                name: 'edit',
                icon: <Edit fontSize="small"/>,
                text: 'Edit',
                permission: true,
            }
        ],
        properties: [
            {
                name: 'labels',
                text: 'Labels',
                source: 'labels',
                format: 'string',
                width: 30,
                visible: true
            },
            {
                name: 'creationTimestamp',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 15,
                visible: true
            },
            {
                name: 'status',
                text: 'Status',
                source: 'status',
                format: 'string',
                width: 15,
                visible: true
            }
        ]
    }
)
spaces.set('node',
    {
        text:'Name',
        source:'name',
        width:40,
        leftItems: [
            {
                name:'details',
                icon: <Info fontSize="small"/>,
                text: 'Details',
                multi: true,
                permission: true,
            },
            {
                name: 'cordon',
                icon: <PauseCircle fontSize='small' />,
                text: 'Cordon',
                multi: true,
                permission: true,
            },
            {
                name: 'drain',
                icon: <StopCircle fontSize='small' />,
                text: 'Drain',
                multi: true,
                permission: true,
            },
            {
                icon: <Edit fontSize="small"/>,
                text: 'Edit',
                permission: true,
            },
            {
                icon: <Delete fontSize="small"/>,
                text: 'Delete',
                multi: true,
                permission: true,
            },
        ],
        properties: [
            {
                name: 'taints',
                text: 'Taints',
                source: 'taints',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'roles',
                text: 'Roles',
                source: 'roles',
                format: 'string',
                width: 30,
                visible: true
            },
            {
                name: 'version',
                text: 'Version',
                source: 'version',
                format: 'string',
                width: 10,
                visible: true
            },
            {
                name: 'age',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 10,
                visible: true
            },
        ]
    }
)

// Workload
spaces.set('classpod',
    {
        leftItems: [
            {
                icon: <Add fontSize="small"/>,
                text: 'New pod',
                permission: true,
                onClick: () => console.log('create pod'),
            }
        ]
    }
)
spaces.set('pod',
    {
        text:'Name',
        source:'name',
        width:25,
        leftItems: [
            {
                name:'details',
                text: 'Pod details',
                icon: <Info fontSize="small"/>,
                multi: false,
                permission: true,
            },
            {
                icon: <Terminal fontSize="small"/>,
                text: 'Shell',
                permission: true,
                onClick: () => console.log('shell'),
            },
            {
                name:'viewlog',
                text: 'Log',
                icon: <Subject fontSize="small"/>,
                multi: false,
                permission: true,
            },
            {
                icon: <BarChart fontSize="small"/>,
                text: 'Metrics',
                multi: true,
                permission: true,
                onClick: () => console.log('metr'),
            },
            {
                icon: <Delete fontSize="small"/>,
                text: 'Delete pod',
                multi: true,
                permission: true,
                onClick: () => console.log('delete pod'),
            },
            {
                icon: <>{'E'}</>,
                text: 'Evict',
                permission: true,
                onClick: () => console.log('evit'),
            }
        ],
        properties: [
            {
                name: 'namespace',
                text: 'Namespace',
                source: 'namespace',
                format: 'string',
                width: 10,
                visible: true
            },
            {
                name: 'container',
                text: 'Container',
                //source: showPodContainers, +++
                source: 'na',
                format: 'function',
                width: 10,
                visible: true
            },
            {
                name: 'cpu',
                text: 'CPU',
                //source: showPodCpu,+++
                source: 'na',
                format: 'function',
                width: 10,
                visible: true
            },
            {
                name: 'memory',
                text: 'Memory',
                //source: showPodMemory,+++
                source: 'na',
                format: 'function',
                width: 10,
                visible: true
            },
            {
                name: 'restarts',
                text: 'Restarts',
                source: 'restartCount',
                format: 'number',
                width: 5,
                visible: true
            },
            {
                name: 'controller',
                text: 'Controller',
                source: 'controller',
                format: 'string',
                width: 10,
                visible: true
            },
            {
                name: 'node',
                text: 'Node',
                source: 'node',
                format: 'string',
                width: 10,
                visible: true
            },
            {
                name: 'age',
                text: 'Age',
                source: 'startTime',
                format: 'age',
                width: 5,
                visible: true
            },
            {
                name: 'status',
                text: 'Status',
                source: 'status',
                format: 'string',
                width: 5,
                visible: true
            }
        ]
    }
)
spaces.set('deployment',
    {
        text:'Name',
        source:'name',
        width:30,
        leftItems: [
            {
                name:'edit',
                text: 'Edit',
                icon: <Edit fontSize="small"/>,
                multi: false,
                permission: true,
            },
        ],
        properties: [
            {
                name: 'namespace',
                text: 'Namespace',
                source: 'namespace',
                format: 'string',
                width: 20,
                visible: true
            },
            {
                name: 'pods',
                text: 'Pods',
                source: 'pods',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'replicas',
                text: 'Replicas',
                source: 'replicas',
                format: 'number',
                width: 15,
                visible: true
            },
            {
                name: 'age',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 10,
                visible: true
            },
            {
                name: 'status',
                text: 'Status',
                source: 'status',
                format: 'string',
                width: 10,
                visible: true
            }
        ]
    }
)
spaces.set('daemonset',
    {
        text:'Name',
        source:'name',
        width:25,
        leftItems: [],
        properties: [
            {
                name: 'namespace',
                text: 'Namespace',
                source: 'namespace',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'desired',
                text: 'Desired',
                source: 'desired',
                format: 'number',
                width: 8,
                visible: true
            },
            {
                name: 'current',
                text: 'Current',
                source: 'current',
                format: 'number',
                width: 8,
                visible: true
            },
            {
                name: 'ready',
                text: 'Ready',
                source: 'ready',
                format: 'number',
                width: 8,
                visible: true
            },
            {
                name: 'upToDate',
                text: 'Up-to-Date',
                source: 'upToDate',
                format: 'number',
                width: 8,
                visible: true
            },
            {
                name: 'available',
                text: 'Available',
                source: 'available',
                format: 'number',
                width: 8,
                visible: true
            },
            {
                name: 'nodeSelector',
                text: 'Node Selector',
                source: 'nodeSelector',
                format: 'string',
                width: 10,
                visible: true
            },
            {
                name: 'age',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 10,
                visible: true
            },
        ]
    }
)
spaces.set('replicaset',
    {
        text:'Name',
        source:'name',
        width:30,
        leftItems: [],
        properties: [
            {
                name: 'namespace',
                text: 'Namespace',
                source: 'namespace',
                format: 'string',
                width: 20,
                visible: true
            },
            {
                name: 'desired',
                text: 'Desired',
                source: 'desired',
                format: 'number',
                width: 10,
                visible: true
            },
            {
                name: 'current',
                text: 'Current',
                source: 'current',
                format: 'number',
                width: 10,
                visible: true
            },
            {
                name: 'ready',
                text: 'Ready',
                source: 'ready',
                format: 'number',
                width: 10,
                visible: true
            },
            {
                name: 'age',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 20,
                visible: true
            },
        ]
    }
)
spaces.set('statefulset',
    {
        text:'Name',
        source:'name',
        width:25,
        leftItems: [],
        properties: [
            {
                name: 'namespace',
                text: 'Namespace',
                source: 'namespace',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'pods',
                text: 'Pods',
                source: 'pods',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'replicas',
                text: 'Replicas',
                source: 'replicas',
                format: 'number',
                width: 15,
                visible: true
            },
            {
                name: 'age',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 20,
                visible: true
            },
        ]
    }
)

// Storage
spaces.set('classstorageclass',
    {
        leftItems: [
            {
                name: 'create',
                icon: <Add fontSize="small"/>,
                text: 'New storage class',
                permission: true,
            }
        ]
    }
)
spaces.set('storageclass',
    {
        text:'Name',
        source:'name',
        width:40,
        leftItems: [
            {   name: 'details',
                icon: <Info fontSize="small"/>,
                text: 'Details',
                permission: true,
            },
            {   name: 'delete',
                icon: <Delete fontSize="small"/>,
                text: 'Delete',
                multi: true,
                permission: true,
            },
            {   name: 'edit',
                icon: <Edit fontSize="small"/>,
                text: 'Edit',
                permission: true,
            }
        ],
        properties: [
            {
                name: 'provisioner',
                text: 'Provisioner',
                source: 'provisioner',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'reclaimPolicy',
                text: 'Reclaim policy',
                source: 'reclaimPolicy',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'default',
                text: 'Default',
                source: 'default',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'creationTimestamp',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 10,
                visible: true
            }
        ]
    }
)
spaces.set('classpersistentvolumeclaim',
    {
        leftItems: [
            {
                name: 'create',
                icon: <Add fontSize="small"/>,
                text: 'New PVC',
                permission: true,
            }
        ]
    }
)
spaces.set('persistentvolumeclaim',
    {
        text:'Name',
        source:'name',
        width:40,
        leftItems: [
            {   name: 'details',
                icon: <Info fontSize="small"/>,
                text: 'Details',
                permission: true,
            },
            {   name: 'delete',
                icon: <Delete fontSize="small"/>,
                text: 'Delete',
                multi: true,
                permission: true,
            },
            {   name: 'edit',
                icon: <Edit fontSize="small"/>,
                text: 'Edit',
                permission: true,
            }
        ],
        properties: [
            {
                name: 'namespace',
                text: 'Namespace',
                source: 'namespace',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'storageClass',
                text: 'Storage class',
                source: 'storageClass',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'size',
                text: 'Size',
                source: 'size',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'pods',
                text: 'Pods',
                source: 'pods',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'creationTimestamp',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 10,
                visible: true
            },
            {
                name: 'status',
                text: 'Status',
                source: 'status',
                format: 'string',
                width: 15,
                visible: true
            },
        ]
    }
)
spaces.set('classpersistentvolume',
    {
        leftItems: [
            {
                name: 'create',
                icon: <Add fontSize="small"/>,
                text: 'New PV',
                permission: true,
            }
        ]
    }
)
spaces.set('persistentvolume',
    {
        text:'Name',
        source:'name',
        width:40,
        leftItems: [
            {   name: 'details',
                icon: <Info fontSize="small"/>,
                text: 'Details',
                permission: true,
            },
            {   name: 'delete',
                icon: <Delete fontSize="small"/>,
                text: 'Delete',
                multi: true,
                permission: true,
            },
            {   name: 'edit',
                icon: <Edit fontSize="small"/>,
                text: 'Edit',
                permission: true,
            }
        ],
        properties: [
            {
                name: 'storageClass',
                text: 'Storage class',
                source: 'storageClass',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'capacity',
                text: 'Capacity',
                source: 'capacity',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'clain',
                text: 'Claim',
                source: 'claim',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'creationTimestamp',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 10,
                visible: true
            },
            {
                name: 'status',
                text: 'Status',
                source: 'status',
                format: 'string',
                width: 15,
                visible: true
            },
        ]
    }
)

// Access
spaces.set('classserviceaccount',
    {
        leftItems: [
            {
                name: 'create',
                icon: <Add fontSize="small"/>,
                text: 'Create',
                permission: true,
            }
        ]
    }
)
spaces.set('serviceaccount',
    {
        text:'Name',
        source:'name',
        width:40,
        leftItems: [
            {   name: 'details',
                icon: <Info fontSize="small"/>,
                text: 'Details',
                permission: true,
            },
            {   name: 'delete',
                icon: <Delete fontSize="small"/>,
                text: 'Delete',
                multi: true,
                permission: true,
            },
            {   name: 'edit',
                icon: <Edit fontSize="small"/>,
                text: 'Edit',
                permission: true,
            }
        ],
        properties: [
            {
                name: 'namespace',
                text: 'Namespace',
                source: 'namespace',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'creationTimestamp',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 10,
                visible: true
            }
        ]
    }
)
spaces.set('classclusterrole',
    {
        leftItems: [
            {
                name: 'create',
                icon: <Add fontSize="small"/>,
                text: 'Create',
                permission: true,
            }
        ]
    }
)
spaces.set('clusterrole',
    {
        text:'Name',
        source:'name',
        width:40,
        leftItems: [
            {   name: 'details',
                icon: <Info fontSize="small"/>,
                text: 'Details',
                permission: true,
            },
            {   name: 'delete',
                icon: <Delete fontSize="small"/>,
                text: 'Delete',
                multi: true,
                permission: true,
            },
            {   name: 'edit',
                icon: <Edit fontSize="small"/>,
                text: 'Edit',
                permission: true,
            }
        ],
        properties: [
            {
                name: 'creationTimestamp',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 10,
                visible: true
            }
        ]
    }
)
spaces.set('classrole',
    {
        leftItems: [
            {
                name: 'create',
                icon: <Add fontSize="small"/>,
                text: 'Create',
                permission: true,
            }
        ]
    }
)
spaces.set('role',
    {
        text:'Name',
        source:'name',
        width:40,
        leftItems: [
            {   name: 'details',
                icon: <Info fontSize="small"/>,
                text: 'Details',
                permission: true,
            },
            {   name: 'delete',
                icon: <Delete fontSize="small"/>,
                text: 'Delete',
                multi: true,
                permission: true,
            },
            {   name: 'edit',
                icon: <Edit fontSize="small"/>,
                text: 'Edit',
                permission: true,
            }
        ],
        properties: [
            {
                name: 'namespace',
                text: 'Namespace',
                source: 'namespace',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'creationTimestamp',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 10,
                visible: true
            }
        ]
    }
)
spaces.set('classclusterrolebinding',
    {
        leftItems: [
            {
                name: 'create',
                icon: <Add fontSize="small"/>,
                text: 'Create',
                permission: true,
            }
        ]
    }
)
spaces.set('clusterrolebinding',
    {
        text:'Name',
        source:'name',
        width:40,
        leftItems: [
            {   name: 'details',
                icon: <Info fontSize="small"/>,
                text: 'Details',
                permission: true,
            },
            {   name: 'delete',
                icon: <Delete fontSize="small"/>,
                text: 'Delete',
                multi: true,
                permission: true,
            },
            {   name: 'edit',
                icon: <Edit fontSize="small"/>,
                text: 'Edit',
                permission: true,
            }
        ],
        properties: [
            {
                name: 'bindings',
                text: 'Bindings',
                source: 'bindings',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'creationTimestamp',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 10,
                visible: true
            }
        ]
    }
)
spaces.set('classrolebinding',
    {
        leftItems: [
            {
                name: 'create',
                icon: <Add fontSize="small"/>,
                text: 'Create',
                permission: true,
            }
        ]
    }
)
spaces.set('rolebinding',
    {
        text:'Name',
        source:'name',
        width:40,
        leftItems: [
            {   name: 'details',
                icon: <Info fontSize="small"/>,
                text: 'Details',
                permission: true,
            },
            {   name: 'delete',
                icon: <Delete fontSize="small"/>,
                text: 'Delete',
                multi: true,
                permission: true,
            },
            {   name: 'edit',
                icon: <Edit fontSize="small"/>,
                text: 'Edit',
                permission: true,
            }
        ],
        properties: [
            {
                name: 'namespace',
                text: 'Namespace',
                source: 'namespace',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'bindings',
                text: 'Bindings',
                source: 'bindings',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'creationTimestamp',
                text: 'Age',
                source: 'creationTimestamp',
                format: 'age',
                width: 10,
                visible: true
            }
        ]
    }
)

export { spaces, menu }