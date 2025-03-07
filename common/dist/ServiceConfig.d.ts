export declare enum ServiceConfigChannelEnum {
    NONE = "none",
    LOG = "log",
    METRICS = "metrics",
    AUDIT = "audit",
    ALARM = "alarm"
}
export declare enum ServiceConfigActionEnum {
    START = "start",
    STOP = "stop",
    PAUSE = "pause",
    CONTINUE = "continue",
    MODIFY = "modify",
    PING = "ping"
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
    STREAM = "stream",
    CREATE = "create",
    SUBSCRIBE = "subscribe"
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
