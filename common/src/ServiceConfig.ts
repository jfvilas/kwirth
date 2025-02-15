export enum ServiceConfigChannelEnum {
    LOG='log',
    METRICS='metrics',
    AUDIT='audit'
}

export enum ServiceConfigActionEnum {
    START='start',
    STOP='stop',
    PAUSE='pause',
    CONTINUE='continue',
    MODIFY='modify'
}

export enum ServiceConfigFlowEnum {
    REQUEST='request',
    RESPONSE='response'
}

export enum ServiceConfigViewEnum {
    NONE='none',
    CLUSTER='cluster',
    NAMESPACE='namespace',
    GROUP='group',
    POD='pod',
    CONTAINER='container'
}

export enum ServiceConfigScopeEnum {
    NONE='none',

    // LOG
    FILTER='filter',
    VIEW='view',
    RESTART='restart',
    API='api',
    CLUSTER='cluster',

    // METRICS
    SNAPSHOT='snapshot',
    STREAM='stream'
}

export interface ServiceConfig {
    channel: ServiceConfigChannelEnum
    action: ServiceConfigActionEnum
    flow: ServiceConfigFlowEnum
    instance: string
    accessKey: string
    scope: ServiceConfigScopeEnum
    view: ServiceConfigViewEnum
    namespace: string
    group: string
    set: string  // transitional
    pod: string
    container: string
}