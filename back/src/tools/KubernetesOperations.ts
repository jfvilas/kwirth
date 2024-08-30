import { AppsV1Api, CoreV1Api } from "@kubernetes/client-node";

export const restartDeployment = async (appsApi:AppsV1Api, namespace:string, deploymentName:string) => {
    try {
        console.log(`Restarting deployment ${deploymentName}`);
        const { body: deployment } = await appsApi.readNamespacedDeployment(deploymentName, namespace);
        if (!deployment!.spec!.template!.metadata!.annotations) deployment!.spec!.template!.metadata!.annotations = {};
        deployment!.spec!.template!.metadata!.annotations['kwirth/restartedAt'] = new Date().toISOString();
        appsApi.replaceNamespacedDeployment(deploymentName, namespace, deployment);
    }
    catch (err) {
        console.error(`Error restarting deployment ${deploymentName}:`, err);
    }
}

export const restartPod = async (appsApi:AppsV1Api, coreApi:CoreV1Api, namespace:string, podName:string) => {
    const pods = await coreApi.listPodForAllNamespaces();
    const pod = pods.body.items.find(p => p.metadata?.name === podName && p.metadata.namespace === namespace);
    var setName=pod?.metadata?.ownerReferences![0].name!;
    var depName='';
    switch(pod?.metadata?.ownerReferences![0].kind){
        case 'ReplicaSet':
            var a = await appsApi.readNamespacedReplicaSet(setName, namespace);
            depName=a.body.metadata?.ownerReferences![0].name!;
            break;
        case 'DaemonSet':
            var a = await appsApi.readNamespacedReplicaSet(setName, namespace);
            depName=a.body.metadata?.ownerReferences![0].name!;
            break;
        case 'StatefulSet':
            var a = await appsApi.readNamespacedReplicaSet(setName, namespace);
            depName=a.body.metadata?.ownerReferences![0].name!;
            break;
    }
    restartDeployment(appsApi, namespace, depName);

}
export const pauseDeployment = async (appsV1Api:AppsV1Api, namespace:string, deploymentName:string) => {
    console.log(`Pausing ${namespace}/${deploymentName}`);
    const deployment = await appsV1Api.readNamespacedDeployment(deploymentName, namespace);
    deployment.body.spec!.paused = true;
    await appsV1Api.replaceNamespacedDeployment(deploymentName, namespace, deployment.body);
}
