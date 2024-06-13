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
exports.ConfigMaps = void 0;
class ConfigMaps {
    constructor(coreApi, namespace = 'default') {
        this.write = (name, data) => {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                console.log(data);
                try {
                    var configMap = {
                        metadata: {
                            name: name,
                            namespace: this.namespace
                        },
                        data: data
                    };
                    try {
                        console.log(configMap);
                        yield ((_a = this.coreApi) === null || _a === void 0 ? void 0 : _a.replaceNamespacedConfigMap(name, this.namespace, configMap));
                        resolve({});
                    }
                    catch (err) {
                        console.log('err replacing try to create');
                        try {
                            yield ((_b = this.coreApi) === null || _b === void 0 ? void 0 : _b.createNamespacedConfigMap(this.namespace, configMap));
                            resolve({});
                        }
                        catch (err) {
                            console.log(err);
                            reject({});
                        }
                    }
                }
                catch (err) {
                    reject({});
                }
            }));
        };
        this.read = (name_1, ...args_1) => __awaiter(this, [name_1, ...args_1], void 0, function* (name, defaultValue = undefined) {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                try {
                    var ct = yield ((_a = this.coreApi) === null || _a === void 0 ? void 0 : _a.readNamespacedConfigMap(name, this.namespace));
                    resolve(ct.body.data);
                }
                catch (err) {
                    if (err.statusCode === 404) {
                        resolve(defaultValue);
                    }
                    else {
                        console.log(err);
                        reject(undefined);
                    }
                }
            }));
        });
        this.coreApi = coreApi;
        this.namespace = namespace;
    }
}
exports.ConfigMaps = ConfigMaps;
