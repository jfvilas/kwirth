enum ClusterTypeEnum {
    KUBERNETES = 'kubernetes',
    DOCKER = 'docker'
}

interface IEndpointConfig {
    name: string,
    methods: string[]
    requiresAccessKey: boolean
}

interface BackChannelData {
    id: string
    routable: boolean  // instance can receive routed commands
    pauseable: boolean  // instance can be paused
    modifyable: boolean  // instance can be modified
    reconnectable: boolean  // instance supports client reconnect requests
    sources: string[]  // array of sources (kubernetes, docker...)
    metrics: boolean  // this channel requires metrics
    endpoints: IEndpointConfig[]  // array of specific endpoints the channel requires (usually this would be empty)
}

interface KwirthData {
    version: string
    lastVersion: string
    clusterName: string
    clusterType: ClusterTypeEnum
    inCluster: boolean
    namespace: string
    deployment: string
    metricsInterval: number
    channels: BackChannelData[]
}

export { ClusterTypeEnum, KwirthData, BackChannelData }
