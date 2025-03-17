export declare enum ServiceConfigChannelEnum {
    NONE = "none",
    LOG = "log",
    METRICS = "metrics",
    AUDIT = "audit",
    ALARM = "alarm",
    ALERT = "alert"
}
export declare enum ServiceConfigActionEnum {
    START = "start",
    STOP = "stop",
    PAUSE = "pause",
    CONTINUE = "continue",
    MODIFY = "modify",
    PING = "ping"
}
export declare enum ServiceConfigObjectEnum {
    PODS = "pods",
    EVENTS = "events"
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
    channel: string;
    objects: ServiceConfigObjectEnum;
    action: ServiceConfigActionEnum;
    flow: ServiceConfigFlowEnum;
    instance: string;
    accessKey: string;
    scope: string;
    view: ServiceConfigViewEnum;
    namespace: string;
    group: string;
    pod: string;
    container: string;
    data?: any;
}
