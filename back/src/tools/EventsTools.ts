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
            console.log(`[${resourcePath}] Iniciando watcher en path: ${resourcePath}`);
            const watch = new Watch(this.clusterInfo.kubeConfig)
            try {
                await watch.watch(
                    resourcePath,
                    //{ timeoutSeconds: 300 }, // Opcional: Reinicia la conexión limpiamente cada 5 minutos
                    {},
                    (type, apiObj) => {
                        if (apiObj && apiObj.metadata) {
                            eventHandler(type, apiObj, this.subscribers)
                        }
                    },
                    (err) => {
                        console.log(`[${resourcePath}] Watcher finalizado o error (${err}). Reiniciando en 5 segundos...`)
                        setTimeout(watchLoop, 5000)
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
            subscriber.processEvent(type, obj)
        }
    }

    startEvents() {
        console.log('Event reception started...')
        this.startResourceWatcher('/api/v1/pods', this.handleEvent)
        this.startResourceWatcher('/api/v1/configmaps', this.handleEvent)
        this.startResourceWatcher('/api/v1/secrets', this.handleEvent)
        this.startResourceWatcher('/api/v1/namespaces', this.handleEvent)
        this.startResourceWatcher('/apis/apps/v1/deployments', this.handleEvent)
        this.startResourceWatcher('/apis/apps/v1/daemonsets', this.handleEvent)
        this.startResourceWatcher('/apis/apps/v1/statefulsets', this.handleEvent)
        this.startResourceWatcher('/apis/apps/v1/replicasets', this.handleEvent)
    }

}