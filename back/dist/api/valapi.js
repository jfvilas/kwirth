"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidatorApi = void 0;
const express_1 = __importDefault(require("express"));
class ValidatorApi {
    constructor() {
        this.route = express_1.default.Router();
        this.route.route('/:vname');
        //   .get( (req, res) => {
        //     res.status(200).json(this.vals.get(req.params.vname));
        //   })
        // this.route.route('/:vname/stats')
        //   .get( (req, res) => {
        //     var a = this.vals.get(req.params.vname)?.decoderInstance;
        //     res.status(200).json( { name:req.params.vname, totalRequests:a?.totalRequests, totalOkRequests:a?.totalOkRequests, totalMicros:a?.totalMicros } );
        //   })
    }
}
exports.ValidatorApi = ValidatorApi;
