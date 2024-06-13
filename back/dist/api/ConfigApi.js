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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigApi = void 0;
const express_1 = __importDefault(require("express"));
const guid_1 = __importDefault(require("guid"));
class ConfigApi {
    constructor(kc, coreApi, appsV1Api) {
        this.route = express_1.default.Router();
        this.coreApi = coreApi;
        this.appsV1Api = appsV1Api;
        this.route.route('/cluster')
            .get((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                var cluster = { name: (_a = kc.getCurrentCluster()) === null || _a === void 0 ? void 0 : _a.name, apiKey: guid_1.default.create().toString() };
                res.status(200).json(cluster);
            }
            catch (err) {
                res.status(200).json([]);
                console.log(err);
            }
        }));
        this.route.route('/namespace')
            .get((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                var response = yield this.coreApi.listNamespace();
                var namespaces = response.body.items.map(n => { var _a; return (_a = n === null || n === void 0 ? void 0 : n.metadata) === null || _a === void 0 ? void 0 : _a.name; });
                res.status(200).json(namespaces);
            }
            catch (err) {
                res.status(200).json([]);
                console.log(err);
            }
        }));
        this.route.route('/:namespace/pod')
            .get((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                var response = yield this.coreApi.listNamespacedPod(req.params.namespace);
                var pods = response.body.items.map(n => { var _a; return (_a = n === null || n === void 0 ? void 0 : n.metadata) === null || _a === void 0 ? void 0 : _a.name; });
                res.status(200).json(pods);
            }
            catch (err) {
                res.status(200).json([]);
                console.log(err);
            }
        }));
        this.route.route('/:namespace/deployment')
            .get((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                var response = yield this.appsV1Api.listNamespacedDeployment(req.params.namespace);
                var deps = response.body.items.map(n => { var _a; return (_a = n === null || n === void 0 ? void 0 : n.metadata) === null || _a === void 0 ? void 0 : _a.name; });
                res.status(200).json(deps);
            }
            catch (err) {
                res.status(200).json([]);
                console.log(err);
            }
        }));
    }
}
exports.ConfigApi = ConfigApi;
