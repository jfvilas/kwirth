"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Secrets = void 0;
class Secrets {
    constructor(coreApi, namespace = 'default') {
        this.write = (name, content) => {
            return new Promise((resolve, reject) => {
                var _a, _b;
                try {
                    var secret = {
                        metadata: {
                            name: name,
                            namespace: this.namespace
                        },
                        data: content
                    };
                    try {
                        (_a = this.coreApi) === null || _a === void 0 ? void 0 : _a.replaceNamespacedSecret(name, this.namespace, secret);
                        resolve({});
                    }
                    catch (err) {
                        (_b = this.coreApi) === null || _b === void 0 ? void 0 : _b.createNamespacedSecret(this.namespace, secret);
                        resolve({});
                    }
                }
                catch (err) {
                    reject(undefined);
                }
            });
        };
        this.read = (name) => __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                try {
                    var ct = yield ((_a = this.coreApi) === null || _a === void 0 ? void 0 : _a.readNamespacedSecret(name, this.namespace));
                    resolve(ct.body.data);
                }
                catch (err) {
                    reject(undefined);
                }
            }));
        });
        this.coreApi = coreApi;
        this.namespace = namespace;
    }
}
exports.Secrets = Secrets;
