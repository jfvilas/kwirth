"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceConfigFlowEnum = exports.ServiceConfigActionEnum = exports.ServiceConfigTypeEnum = void 0;
var ServiceConfigTypeEnum;
(function (ServiceConfigTypeEnum) {
    ServiceConfigTypeEnum["LOG"] = "log";
    ServiceConfigTypeEnum["METRICS"] = "metrics";
})(ServiceConfigTypeEnum || (exports.ServiceConfigTypeEnum = ServiceConfigTypeEnum = {}));
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
