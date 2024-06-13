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
exports.KeyApi = void 0;
const express_1 = __importDefault(require("express"));
const guid_1 = __importDefault(require("guid"));
const ts_semaphore_1 = __importDefault(require("ts-semaphore"));
class KeyApi {
    constructor(configMaps) {
        this.route = express_1.default.Router();
        this.configMaps = configMaps;
        configMaps.read('kwirth.keys', { keys: [] }).then((resp) => {
            console.log('read keys');
            KeyApi.keys = JSON.parse(resp.keys);
            console.log(KeyApi.keys);
        })
            .catch((err) => {
            console.log('err reading keys. kwirth will start with no keys');
            console.log(err);
        });
        this.route.route('/')
            .get((req, res) => __awaiter(this, void 0, void 0, function* () {
            res.status(200).json(KeyApi.keys);
        }))
            .post((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                var description = req.body.description;
                var expire = req.body.expire;
                var key = { key: guid_1.default.create().toString(), description: description, expire: expire };
                KeyApi.keys.push(key);
                configMaps.write('kwirth.keys', { keys: JSON.stringify(KeyApi.keys) });
                res.status(200).json(key);
            }
            catch (err) {
                res.status(500).json({});
                console.log(err);
            }
        }));
        this.route.route('/:key')
            .get((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                var key = KeyApi.keys.filter(k => k.key !== req.params.key);
                if (key)
                    res.status(200).json(key);
                else
                    res.status(404).json({});
            }
            catch (err) {
                res.status(500).json({});
                console.log(err);
            }
        }))
            .delete((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                KeyApi.keys = KeyApi.keys.filter(k => k.key !== req.params.key);
                configMaps.write('kwirth.keys', { keys: JSON.stringify(KeyApi.keys) });
                res.status(200).json({});
            }
            catch (err) {
                res.status(500).json({});
                console.log(err);
            }
        }))
            .put((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                var key = req.body;
                KeyApi.keys = KeyApi.keys.filter(k => k.key !== key.key);
                key.key = req.params.key;
                KeyApi.keys.push(key);
                configMaps.write('kwirth.keys', { keys: JSON.stringify(KeyApi.keys) });
                res.status(200).json({});
            }
            catch (err) {
                res.status(500).json({});
                console.log(err);
            }
        }));
    }
}
exports.KeyApi = KeyApi;
KeyApi.keys = [];
KeyApi.semaphore = new ts_semaphore_1.default(1);
