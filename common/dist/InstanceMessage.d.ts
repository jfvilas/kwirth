export declare enum InstanceMessageChannelEnum {
    NONE = "none",
    LOG = "log",
    METRICS = "metrics",
    AUDIT = "audit",
    OPS = "ops",
    ALERT = "alert",
    TRIVY = "trivy"
}
export declare enum EInstanceMessageChannel {
    NONE = "none",
    LOG = "log",
    METRICS = "metrics",
    AUDIT = "audit",
    OPS = "ops",
    ALERT = "alert",
    TRIVY = "trivy",
    MAGNIFY = "magnify"
}
export declare enum InstanceMessageTypeEnum {
    DATA = "data",
    SIGNAL = "signal"
}
export declare enum EInstanceMessageType {
    DATA = "data",
    SIGNAL = "signal"
}
export declare enum InstanceMessageActionEnum {
    NONE = "none",
    ROUTE = "route",
    START = "start",
    STOP = "stop",
    PAUSE = "pause",
    CONTINUE = "continue",
    MODIFY = "modify",
    PING = "ping",
    RECONNECT = "reconnect",
    COMMAND = "command",
    WEBSOCKET = "websocket"
}
export declare enum EInstanceMessageAction {
    NONE = "none",
    ROUTE = "route",
    START = "start",
    STOP = "stop",
    PAUSE = "pause",
    CONTINUE = "continue",
    MODIFY = "modify",
    PING = "ping",
    RECONNECT = "reconnect",
    COMMAND = "command",
    WEBSOCKET = "websocket"
}
export declare enum InstanceMessageFlowEnum {
    IMMEDIATE = "immediate",
    REQUEST = "request",
    RESPONSE = "response",
    UNSOLICITED = "unsolicited"
}
export declare enum EInstanceMessageFlow {
    IMMEDIATE = "immediate",
    REQUEST = "request",
    RESPONSE = "response",
    UNSOLICITED = "unsolicited"
}
export interface IInstanceMessage {
    action: EInstanceMessageAction;
    flow: EInstanceMessageFlow;
    type: EInstanceMessageType;
    channel: string;
    instance: string;
}
