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
exports.UserApi = void 0;
const express_1 = __importDefault(require("express"));
const ts_semaphore_1 = __importDefault(require("ts-semaphore"));
class UserApi {
    constructor(secrets, namespace = 'default') {
        this.route = express_1.default.Router();
        this.secrets = secrets;
        secrets.read('kwirth.users').then((resp) => {
            UserApi.users = resp;
        })
            .catch((err) => {
            console.log('err reading users');
            console.log(err);
        });
        this.route.route('/')
            .get((req, res) => {
            UserApi.semaphore.use(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    // var data:any= await this.secrets.read('kwirth.users');
                    // console.log(data);
                    // res.status(200).json(Object.keys(data));
                    res.status(200).json(Object.keys(UserApi.users));
                }
                catch (err) {
                    console.log('err');
                    console.log(err);
                    res.status(500).send();
                }
            }));
        })
            .post((req, res) => {
            UserApi.semaphore.use(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    // var data:any= await this.secrets.read('kwirth.users');
                    // data[req.body.id]=btoa(JSON.stringify(req.body));
                    // await this.secrets.write('kwirth.users',data);
                    // res.status(200).send('');
                    UserApi.users[req.body.id] = btoa(JSON.stringify(req.body));
                    yield this.secrets.write('kwirth.users', UserApi.users);
                    res.status(200).send('');
                }
                catch (err) {
                    res.status(500).json();
                    console.log(err);
                }
            }));
        });
        this.route.route('/:user')
            .get((req, res) => {
            UserApi.semaphore.use(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    // var data:any= await this.secrets.read('kwirth.users');
                    // console.log(atob(data[req.params.user]));
                    // res.status(200).send(atob(data[req.params.user]));
                    res.status(200).send(atob(UserApi.users[req.params.user]));
                }
                catch (err) {
                    res.status(500).json();
                    console.log(err);
                }
            }));
        })
            .delete((req, res) => {
            try {
                UserApi.semaphore.use(() => __awaiter(this, void 0, void 0, function* () {
                    // var data:any= await this.secrets.read('kwirth.users');
                    // delete data[req.params.user];
                    // await this.secrets.write('kwirth.users',data);
                    // res.status(200).json();
                    delete UserApi.users[req.params.user];
                    yield this.secrets.write('kwirth.users', UserApi.users);
                    res.status(200).json();
                }));
            }
            catch (err) {
                res.status(500).json();
                console.log(err);
            }
        })
            .put((req, res) => {
            UserApi.semaphore.use(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    UserApi.users[req.body.id] = btoa(JSON.stringify(req.body));
                    yield this.secrets.write('kwirth.users', UserApi.users);
                    res.status(200).send('');
                }
                catch (err) {
                    res.status(500).json();
                    console.log(err);
                }
            }));
        });
    }
}
exports.UserApi = UserApi;
UserApi.users = {};
UserApi.semaphore = new ts_semaphore_1.default(1);
