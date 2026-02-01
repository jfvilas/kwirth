export const allKinds: string[] = [ 
        'ComponentStatus', 'Node', 'Namespace', 'NodeMetrics',
        'Pod', 'PodMetrics', 'Deployment', 'DaemonSet', 'ReplicaSet', 'ReplicationController', 'StatefulSet', 'Job', 'CronJob',
        'ConfigMap', 'Secret', 'ResourceQuota', 'LimitRange', 'HorizontalPodAutoscaler', 'PodDisruptionBudget', 'PriorityClass','RuntimeClass', 'Lease', 'ValidatingWebhookConfiguration', 'MutatingWebhookConfiguration',
        'Service', 'Endpoints', 'Ingress', 'IngressClass', 'NetworkPolicy',
        'PersistentVolumeClaim', 'PersistentVolume', 'StorageClass', 'VolumeAttachment', 'CSIDriver', 'CSINode', 'CSIStorageCapacity',
        'ServiceAccount', 'ClusterRole', 'Role', 'ClusterRoleBinding', 'RoleBinding',
        'CustomResourceDefinition' ].sort()

export class MagnifyDataConfig {
    source: string[] = allKinds
    sync: string[] = allKinds
}

export class MagnifyUserPreferences {
    logLines = 5000
    dataConfig = new MagnifyDataConfig()
    tracing = false
}
