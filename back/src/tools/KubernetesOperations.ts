import { AppsV1Api, CoreV1Api } from "@kubernetes/client-node";

/**
 * 
 * @param coreApi K8 core API
 * @param appsApi K8 apps API
 * @param namespace namespace
 * @param group a name of a deployment or a qualified name of a group, thta is 'type+name', example: replica+rs1, stateful+mongo, daemon+monitoring 
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
 * @param group a name of a deployment or a qualified name of a group, thta is 'type+name', example: replica+rs1, stateful+mongo, daemon+monitoring
 * @returns an object iwth the list of pods and the labelSelector used
 */
export const getPodsFromGroup = async (coreApi:CoreV1Api, appsApi:AppsV1Api, namespace:string, group:string) => {
    var response:any
    var groupName, groupType
    var emptyResult = { pods:[],labelSelector:'' }

    if (group.includes('+'))
        [groupType, groupName]=group.split('+')
    else
        [groupType, groupName]=['deployment', group]

    try {
        switch (groupType) {
            case'deployment': {
                    let x = await appsApi.listNamespacedDeployment(namespace)
                    let names = x.body.items.map (rs => rs.metadata?.name)
                    if (!names.includes(groupName)) return emptyResult
                    response = await appsApi.readNamespacedDeployment(groupName, namespace)
                }
                break
            case'replica': {
                    let x = await appsApi.listNamespacedReplicaSet(namespace)
                    let names = x.body.items.map (rs => rs.metadata?.name)
                    if (!names.includes(groupName)) return emptyResult
                    response = await appsApi.readNamespacedReplicaSet(groupName, namespace)
                }
                break
            case'daemon': {
                    let x = await appsApi.listNamespacedDaemonSet(namespace)
                    let names = x.body.items.map (rs => rs.metadata?.name)
                    if (!names.includes(groupName)) return emptyResult
                    response = await appsApi.readNamespacedDaemonSet(groupName, namespace)
                }
                break
            case'stateful': {
                    let x = await appsApi.listNamespacedStatefulSet(namespace)
                    let names = x.body.items.map (rs => rs.metadata?.name)
                    if (!names.includes(groupName)) return emptyResult
                    response = await appsApi.readNamespacedStatefulSet(groupName, namespace)
                }
                break
        }    
    }
    catch (error) {
        console.log('Error reading namespaced group: ', error)
        return emptyResult
    }

    const matchLabels = response.body.spec?.selector.matchLabels
    const labelSelector = Object.entries(matchLabels || {}).map(([key, value]) => `${key}=${value}`).join(',')
    const pods = (await coreApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, labelSelector)).body.items
    return  { pods, labelSelector }
}