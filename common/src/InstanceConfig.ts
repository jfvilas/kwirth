import { IInstanceMessage } from "./InstanceMessage"

export enum InstanceConfigObjectEnum {
    PODS = 'pods',
    EVENTS = 'events'
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
    API = 'api',
    CLUSTER = 'cluster',

    // LOG
    FILTER = 'filter',
    VIEW = 'view',

    // METRICS
    SNAPSHOT = 'snapshot',
    STREAM = 'stream',

    // ALARM
    CREATE = 'create',
    SUBSCRIBE = 'subscribe',

    // OPS
    GET = 'get',
    EXECUTE = 'execute',
    SHELL = 'shell',
    RESTART = 'restart',

    // TRIVY
    WORKLOAD = "workload",
    KUBERNETES = "kubernetes"
}

export interface IInstanceConfig extends IInstanceMessage{
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

export interface IInstanceConfigResponse extends IInstanceMessage {
    text: string
}
