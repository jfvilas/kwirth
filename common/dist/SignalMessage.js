"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalMessageEventEnum = exports.SignalMessageLevelEnum = void 0;
var SignalMessageLevelEnum;
(function (SignalMessageLevelEnum) {
    SignalMessageLevelEnum["INFO"] = "info";
    SignalMessageLevelEnum["WARNING"] = "warning";
    SignalMessageLevelEnum["ERROR"] = "error";
})(SignalMessageLevelEnum || (exports.SignalMessageLevelEnum = SignalMessageLevelEnum = {}));
var SignalMessageEventEnum;
(function (SignalMessageEventEnum) {
    SignalMessageEventEnum["ADD"] = "add";
    SignalMessageEventEnum["DELETE"] = "delete";
    SignalMessageEventEnum["OTHER"] = "other";
})(SignalMessageEventEnum || (exports.SignalMessageEventEnum = SignalMessageEventEnum = {}));
