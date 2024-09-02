import { AppsV1Api, CoreV1Api } from "@kubernetes/client-node";

// export const restartDeployment = async (appsApi:AppsV1Api, namespace:string, deploymentName:string) => {
//     try {
//         console.log(`Restarting deployment ${deploymentName}`);
//         const { body: deployment } = await appsApi.readNamespacedDeployment(deploymentName, namespace);
//         if (!deployment!.spec!.template!.metadata!.annotations) deployment!.spec!.template!.metadata!.annotations = {};
//         deployment!.spec!.template!.metadata!.annotations['kwirth/restartedAt'] = new Date().toISOString();
//         appsApi.replaceNamespacedDeployment(deploymentName, namespace, deployment);
//     }
//     catch (err) {
//         console.log(`Error restarting deployment ${deploymentName}:`, err);
//     }
// }

/**
 * 
 * @param coreApi K8 core API
 * @param appsApi K8 apps API
 * @param namespace namespace
 * @param group a name of a deployment or a qualified name of a set, thta is 'type+name', example: replica+rs1, stateful+mongo, daemon+monitoring 
 */
export const restartGroup = async (coreApi:CoreV1Api, appsApi:AppsV1Api, namespace:string, group:string) => {
    try {
        var result=await getPodsFromGroup(coreApi, appsApi, namespace, group);

        // Delete all pods, which forces kubernetes to recreate them
        for (const pod of result.pods) {
            const podName = pod.metadata?.name;
            if (podName) {
                await coreApi.deleteNamespacedPod(podName, namespace);
                console.log(`Pod ${podName} deleted.`);
            }
        }

    }
    catch (error) {
        console.log(`Error restarting group: ${error}`);
    }
}

export const restartPod = async (coreApi:CoreV1Api, namespace:string, podName:string) => {
    await coreApi.deleteNamespacedPod(podName, namespace);
}

export const pauseDeployment = async (appsApi:AppsV1Api, namespace:string, deploymentName:string) => {
    console.log(`Pausing ${namespace}/${deploymentName}`);
    const deployment = await appsApi.readNamespacedDeployment(deploymentName, namespace);
    deployment.body.spec!.paused = true;
    await appsApi.replaceNamespacedDeployment(deploymentName, namespace, deployment.body);
}

/**
 * 
 * @param coreApi K8 core API
 * @param appsApi K8 apps API
 * @param namespace 
 * @param group a name of a deployment or a qualified name of a set, thta is 'type+name', example: replica+rs1, stateful+mongo, daemon+monitoring
 * @returns an object iwth the list of pods and the labelSelector used
 */
export const getPodsFromGroup = async (coreApi:CoreV1Api, appsApi:AppsV1Api, namespace:string, group:string) => {
    var response:any;
    var setName, setType;
    if (group.includes('+'))
        [setType, setName]=group.split('+');
    else
        [setType, setName]=['deployment', group];

    switch (setType) {
        case'deployment':
            response=await appsApi.readNamespacedDeployment(setName, namespace);
            break;
        case'replica':
            response=await appsApi.readNamespacedReplicaSet(setName, namespace);
            break;
        case'daemon':
            response=await appsApi.readNamespacedDaemonSet(setName, namespace);
            break;
        case'stateful':
            response=await appsApi.readNamespacedStatefulSet(setName, namespace);
            break;
    }

    const matchLabels = response.body.spec?.selector.matchLabels;
    const labelSelector = Object.entries(matchLabels || {})
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    const pods = (await coreApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, labelSelector)).body.items;
    return  { pods, labelSelector };
}