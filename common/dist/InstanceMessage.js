"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EInstanceMessageFlow = exports.InstanceMessageFlowEnum = exports.EInstanceMessageAction = exports.InstanceMessageActionEnum = exports.EInstanceMessageType = exports.InstanceMessageTypeEnum = exports.EInstanceMessageChannel = exports.InstanceMessageChannelEnum = void 0;
// transient
var InstanceMessageChannelEnum;
(function (InstanceMessageChannelEnum) {
    InstanceMessageChannelEnum["NONE"] = "none";
    InstanceMessageChannelEnum["LOG"] = "log";
    InstanceMessageChannelEnum["METRICS"] = "metrics";
    InstanceMessageChannelEnum["AUDIT"] = "audit";
    InstanceMessageChannelEnum["OPS"] = "ops";
    InstanceMessageChannelEnum["ALERT"] = "alert";
    InstanceMessageChannelEnum["TRIVY"] = "trivy";
})(InstanceMessageChannelEnum || (exports.InstanceMessageChannelEnum = InstanceMessageChannelEnum = {}));
var EInstanceMessageChannel;
(function (EInstanceMessageChannel) {
    EInstanceMessageChannel["NONE"] = "none";
    EInstanceMessageChannel["LOG"] = "log";
    EInstanceMessageChannel["METRICS"] = "metrics";
    EInstanceMessageChannel["AUDIT"] = "audit";
    EInstanceMessageChannel["OPS"] = "ops";
    EInstanceMessageChannel["ALERT"] = "alert";
    EInstanceMessageChannel["TRIVY"] = "trivy";
    EInstanceMessageChannel["MAGNIFY"] = "magnify";
})(EInstanceMessageChannel || (exports.EInstanceMessageChannel = EInstanceMessageChannel = {}));
// transient
var InstanceMessageTypeEnum;
(function (InstanceMessageTypeEnum) {
    InstanceMessageTypeEnum["DATA"] = "data";
    InstanceMessageTypeEnum["SIGNAL"] = "signal";
})(InstanceMessageTypeEnum || (exports.InstanceMessageTypeEnum = InstanceMessageTypeEnum = {}));
var EInstanceMessageType;
(function (EInstanceMessageType) {
    EInstanceMessageType["DATA"] = "data";
    EInstanceMessageType["SIGNAL"] = "signal";
})(EInstanceMessageType || (exports.EInstanceMessageType = EInstanceMessageType = {}));
// transient
var InstanceMessageActionEnum;
(function (InstanceMessageActionEnum) {
    InstanceMessageActionEnum["NONE"] = "none";
    InstanceMessageActionEnum["ROUTE"] = "route";
    InstanceMessageActionEnum["START"] = "start";
    InstanceMessageActionEnum["STOP"] = "stop";
    InstanceMessageActionEnum["PAUSE"] = "pause";
    InstanceMessageActionEnum["CONTINUE"] = "continue";
    InstanceMessageActionEnum["MODIFY"] = "modify";
    InstanceMessageActionEnum["PING"] = "ping";
    InstanceMessageActionEnum["RECONNECT"] = "reconnect";
    InstanceMessageActionEnum["COMMAND"] = "command";
    InstanceMessageActionEnum["WEBSOCKET"] = "websocket";
})(InstanceMessageActionEnum || (exports.InstanceMessageActionEnum = InstanceMessageActionEnum = {}));
var EInstanceMessageAction;
(function (EInstanceMessageAction) {
    EInstanceMessageAction["NONE"] = "none";
    EInstanceMessageAction["ROUTE"] = "route";
    EInstanceMessageAction["START"] = "start";
    EInstanceMessageAction["STOP"] = "stop";
    EInstanceMessageAction["PAUSE"] = "pause";
    EInstanceMessageAction["CONTINUE"] = "continue";
    EInstanceMessageAction["MODIFY"] = "modify";
    EInstanceMessageAction["PING"] = "ping";
    EInstanceMessageAction["RECONNECT"] = "reconnect";
    EInstanceMessageAction["COMMAND"] = "command";
    EInstanceMessageAction["WEBSOCKET"] = "websocket";
})(EInstanceMessageAction || (exports.EInstanceMessageAction = EInstanceMessageAction = {}));
var InstanceMessageFlowEnum;
(function (InstanceMessageFlowEnum) {
    InstanceMessageFlowEnum["IMMEDIATE"] = "immediate";
    InstanceMessageFlowEnum["REQUEST"] = "request";
    InstanceMessageFlowEnum["RESPONSE"] = "response";
    InstanceMessageFlowEnum["UNSOLICITED"] = "unsolicited";
})(InstanceMessageFlowEnum || (exports.InstanceMessageFlowEnum = InstanceMessageFlowEnum = {}));
var EInstanceMessageFlow;
(function (EInstanceMessageFlow) {
    EInstanceMessageFlow["IMMEDIATE"] = "immediate";
    EInstanceMessageFlow["REQUEST"] = "request";
    EInstanceMessageFlow["RESPONSE"] = "response";
    EInstanceMessageFlow["UNSOLICITED"] = "unsolicited";
})(EInstanceMessageFlow || (exports.EInstanceMessageFlow = EInstanceMessageFlow = {}));
