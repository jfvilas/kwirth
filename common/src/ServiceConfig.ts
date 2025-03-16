export enum ServiceConfigChannelEnum {
    NONE = 'none',
    LOG = 'log',
    METRICS = 'metrics',
    AUDIT = 'audit',
    ALARM = 'alarm',
    ALERT = 'alert'
}

export enum ServiceConfigActionEnum {
    START = 'start',
    STOP = 'stop',
    PAUSE = 'pause',
    CONTINUE = 'continue',
    MODIFY = 'modify',
    PING = 'ping'
}

export enum ServiceConfigObjectEnum {
    PODS = 'pods',
    EVENTS = 'events'
}

export enum ServiceConfigFlowEnum {
    REQUEST = 'request',
    RESPONSE = 'response'
}

export enum ServiceConfigViewEnum {
    NONE = 'none',
    CLUSTER = 'cluster',
    NAMESPACE = 'namespace',
    GROUP = 'group',
    POD = 'pod',
    CONTAINER = 'container'
}

export enum ServiceConfigScopeEnum {
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

export interface ServiceConfig {
    channel: string
    object: ServiceConfigObjectEnum
    action: ServiceConfigActionEnum
    flow: ServiceConfigFlowEnum
    instance: string
    accessKey: string
    scope: string
    view: ServiceConfigViewEnum
    namespace: string
    group: string
    pod: string
    container: string
    data?: any
}
