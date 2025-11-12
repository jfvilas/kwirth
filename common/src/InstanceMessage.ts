export enum InstanceMessageChannelEnum {
    NONE = 'none',
    LOG = 'log',
    METRICS = 'metrics',
    AUDIT = 'audit',
    OPS = 'ops',
    ALERT = 'alert',
    TRIVY = 'trivy'
}

export enum InstanceMessageTypeEnum {
    DATA='data',
    SIGNAL='signal'
}

export enum InstanceMessageActionEnum {
    NONE = 'none',
    ROUTE = 'route',
    START = 'start',
    STOP = 'stop',
    PAUSE = 'pause',
    CONTINUE = 'continue',
    MODIFY = 'modify',
    PING = 'ping',
    RECONNECT = 'reconnect',
    COMMAND = 'command',
    WEBSOCKET = 'websocket'
}

export enum InstanceMessageFlowEnum {
    IMMEDIATE = 'immediate',
    REQUEST = 'request',
    RESPONSE = 'response',
    UNSOLICITED = 'unsolicited'
}

export interface IInstanceMessage {
    action: InstanceMessageActionEnum
    flow: InstanceMessageFlowEnum
    type: InstanceMessageTypeEnum
    channel: string
    instance: string
}
