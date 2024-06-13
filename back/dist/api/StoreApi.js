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
exports.StoreApi = void 0;
const express_1 = __importDefault(require("express"));
const ts_semaphore_1 = __importDefault(require("ts-semaphore"));
class StoreApi {
    constructor(config, namespace = 'default') {
        this.route = express_1.default.Router();
        this.configMaps = config;
        this.route.route('/:user')
            .get((req, res) => __awaiter(this, void 0, void 0, function* () {
            StoreApi.semaphore.use(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    var data = yield this.configMaps.read('kwirth.store.' + req.params.user, {});
                    console.log(data);
                    if (data === undefined)
                        res.status(200).json([]);
                    else
                        res.status(200).json(Object.keys(data));
                }
                catch (err) {
                    console.log('err');
                    console.log(err);
                    res.status(500).send();
                }
            }));
        }));
        this.route.route('/:user/:key')
            .get((req, res) => __awaiter(this, void 0, void 0, function* () {
            StoreApi.semaphore.use(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    var data = yield this.configMaps.read('kwirth.store.' + req.params.user, {});
                    res.status(200).json(data[req.params.key]);
                }
                catch (err) {
                    res.status(500).json();
                    console.log(err);
                }
            }));
        }))
            .delete((req, res) => __awaiter(this, void 0, void 0, function* () {
            StoreApi.semaphore.use(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    var data = yield this.configMaps.read('kwirth.store.' + req.params.user);
                    delete data[req.params.key];
                    console.log(data);
                    yield this.configMaps.write('kwirth.store.' + req.params.user, data);
                    res.status(200).json();
                }
                catch (err) {
                    res.status(500).json();
                    console.log(err);
                }
            }));
        }))
            .post((req, res) => __awaiter(this, void 0, void 0, function* () {
            StoreApi.semaphore.use(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    var data = yield this.configMaps.read('kwirth.store.' + req.params.user, {});
                    console.log(data);
                    data[req.params.key] = JSON.stringify(req.body);
                    console.log(data);
                    yield this.configMaps.write('kwirth.store.' + req.params.user, data);
                    res.status(200).send('');
                }
                catch (err) {
                    res.status(500).json();
                    console.log(err);
                }
            }));
        }));
    }
}
exports.StoreApi = StoreApi;
StoreApi.semaphore = new ts_semaphore_1.default(1);
