export declare enum ServiceConfigChannelEnum {
    LOG = "log",
    METRICS = "metrics",
    AUDIT = "audit"
}
export declare enum ServiceConfigActionEnum {
    START = "start",
    STOP = "stop"
}
export declare enum ServiceConfigFlowEnum {
    REQUEST = "request",
    RESPONSE = "response"
}
export declare enum ServiceConfigViewEnum {
    NONE = "none",
    CLUSTER = "cluster",
    NAMESPACE = "namespace",
    GROUP = "group",
    POD = "pod",
    CONTAINER = "container"
}
export declare enum ServiceConfigScopeEnum {
    NONE = "none",
    FILTER = "filter",
    VIEW = "view",
    RESTART = "restart",
    API = "api",
    CLUSTER = "cluster",
    SNAPSHOT = "snapshot",
    STREAM = "stream"
}
export interface ServiceConfig {
    channel: ServiceConfigChannelEnum;
    action: ServiceConfigActionEnum;
    flow: ServiceConfigFlowEnum;
    instance: string;
    accessKey: string;
    scope: ServiceConfigScopeEnum;
    view: ServiceConfigViewEnum;
    namespace: string;
    group: string;
    set: string;
    pod: string;
    container: string;
}
