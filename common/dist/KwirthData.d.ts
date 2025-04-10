export declare enum ClusterTypeEnum {
    KUBERNETES = "kubernetes",
    DOCKER = "docker"
}
export interface KwirthData {
    version: string;
    lastVersion: string;
    clusterName: string;
    clusterType: ClusterTypeEnum;
    inCluster: boolean;
    namespace: string;
    deployment: string;
}
