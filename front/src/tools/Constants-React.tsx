// app icons 
import SvgIconDeployment from'../icons/svg/dp.svg'
import SvgIconReplicaSet from'../icons/svg/rs.svg'
import SvgIconReplicationController from'../icons/svg/rc.svg'
import SvgIconDaemonSet from'../icons/svg/ds.svg'
import SvgIconStatefulSet from'../icons/svg/ss.svg'
import SvgIconJob from'../icons/svg/job.svg'

import SvgIconConfigMap from '../kubernetes-icons-official/svg/resources/labeled/cm.svg'
import SvgIconSecret from '../kubernetes-icons-official/svg/resources/labeled/secret.svg'
import SvgIconService from '../kubernetes-icons-official/svg/resources/labeled/svc.svg'
import SvgIconEndpoints from '../kubernetes-icons-official/svg/resources/labeled/ep.svg'
import SvgIconIngress from '../kubernetes-icons-official/svg/resources/labeled/ing.svg'
import SvgIconPersistentVolume from '../kubernetes-icons-official/svg/resources/labeled/pv.svg'
import SvgIconPersistentVolumeClaim from '../kubernetes-icons-official/svg/resources/labeled/pvc.svg'
import SvgIconClusterRole from '../kubernetes-icons-official/svg/resources/labeled/c-role.svg'
import SvgIconClusterRoleBinding from '../kubernetes-icons-official/svg/resources/labeled/crb.svg'
import SvgIconRole from '../kubernetes-icons-official/svg/resources/labeled/role.svg'
import SvgIconRoleBinding from '../kubernetes-icons-official/svg/resources/labeled/rb.svg'
import SvgIconCronJob from '../kubernetes-icons-official/svg/resources/labeled/cronjob.svg'

import SvgIconKubernetesUnknown from'../icons/svg/k8s-unknown.svg'
import SvgIconKubernetesBlank from'../icons/svg/k8s-blank.svg'
import SvgIconKubernetes from'../icons/svg/k8s.svg'
import SvgIconDocker from'../icons/svg/docker-mark-blue.svg'

import SvgIconAks from'../icons/general/aks.svg'
import SvgIconEks from'../icons/general/eks.svg'
import SvgIconGke from'../icons/general/gke.svg'
import SvgIconRk2e from'../icons/general/rk2e.svg'
import SvgIconK3d from'../icons/general/k3d.svg'
import SvgIconK3s from'../icons/general/k3s.svg'
import SvgIconK8s from'../icons/general/k8s.svg'
import SvgIconOcp from'../icons/general/ocp.svg'

import SvgIconNamespace from'../icons/svg/ns.svg'
import SvgIconPod from'../icons/svg/pod.svg'
import SvgIconGroup from'../icons/svg/group.svg'
import SvgIconContainer from'../icons/svg/docker-mark-blue.svg'
import SvgIconBlank from'../icons/svg/k8s-blank.svg'

export const IconDeployment = (props: {height?:number}) => <img src={SvgIconDeployment} alt='ss' height={`${props.height||16}px`}/>
export const IconReplicaSet = (props: {height?:number}) => <img src={SvgIconReplicaSet} alt='rs' height={`${props.height||16}px`}/>
export const IconReplicationController = (props: {height?:number}) => <img src={SvgIconReplicationController} alt='rc' height={`${props.height||16}px`}/>
export const IconDaemonSet = (props: {height?:number}) => <img src={SvgIconDaemonSet} alt='ds' height={`${props.height || 16}px`}/>
export const IconStatefulSet = (props: {height?:number}) => <img src={SvgIconStatefulSet} alt='ss' height={`${props.height||16}||16px`}/>
export const IconJob = (props: {height?:number}) => <img src={SvgIconJob} alt='ss' height={`${props.height||16}||16px`}/>
export const IconCronJob = (props: {height?:number}) => <img src={SvgIconCronJob} alt='cj' height={`${props.height||16}||16px`}/>

export const IconConfigMap = (props: {height?:number}) => <img src={SvgIconConfigMap} alt='cm' height={`${props.height||16}||16px`}/>
export const IconSecret = (props: {height?:number}) => <img src={SvgIconSecret} alt='secret' height={`${props.height||16}||16px`}/>
export const IconService = (props: {height?:number}) => <img src={SvgIconService} alt='service' height={`${props.height||16}||16px`}/>
export const IconEndpoints = (props: {height?:number}) => <img src={SvgIconEndpoints} alt='ep' height={`${props.height||16}||16px`}/>
export const IconIngress = (props: {height?:number}) => <img src={SvgIconIngress} alt='ingress' height={`${props.height||16}||16px`}/>
export const IconPersistentVolume = (props: {height?:number}) => <img src={SvgIconPersistentVolume} alt='secret' height={`${props.height||16}||16px`}/>
export const IconPersistentVolumeClaim = (props: {height?:number}) => <img src={SvgIconPersistentVolumeClaim} alt='secret' height={`${props.height||16}||16px`}/>
export const IconRole = (props: {height?:number}) => <img src={SvgIconRole} alt='role' height={`${props.height||16}||16px`}/>
export const IconRoleBinding = (props: {height?:number}) => <img src={SvgIconRoleBinding} alt='rb' height={`${props.height||16}||16px`}/>
export const IconClusterRole = (props: {height?:number}) => <img src={SvgIconClusterRole} alt='cr' height={`${props.height||16}||16px`}/>
export const IconClusterRoleBinding = (props: {height?:number}) => <img src={SvgIconClusterRoleBinding} alt='crb' height={`${props.height||16}||16px`}/>

export const IconKubernetesUnknown = (props: {height?:number}) => <img src={SvgIconKubernetesUnknown} alt='kubernetes' height={`${props.height||16}px`}/>
export const IconKubernetesBlank = (props: {height?:number}) => <img src={SvgIconKubernetesBlank} alt='kubernetes' height={`${props.height||16}px`}/>
export const IconKubernetes = (props: {height?:number}) => <img src={SvgIconKubernetes} alt='kubernetes' height={`${props.height||16}px`}/>
export const IconDocker = (props: {height?:number}) => <img src={SvgIconDocker} alt='docker' height={`${props.height||16}px`}/>


export const IconAks = (props: {height?:number}) => { return <img src={SvgIconAks} alt='ns' height={`${props.height||16}px`}/> }
export const IconEks = (props: {height?:number}) => { return <img src={SvgIconEks} alt='ns' height={`${props.height||16}px`}/> }
export const IconGke = (props: {height?:number}) => { return <img src={SvgIconGke} alt='ns' height={`${props.height||16}px`}/> }
export const IconRk2e = (props: {height?:number}) => { return <img src={SvgIconRk2e} alt='ns' height={`${props.height||16}px`}/> }
export const IconK3d = (props: {height?:number}) => { return <img src={SvgIconK3d} alt='ns' height={`${props.height||16}px`}/> }
export const IconK3s = (props: {height?:number}) => { return <img src={SvgIconK3s} alt='ns' height={`${props.height||16}px`}/> }
export const IconK8s = (props: {height?:number}) => { return <img src={SvgIconK8s} alt='ns' height={`${props.height||16}px`}/> }
export const IconOcp = (props: {height?:number}) => { return <img src={SvgIconOcp} alt='ns' height={`${props.height||16}px`}/> }

export const IconBlank = (props: {height?:number}) => { return <img src={SvgIconBlank} alt='ns' height={`${props.height||16}px`}/> }
export const IconNamespace = (props: {height?:number}) => { return <img src={SvgIconNamespace} alt='ns' height={`${props.height||16}px`}/> }
export const IconGroup = (props: {height?:number}) => { return <img src={SvgIconGroup} alt='grp' height={`${props.height||16}px`}/> }
export const IconPod = (props: {height?:number}) => { return <img src={SvgIconPod} alt='pod' height={`${props.height||16}px`}/> }
export const IconContainer = (props: {height?:number}) => { return <img src={SvgIconContainer} alt='container' height={`${props.height||16}px`}/> }

export const getIconFromKind = (kind:string, size:number) => {
    switch (kind) {
        case 'Namespace': return <IconNamespace height={size}/>
        case 'Job': return <IconJob height={size}/>
        case 'CronJob': return <IconCronJob height={size}/>
        case 'Pod': return <IconPod height={size}/>
        case 'Deployment': return <IconDeployment height={size}/>
        case 'ReplicaSet': return <IconReplicaSet height={size}/>
        case 'DaemonSet': return <IconDaemonSet height={size}/>
        case 'StatefulSet': return <IconStatefulSet height={size}/>
        case 'ReplicationController': return <IconReplicationController height={size}/>
        case 'ConfigMap': return <IconDaemonSet height={size}/>
        case 'Secret': return <IconDaemonSet height={size}/>
        case 'Service': return <IconService height={size}/>
        case 'Endpoints': return <IconEndpoints height={size}/>
        case 'Ingress': return <IconIngress height={size}/>
        case 'PersistentVolume': return <IconPersistentVolume height={size}/>
        case 'PersistentVolumeClaim': return <IconPersistentVolumeClaim height={size}/>
        case 'Role': return <IconRole height={size}/>
        case 'RoleBinding': return <IconRoleBinding height={size}/>
        case 'ClusterRole': return <IconClusterRole height={size}/>
        case 'ClusterRoleBinding': return <IconClusterRoleBinding height={size}/>
        default: return <IconBlank height={size}/>
    }
}