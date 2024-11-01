"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceConfigFlowEnum = exports.ServiceConfigActionEnum = exports.ServiceConfigChannelEnum = void 0;
var ServiceConfigChannelEnum;
(function (ServiceConfigChannelEnum) {
    ServiceConfigChannelEnum["UNDEFINED"] = "undefined";
    ServiceConfigChannelEnum["LOG"] = "log";
    ServiceConfigChannelEnum["METRICS"] = "metrics";
})(ServiceConfigChannelEnum || (exports.ServiceConfigChannelEnum = ServiceConfigChannelEnum = {}));
var ServiceConfigActionEnum;
(function (ServiceConfigActionEnum) {
    ServiceConfigActionEnum["START"] = "start";
    ServiceConfigActionEnum["STOP"] = "stop";
})(ServiceConfigActionEnum || (exports.ServiceConfigActionEnum = ServiceConfigActionEnum = {}));
var ServiceConfigFlowEnum;
(function (ServiceConfigFlowEnum) {
    ServiceConfigFlowEnum["REQUEST"] = "request";
    ServiceConfigFlowEnum["RESPONSE"] = "response";
})(ServiceConfigFlowEnum || (exports.ServiceConfigFlowEnum = ServiceConfigFlowEnum = {}));
