import { IChannel } from '../channels/IChannel'
import { ClusterInfo } from '../model/ClusterInfo'
import { Watch } from '@kubernetes/client-node'

export class EventsTools {
    private clusterInfo:ClusterInfo
    private subscribers:IChannel[]

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
        this.subscribers = []
    }

    addSubscriber(c:IChannel) {
        this.subscribers.push(c)
    }

    removeSubscriber(c:IChannel) {
        let i = this.subscribers.indexOf(c)
        if (i>=0) this.subscribers.splice(i,1)
    }

    async startResourceWatcher (resourcePath: string, eventHandler: (type: string, obj: any, subscribersList:IChannel[]) => void) {
        const watchLoop = async () => {
            console.log(`[${resourcePath}] Starting watcher for path: ${resourcePath}`);
            const watch = new Watch(this.clusterInfo.kubeConfig)
            try {
                await watch.watch(
                    resourcePath,
                    {},  //{ timeoutSeconds: 300 }, // Optional: restarts every 5 minutes
                    (type, apiObj) => {
                        if (apiObj && apiObj.metadata) {
                            eventHandler(type, apiObj, this.subscribers)
                        }
                    },
                    (err) => {
                        console.log(`[${resourcePath}] Watcher ended or error (${err}). Restarting...`)
                        setTimeout(watchLoop, 1000)
                    }
                );
            }
            catch (error: any) {
                console.error(`[${resourcePath}] Error al configurar el watcher: ${error.message}`)
                setTimeout(watchLoop, 5000)
            }
        }
        watchLoop()
    }

    handleEvent (type: string, obj: any, subscribersList:IChannel[]) {
        for (let subscriber of subscribersList) {
            subscriber.processObjectEvent(type, obj)
        }
    }

    startEvents() {
        console.log('Event reception started...')
        this.startResourceWatcher('/api/v1/nodes', this.handleEvent)
        this.startResourceWatcher('/api/v1/namespaces', this.handleEvent)


        this.startResourceWatcher('/api/v1/services', this.handleEvent)
        this.startResourceWatcher('/api/v1/endpoints', this.handleEvent)
        this.startResourceWatcher('/apis/networking.k8s.io/v1/ingresses', this.handleEvent)
        this.startResourceWatcher('/apis/networking.k8s.io/v1/ingressclasses', this.handleEvent)
        this.startResourceWatcher('/apis/networking.k8s.io/v1/networkpolicies', this.handleEvent)

        
        this.startResourceWatcher('/api/v1/configmaps', this.handleEvent)
        this.startResourceWatcher('/api/v1/secrets', this.handleEvent)
        this.startResourceWatcher('/api/v1/resourcequotas', this.handleEvent)
        this.startResourceWatcher('/api/v1/limitranges', this.handleEvent)
        this.startResourceWatcher('/apis/autoscaling/v2/horizontalpodautoscalers', this.handleEvent)
        this.startResourceWatcher('/apis/policy/v1/poddisruptionbudgets', this.handleEvent)
        this.startResourceWatcher('/apis/scheduling.k8s.io/v1/priorityclasses', this.handleEvent)
        this.startResourceWatcher('/apis/node.k8s.io/v1/runtimeclasses', this.handleEvent)
        this.startResourceWatcher('/apis/coordination.k8s.io/v1/leases', this.handleEvent)
        this.startResourceWatcher('/apis/admissionregistration.k8s.io/v1/validatingwebhookconfigurations', this.handleEvent)
        this.startResourceWatcher('/apis/admissionregistration.k8s.io/v1/mutatingwebhookconfigurations', this.handleEvent)


        this.startResourceWatcher('/api/v1/pods', this.handleEvent)
        this.startResourceWatcher('/apis/apps/v1/deployments', this.handleEvent)
        this.startResourceWatcher('/apis/apps/v1/daemonsets', this.handleEvent)
        this.startResourceWatcher('/apis/apps/v1/statefulsets', this.handleEvent)
        this.startResourceWatcher('/apis/apps/v1/replicasets', this.handleEvent)
        this.startResourceWatcher('/api/v1/replicationcontrollers', this.handleEvent)
        this.startResourceWatcher('/apis/batch/v1/jobs', this.handleEvent)
        this.startResourceWatcher('/apis/batch/v1/cronjobs', this.handleEvent)


        this.startResourceWatcher('/api/v1/persistentvolumes', this.handleEvent)
        this.startResourceWatcher('/api/v1/persistentvolumeclaims', this.handleEvent)
        this.startResourceWatcher('/apis/storage.k8s.io/v1/storageclasses', this.handleEvent)


        this.startResourceWatcher('/api/v1/serviceaccounts', this.handleEvent)
        this.startResourceWatcher('/apis/rbac.authorization.k8s.io/v1/roles', this.handleEvent)
        this.startResourceWatcher('/apis/rbac.authorization.k8s.io/v1/rolebindings', this.handleEvent)
        this.startResourceWatcher('/apis/rbac.authorization.k8s.io/v1/clusterroles', this.handleEvent)
        this.startResourceWatcher('/apis/rbac.authorization.k8s.io/v1/clusterrolebindings', this.handleEvent)


        this.startResourceWatcher('/apis/apiextensions.k8s.io/v1/customresourcedefinitions', this.handleEvent)
    }

}