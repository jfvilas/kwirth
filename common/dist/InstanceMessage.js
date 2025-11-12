"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstanceMessageFlowEnum = exports.InstanceMessageActionEnum = exports.InstanceMessageTypeEnum = exports.InstanceMessageChannelEnum = void 0;
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
var InstanceMessageTypeEnum;
(function (InstanceMessageTypeEnum) {
    InstanceMessageTypeEnum["DATA"] = "data";
    InstanceMessageTypeEnum["SIGNAL"] = "signal";
})(InstanceMessageTypeEnum || (exports.InstanceMessageTypeEnum = InstanceMessageTypeEnum = {}));
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
var InstanceMessageFlowEnum;
(function (InstanceMessageFlowEnum) {
    InstanceMessageFlowEnum["IMMEDIATE"] = "immediate";
    InstanceMessageFlowEnum["REQUEST"] = "request";
    InstanceMessageFlowEnum["RESPONSE"] = "response";
    InstanceMessageFlowEnum["UNSOLICITED"] = "unsolicited";
})(InstanceMessageFlowEnum || (exports.InstanceMessageFlowEnum = InstanceMessageFlowEnum = {}));
