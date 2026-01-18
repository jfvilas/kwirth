"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ESignalMessageEvent = exports.ESignalMessageLevel = exports.SignalMessageEventEnum = exports.SignalMessageLevelEnum = void 0;
// transient
var SignalMessageLevelEnum;
(function (SignalMessageLevelEnum) {
    SignalMessageLevelEnum["INFO"] = "info";
    SignalMessageLevelEnum["WARNING"] = "warning";
    SignalMessageLevelEnum["ERROR"] = "error";
})(SignalMessageLevelEnum || (exports.SignalMessageLevelEnum = SignalMessageLevelEnum = {}));
// transient
var SignalMessageEventEnum;
(function (SignalMessageEventEnum) {
    SignalMessageEventEnum["ADD"] = "add";
    SignalMessageEventEnum["DELETE"] = "delete";
    SignalMessageEventEnum["OTHER"] = "other";
})(SignalMessageEventEnum || (exports.SignalMessageEventEnum = SignalMessageEventEnum = {}));
var ESignalMessageLevel;
(function (ESignalMessageLevel) {
    ESignalMessageLevel["INFO"] = "info";
    ESignalMessageLevel["WARNING"] = "warning";
    ESignalMessageLevel["ERROR"] = "error";
})(ESignalMessageLevel || (exports.ESignalMessageLevel = ESignalMessageLevel = {}));
var ESignalMessageEvent;
(function (ESignalMessageEvent) {
    ESignalMessageEvent["ADD"] = "add";
    ESignalMessageEvent["DELETE"] = "delete";
    ESignalMessageEvent["OTHER"] = "other";
})(ESignalMessageEvent || (exports.ESignalMessageEvent = ESignalMessageEvent = {}));
