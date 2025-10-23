// app icons 
import SvgIconDaemonSet from'../icons/svg/ds.svg'
import SvgIconReplicaSet from'../icons/svg/rs.svg'
import SvgIconStatefulSet from'../icons/svg/ss.svg'
import SvgIconDeployment from'../icons/svg/dp.svg'

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

export const IconDaemonSet = (props: {height?:number}) => <img src={SvgIconDaemonSet} alt='ds' height={`${props.height || 16}px`}/>
export const IconReplicaSet = (props: {height?:number}) => <img src={SvgIconReplicaSet} alt='rs' height={`${props.height||16}px`}/>
export const IconStatefulSet = (props: {height?:number}) => <img src={SvgIconStatefulSet} alt='ss' height={`${props.height||16}||16px`}/>
export const IconDeployment = (props: {height?:number}) => <img src={SvgIconDeployment} alt='ss' height={`${props.height||16}px`}/>

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
export const IconContainer = (props: {height?:number}) => { return <img src={SvgIconContainer} height={`${props.height||16}px`}/> }
