enum SourceEnum {
    DOCKER = 'docker',
    KUBERNETES = 'kubernetes'
}

type ChannelData = {
    id: string
    routable: boolean  // instance can receive routed commands
    pauseable: boolean  // instance can be paused
    modifyable: boolean  // instance can be modified
    reconnectable: boolean  // instance supports client reconnect requests
    sources: SourceEnum[]  // array of sources (kubernetes, docker...)
    metrics: boolean  // this channel requires metrics
}

export type { ChannelData }
export { SourceEnum }