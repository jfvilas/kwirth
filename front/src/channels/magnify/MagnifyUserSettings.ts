export class MagnifyDataSettings {
    all: string[] = [ 'ComponentStatus', 'Namespace', 'Node', 'NodeMetrics',
        'Service', 'Endpoints', 'Ingress', 'IngressClass', 'NetworkPolicy',
        'Pod', 'PodMetrics', 'Deployment', 'DaemonSet', 'ReplicaSet', 'ReplicationController', 'StatefulSet', 'Job', 'CronJob',
        'ConfigMap', 'Secret', 'ResourceQuota', 'LimitRange', 'HorizontalPodAutoscaler', 'PodDisruptionBudget', 'PriorityClass','RuntimeClass', 'Lease', 'ValidatingWebhookConfiguration', 'MutatingWebhookConfiguration',
        'PersistentVolumeClaim', 'PersistentVolume', 'StorageClass', 'VolumeAttachment', 'CSIDriver', 'CSINode', 'CSIStorageCapacity',
        'ServiceAccount', 'ClusterRole', 'Role', 'ClusterRoleBinding', 'RoleBinding',
        'CustomResourceDefinition' ]
    source: string[] = [ 'ComponentStatus', 'Namespace', 'Node', 'NodeMetrics',
        'Service', 'Endpoints', 'Ingress', 'IngressClass', 'NetworkPolicy',
        'Pod', 'PodMetrics', 'Deployment', 'DaemonSet', 'ReplicaSet', 'ReplicationController', 'StatefulSet', 'Job', 'CronJob',
        'ConfigMap', 'Secret', 'ResourceQuota', 'LimitRange', 'HorizontalPodAutoscaler', 'PodDisruptionBudget', 'PriorityClass','RuntimeClass', 'Lease', 'ValidatingWebhookConfiguration', 'MutatingWebhookConfiguration',
        'PersistentVolumeClaim', 'PersistentVolume', 'StorageClass', 'VolumeAttachment', 'CSIDriver', 'CSINode', 'CSIStorageCapacity',
        'ServiceAccount', 'ClusterRole', 'Role', 'ClusterRoleBinding', 'RoleBinding',
        'CustomResourceDefinition' ]
    sync: string[] = [ 'ComponentStatus', 'Namespace', 'Node', 'NodeMetrics',
        'Service', 'Endpoints', 'Ingress', 'IngressClass', 'NetworkPolicy',
        'Pod', 'PodMetrics', 'Deployment', 'DaemonSet', 'ReplicaSet', 'ReplicationController', 'StatefulSet', 'Job', 'CronJob',
        'ConfigMap', 'Secret', 'ResourceQuota', 'LimitRange', 'HorizontalPodAutoscaler', 'PodDisruptionBudget', 'PriorityClass','RuntimeClass', 'Lease', 'ValidatingWebhookConfiguration', 'MutatingWebhookConfiguration',
        'PersistentVolumeClaim', 'PersistentVolume', 'StorageClass', 'VolumeAttachment', 'CSIDriver', 'CSINode', 'CSIStorageCapacity',
        'ServiceAccount', 'ClusterRole', 'Role', 'ClusterRoleBinding', 'RoleBinding',
        'CustomResourceDefinition' ]
}

export class MagnifyUserSettings {
    logLines = 5000
    dataSettings = new MagnifyDataSettings()
}
