import express from 'express';
import { AppsV1Api } from '@kubernetes/client-node';
import { restartDeployment } from '../tools/KubernetesOperations';

export class OperateApi {
    public route = express.Router();
    appsV1Api:AppsV1Api;

    constructor (appsV1Api:AppsV1Api) {
        this.appsV1Api=appsV1Api

        this.route.route('/:namespace/:deployment')
            .post( async (req, res) => {
                try {
                    restartDeployment(this.appsV1Api, req.params.namespace, req.params.deployment);
                    res.status(200).json();
                }
                catch (err) {
                    res.status(200).json([]);
                    console.log(err);
                }
            })
    }

}
