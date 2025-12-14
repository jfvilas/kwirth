import { IInstanceMessage } from "./InstanceMessage";
export declare enum InstanceConfigObjectEnum {
    PODS = "pods",
    EVENTS = "events"
}
export declare enum InstanceConfigViewEnum {
    NONE = "none",
    CLUSTER = "cluster",
    NAMESPACE = "namespace",
    GROUP = "group",
    POD = "pod",
    CONTAINER = "container"
}
export declare enum InstanceConfigScopeEnum {
    NONE = "none",
    API = "api",
    CLUSTER = "cluster",
    FILTER = "filter",
    VIEW = "view",
    SNAPSHOT = "snapshot",
    STREAM = "stream",
    CREATE = "create",
    SUBSCRIBE = "subscribe",
    GET = "get",
    EXECUTE = "execute",
    RESTART = "restart",
    WORKLOAD = "workload",
    KUBERNETES = "kubernetes"
}
export interface IInstanceConfig extends IInstanceMessage {
    objects: InstanceConfigObjectEnum;
    accessKey: string;
    scope: string;
    view: InstanceConfigViewEnum;
    namespace: string;
    group: string;
    pod: string;
    container: string;
    data?: any;
}
export interface IInstanceConfigResponse extends IInstanceMessage {
    text?: string;
    data?: any;
}
