export enum InstanceConfigChannelEnum {
    NONE = 'none',
    LOG = 'log',
    METRICS = 'metrics',
    AUDIT = 'audit',
    ALARM = 'alarm',
    ALERT = 'alert'
}

export enum InstanceConfigActionEnum {
    START = 'start',
    STOP = 'stop',
    PAUSE = 'pause',
    CONTINUE = 'continue',
    MODIFY = 'modify',
    PING = 'ping',
    RECONNECT = 'reconnect'
}

export enum InstanceConfigObjectEnum {
    PODS = 'pods',
    EVENTS = 'events'
}

export enum InstanceConfigFlowEnum {
    REQUEST = 'request',
    RESPONSE = 'response'
}

export enum InstanceConfigViewEnum {
    NONE = 'none',
    CLUSTER = 'cluster',
    NAMESPACE = 'namespace',
    GROUP = 'group',
    POD = 'pod',
    CONTAINER = 'container'
}

export enum InstanceConfigScopeEnum {
    NONE='none',

    // LOG
    FILTER = 'filter',
    VIEW = 'view',
    RESTART = 'restart',
    API = 'api',
    CLUSTER = 'cluster',

    // METRICS
    SNAPSHOT = 'snapshot',
    STREAM = 'stream',

    // ALARM
    CREATE = 'create',
    SUBSCRIBE = 'subscribe',
}

export interface InstanceConfig {
    channel: string
    objects: InstanceConfigObjectEnum
    action: InstanceConfigActionEnum
    flow: InstanceConfigFlowEnum
    instance: string
    accessKey: string
    scope: string
    view: InstanceConfigViewEnum
    namespace: string
    group: string
    pod: string
    container: string
    reconnectKey?: string
    data?: any
}

export interface InstanceConfigResponse {
    action: InstanceConfigActionEnum
    flow: InstanceConfigFlowEnum
    channel: string
    instance: string
    type: string
    text: string
}
