import { ISpace } from "@jfvilas/react-file-manager"
import { Add, BarChart, Delete, Edit, Info, PauseCircle, PlayCircle, StopCircle, Subject, Terminal } from "@mui/icons-material"
import { Cluster, Config, Customize, Kubernetes, Network, Pod, Security, Storage } from "./icons/Icons"

const spaces=new Map<string, ISpace>()

const menu = [
    {   name: "Overview",
        isDirectory: true,
        path: "/overview",
        class: 'classoverview',
        layout: 'own'
    },



    // Cluster
    {   name: "Cluster",
        isDirectory: true,
        path: "/cluster",
        class: 'classcluster'
    },
    {   name: "Overview",
        isDirectory: true,
        path: "/cluster/overview",
        class: 'classmenu',
        layout: 'own',   
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
        class: 'classnetwork'
    },
    {   name: "Overview",
        isDirectory: true,
        path: "/network/overview",
        class: 'classmenu',
        layout: 'own',   
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
    {   name: "Ingress class",
        isDirectory: true,
        path: "/network/ingressclass",
        layout: 'list',
        class: 'classingressclass',
        children: 'ingressclass'
    },



    // Workload
    {   name: "Workload",
        isDirectory: true,
        path: "/workload",
        class: 'classworkload'
    },
    {   name: "Overview",
        isDirectory: true,
        path: "/workload/overview",
        class: 'classmenu',
        layout: 'own',
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
    {   name: "Jobs",
        isDirectory: true,
        path: "/workload/job",
        class: 'classmenu',
        children: 'job'
    },
    {   name: "Cron jobs",
        isDirectory: true,
        path: "/workload/cronjob",
        class: 'classmenu',
        children: 'cronjob'
    },



    //Config
    {   name: "Config",
        isDirectory: true,
        path: "/config",
        class: 'classconfig'
    },
    {   name: "Overview",
        isDirectory: true,
        path: "/config/overview",
        class: 'classmenu',
        layout: 'own',   
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
        class: 'classstorage'
    },
    {   name: "Overview",
        isDirectory: true,
        path: "/storage/overview",
        class: 'classmenu',
        layout: 'own',   
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


    //Access
    {   name: "Access",
        isDirectory: true,
        path: "/access",
        class: 'classaccess'
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

    // CRD
    {   name: "Custom Resource Definitions",
        isDirectory: true,
        path: "/crd",
        class: 'classcrd'
    },
    {   name: "Definitions",
        isDirectory: true,
        path: "/crd/customresourcedefinition",
        class: 'classcustomresourcedefinition',
        children: 'customresourcedefinition'
    },

]

// General
spaces.set('classmenu',
    {
    }
)

spaces.set('classcluster', {})
spaces.set('classnetwork', {})
spaces.set('classworkload', {})
spaces.set('classstorage', {})
spaces.set('classaccess', {})
spaces.set('classcrd', {})


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
spaces.set('classingressclass',
    {
        leftItems: [
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
spaces.set('ingressclass',
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
                name: 'controller',
                text: 'Controller',
                source: 'controller',
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
            {   // +++ add 'visible' / 'enabled' properties as calculated invoking a function
                name: 'uncordon',
                icon: <PlayCircle fontSize='small' />,
                text: 'UnCordon',
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
                name:'edit',
                icon: <Edit fontSize="small"/>,
                text: 'Edit',
                permission: true,
            },
            {
                name:'delete',
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
                name: 'create',
                icon: <Add fontSize="small"/>,
                text: 'New pod',
                permission: true,
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
                source: 'na',
                format: 'function',
                width: 10,
                visible: true
            },
            {
                name: 'cpu',
                text: 'CPU',
                source: 'na',
                format: 'function',
                width: 10,
                visible: true
            },
            {
                name: 'memory',
                text: 'Memory',
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
spaces.set('job',
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
                name: 'completions',
                text: 'Completions',
                source: 'completions',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'conditions',
                text: 'Conditions',
                source: 'conditions',
                format: 'string',
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
spaces.set('cronjob',
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
                name: 'schedule',
                text: 'Schedule',
                source: 'schedule',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'suspend',
                text: 'Suspend',
                source: 'suspend',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'active',
                text: 'Active',
                source: 'active',
                format: 'number',
                width: 15,
                visible: true
            },
            {
                name: 'lastSchedule',
                text: 'Last schedule',
                source: 'lastSchedule',
                format: 'age',
                width: 20,
                visible: true
            },
            {
                name: 'nextExecution',
                text: 'Next execution',
                source: 'nextExecution',
                format: 'age',
                width: 20,
                visible: true
            },
            {
                name: 'timeZone',
                text: 'Time zone',
                source: 'timezone',
                format: 'string',
                width: 20,
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

// Custom
spaces.set('classcrd',
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

spaces.set('classcustomresourcedefinition',
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

spaces.set('customresourcedefinition',
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
                name: 'group',
                text: 'Group',
                source: 'group',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'version',
                text: 'Version',
                source: 'version',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'scope',
                text: 'Scope',
                source: 'scope',
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

spaces.set('crdgroup',
    {
        text:'Name',
        source:'name',
        width:40,
        leftItems: [
        ],
        properties: []
    }
)

spaces.set('crdinstance',
    {
        text:'Name',
        source:'name',
        width:40,
        leftItems: [
            {
                name: 'delete',
                icon: <Delete fontSize="small"/>,
                text: 'Delete',
                multi: true,
                permission: true,
            },
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
                name: 'source',
                text: 'Source',
                source: 'source',
                format: 'string',
                width: 15,
                visible: true
            },
            {
                name: 'Checksum',
                text: 'checksum',
                source: 'checksum',
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

//
// Open source icons: https://iconbuddy.com/
//
const icons = new Map()
icons.set('classoverview', { default: <Kubernetes size={'16'}/> } )
icons.set('classcluster', { default: <Cluster size={'16'}/> } )
icons.set('classnetwork', { default: <Network size={'16'}/> } )
icons.set('classworkload', { default: <Pod size={'16'}/> } )
icons.set('classstorage', { default: <Storage size={'16'}/> } )
icons.set('classaccess', { default: <Security size={'16'}/> } )
icons.set('classconfig', { default: <Config size={'16'}/> } )
icons.set('classcrd', { default: <Customize size={'16'}/> } )

export { spaces, menu, icons }