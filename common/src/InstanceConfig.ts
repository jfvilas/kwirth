import { InstanceMessage } from "./InstanceMessage"

// export enum InstanceConfigChannelEnum {
//     NONE = 'none',
//     LOG = 'log',
//     METRICS = 'metrics',
//     AUDIT = 'audit',
//     ALARM = 'alarm',
//     ALERT = 'alert'
// }

// export enum InstanceConfigActionEnum {
//     NONE = 'none',
//     START = 'start',
//     STOP = 'stop',
//     PAUSE = 'pause',
//     CONTINUE = 'continue',
//     MODIFY = 'modify',
//     PING = 'ping',
//     RECONNECT = 'reconnect'
// }

export enum InstanceConfigObjectEnum {
    PODS = 'pods',
    EVENTS = 'events'
}

// export enum InstanceConfigFlowEnum {
//     REQUEST = 'request',
//     RESPONSE = 'response',
//     UNSOLICITED = 'unsolicited'
// }

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

export interface InstanceConfig extends InstanceMessage{
    objects: InstanceConfigObjectEnum
    accessKey: string
    scope: string
    view: InstanceConfigViewEnum
    namespace: string
    group: string
    pod: string
    container: string
    data?: any
}

export interface InstanceConfigResponse extends InstanceMessage {
    // action: InstanceConfigActionEnum
    // flow: InstanceConfigFlowEnum
    text: string
}
