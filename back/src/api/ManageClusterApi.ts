import express from 'express';
import { AppsV1Api } from '@kubernetes/client-node';
import { CoreV1Api } from '@kubernetes/client-node';
import { validAuth, validKey } from '../tools/AuthorizationManagement';
import { restartPod, restartGroup } from '../tools/KubernetesOperations';

export class ManageClusterApi {
    public route = express.Router();
    coreApi:CoreV1Api;
    appsApi:AppsV1Api;

    constructor (coreApi:CoreV1Api, appsApi:AppsV1Api) {
        this.coreApi=coreApi
        this.appsApi=appsApi

        this.route.route('/find')
            .all( async (req,res, next) => {
                if (!validKey(req,res)) return;
                next();
            })
            .get( async (req, res) => {
                try {
                    var label:string=req.query.label as string;
                    var value:string=req.query.entity as string;
                    const labelSelector=`${label}=${value}`;
                    const podListResp = await this.coreApi.listPodForAllNamespaces(undefined, undefined, undefined, labelSelector);
                    var podList=podListResp.body.items.map(pod => {
                        // var owners = pod.metadata!.ownerReferences;
                        // if (owners) {
                        //     console.log(owners.length);
                        //     console.log(owners[0]);
                        // }
                        return { namespace:pod.metadata?.namespace, name:pod.metadata?.name }
                    });
                    res.status(200).json(podList);
                }
                catch (err) {
                    res.status(500).json();
                    console.log(err);
                }
            });

        this.route.route('/restartdeployment/:namespace/:deployment')
            .all( async (req,res, next) => {
                if (!validKey(req,res)) return;
                next();
            })
            .post( async (req, res) => {
                if (!validAuth(req,res, 'restart',req.params.namespace,req.params.deployment,'','')) return;
                try {
                    restartGroup(this.coreApi, this.appsApi, req.params.namespace, req.params.deployment);
                    res.status(200).json();
                }
                catch (err) {
                    res.status(200).json([]);
                    console.log(err);
                }
            });

        this.route.route('/restartpod/:namespace/:podName')
            .all( async (req,res, next) => {
                if (!validKey(req,res)) return;
                next();
            })
            .post( async (req, res) => {
                if (!validAuth(req,res, 'restart',req.params.namespace,'',req.params.podName,'')) return;
                try {
                    console.log(`Restart pod ${req.params.podName}`);
                    console.log(req.headers);
                    restartPod(coreApi, req.params.namespace, req.params.podName);
                    res.status(200).json();
                }
                catch (err) {
                    res.status(200).json([]);
                    console.log(err);
                }
            });   
    }
}
