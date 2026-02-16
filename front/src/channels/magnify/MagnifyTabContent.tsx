import React, { act } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { IChannelObject, IContentProps } from '../IChannel'
import { EMagnifyCommand, IMagnifyMessage, IMagnifyData } from './MagnifyData'
import { Box, Button, Card, CardContent, CardHeader, Divider, Stack, Tooltip, Typography } from '@mui/material'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, EInstanceConfigView } from '@jfvilas/kwirth-common'
import { ICategory, IError, IFileManagerHandle, IFileObject, ISpace, ISpaceMenuItem } from '@jfvilas/react-file-manager'
import { FileManager } from '@jfvilas/react-file-manager'
import { v4 as uuid } from 'uuid'
import { IMagnifyConfig } from './MagnifyConfig'
import { ENotifyLevel } from '../../tools/Global'
import { actions, icons, menu, spaces } from './components/RFMConfig'
import { IDetailsSection } from './components/DetailsObject'
import { objectSections, podsSection } from './components/DetailsSections'
import { Edit, EditOff, List } from '@mui/icons-material'
import { MsgBoxButtons, MsgBoxOkError, MsgBoxYesNo } from '../../tools/MsgBox'
import { ContentExternal, IContentExternalObject, IContentExternalOptions } from './components/ContentExternal'
import { ContentDetails, IContentDetailsObject } from './components/ContentDetails'
import { ContentEdit, IContentEditObject } from './components/ContentEdit'
import { ContainersMenu } from './components/ContainersMenu'
import { UserPreferences } from './components/UserPreferences'
import { buildPath, requestList } from './MagnifyChannel'
import { InputBox } from '../../tools/FrontTools'
import { templates } from './components/Templates'
import { convertBytesToSize, convertSizeToBytes, getNextCronExecution } from './Tools'
import '@jfvilas/react-file-manager/dist/style.css'
import './custom-fm.css'
import { ClusterMetrics } from './components/ClusterMetrics'
import { ArtifactSearch } from './components/ArtifactSearch'
import { Validations } from './components/Validations'

const yamlParser = require('js-yaml')

const MagnifyTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    let magnifyData:IMagnifyData = props.channelObject.data
    let permissions = {
        create: false,
        delete: false,
        download: false,
        copy: false,
        move: false,
        rename: false,
        upload: false
    }

    const fileManagerRef = useRef<IFileManagerHandle>(null)
    const magnifyBoxRef = useRef<HTMLDivElement | null>(null)
    const [magnifyBoxHeight, setMagnifyBoxHeight] = useState(0)
    const [msgBox, setMsgBox] = useState(<></>)

    const [contentEditVisible, setContentEditVisible] = useState(false)
    const [contentEditAllowEdit, setContentEditAllowEdit] = useState(false)
    const [contentEditNew, setContentEditNew] = useState<string>('')
    const contentWindowId = useRef<number>(-1)

    const [contentExternalVisible, setContentExternalVisible] = useState<boolean>(false)
    const [contentExternalType, setContentExternalType] = useState<string>('')
    const [contentExternalView, setContentExternalView] = useState<EInstanceConfigView>(EInstanceConfigView.POD)
    const [contentExternalTitle, setContentExternalTitle] = useState<string>('n/a')
    const [contentExternalContainer, setContentExternalContainer] = useState<string|undefined>('')
    const [contentExternalOptions, setContentExternalOptions] = useState<IContentExternalOptions>({
        autostart:false, pauseable: true, stopable:true, configurable:false
    })

    const [inputBoxTitle, setInputBoxTitle] = useState<any>()
    const [inputBoxMessage, setInputBoxMessage] = useState<any>()
    const [inputBoxDefault, setInputBoxDefault] = useState<any>()
    const [inputBoxResult, setInputBoxResult] = useState<(result:any) => void>()

    const [selectedFiles, setSelectedFiles] = useState<IFileObject[]>([])

    const [leftMenuAnchorParent, setLeftMenuAnchorParent] = useState<Element>()
    const [containersMenuContent, setLeftMenuContent] = useState<any>()
    const [leftMenuIncludeAllContainers, setLeftMenuIncludeAllContainers] = useState<boolean>(false)
    
    const [contentDetailsVisible, setContentDetailsVisible] = useState(false)
    const [detailsSections, setDetailsSections] = useState<IDetailsSection[]>([])
    const [contentDetailsActions, setContentDetailsActions] = useState<ISpaceMenuItem[]>([])
    const [contentDetailsTarget, setContentDetailsTarget] = useState<Element>()

    const [searchVisible, setSearchVisible] = useState(false)
    const [searchScope, setSearchScope] = useState('')

    const [refresh, setRefresh] = useState<number>(Math.random())


    // RFM categories
    const onCategoryFilter = (categoryKey:string, f:IFileObject) : boolean => {
        let cat = categories.find(c => c.key===categoryKey)
        if (!cat) return true

        let valid=true
        switch(categoryKey) {
            case 'namespace':
                valid = cat.selected.includes('all') || cat.selected.some(cat => f.data?.origin?.metadata?.namespace?.includes(cat))
                break
            case 'controller':
                valid = cat.selected.includes('all') || cat.selected.some(cat => f.data?.origin?.metadata?.ownerReferences?.[0]?.kind.includes(cat))
                break
        }
        return valid
    }
    const isFilterActive = (categoryKey:string) : boolean => {
        let cat = categories.find(c => c.key===categoryKey)
        if (!cat) return false
        return !(cat.selected.length===1 && cat.selected[0]==='all')
    }
    const onCategoryValuesChange = (categoryKey:string, categoryValue:string, selected:string[]) => {
        let cat = categories.find(c => c.key===categoryKey)
        if (!cat) return

        if (categoryValue==='all') selected=['all']
        else if (categoryValue!=='all' && selected.length===2 && selected.includes('all')) selected=selected.filter(f => f!=='all')
        else if (selected.length===0) selected=['all']

        cat.selected = selected
        setCategories ([ ...categories ])
    }
    const [categories, setCategories] = useState<ICategory[]>([
        {
            key:'namespace',
            text: 'Namespace',
            all: [ {key:'all',text:'All...'}, {key:'-'} ],
            selected: ['all'],
            onCategoryValuesChange: onCategoryValuesChange,
            onCategoryFilter: onCategoryFilter,
            isFilterActive: isFilterActive
        },
        {
            key:'controller',
            text: 'Controller',
            all: [ {key:'all',text:'All...'}, {key:'-'} , {key:'ReplicaSet'} , {key:'DaemonSet'} , {key:'StatefulSet'} , {key:'ReplicationController'}, {key:'Job'}  ],
            selected: ['all'],
            onCategoryValuesChange: onCategoryValuesChange,
            onCategoryFilter: onCategoryFilter,
            isFilterActive: isFilterActive
        }
    ])

    useLayoutEffect(() => {
        const observer = new ResizeObserver(() => {
            if (!magnifyBoxRef.current) return
            const { top } = magnifyBoxRef.current.getBoundingClientRect()
            let a = window.innerHeight - top - 160
            setMagnifyBoxHeight(a)
        })
        observer.observe(document.body)

        return () => observer.disconnect()
    }, [magnifyBoxRef.current])

    useEffect(() => {
        if (!magnifyData.files.some(f => f.path ==='/overview')) {
            magnifyData.files.push(...menu)
        }

        let podsItem = podsSection.items.find(item => item.name === 'pods')
        if (podsItem) {
            podsItem.invoke = (rootObj, port) => { 
                let controllerKind = rootObj.kind
                let allPods = magnifyData.files.filter(f => f.path.startsWith('/workload/Pod/'))
                allPods = allPods.filter(f => {
                    let isOwner = false
                    if (controllerKind === 'Deployment') {
                        let rsOwners = f.data.origin.metadata.ownerReferences.filter((o:any) => o.kind === 'ReplicaSet')
                        if (rsOwners && rsOwners.length>0) {
                            let rs = magnifyData.files.find(f => f.path===`/workload/ReplicaSet/${rsOwners[0].name}:${rootObj.metadata.namespace}`)
                            isOwner = rs && rs.data.origin.metadata.ownerReferences.some((or:any) => or.kind==='Deployment' && or.name===rootObj.metadata.name)
                        }
                    }
                    else {
                        isOwner = f.data.origin.metadata.ownerReferences.some((o:any) => o.kind === controllerKind && o.name === rootObj.metadata.name)
                    }
                    if (isOwner) return f
                })
                return allPods.map(f => f.data.origin)
            }
        }

        // Main menu
            setPathFunction('/overview', showOverview)
            setPathFunction('/cluster', showBackground)
            setPathFunction('/workload', showBackground)
            setPathFunction('/config', showBackground)
            setPathFunction('/network', showBackground)
            setPathFunction('/storage', showBackground)
            setPathFunction('/access', showBackground)
            setPathFunction('/custom', showBackground)
            setPathFunction('/cluster/overview', showClusterOverview)
            setPathFunction('/workload/overview', showWorkloadOverview)
            setPathFunction('/network/overview', showNetworkOverview)
            setPathFunction('/config/overview', showConfigOverview)
            setPathFunction('/storage/overview', showStorageOverview)
            setPathFunction('/preferences', showPreferences)

        // Workload
            // Pod
            let spcClassPod = spaces.get('classPod')!
            setLeftItem(spcClassPod, 'create', () => launchObjectCreate('Pod'))
            let spcPod = spaces.get('Pod')!
            setPropertyFunction(spcPod, 'container', showPodContainers)
            setPropertyFunction(spcPod, 'status', showPodStatus)
            setLeftItem(spcPod,'shell', launchPodShell)
            setLeftItem(spcPod,'forward', launchPodForward)
            setLeftItem(spcPod,'log', launchPodLogs)
            setLeftItem(spcPod,'metrics', launchPodMetrics)
            setLeftItem(spcPod,'fileman', launchPodFileman)
            setLeftItem(spcPod,'details', launchObjectDetails)
            setLeftItem(spcPod,'edit', launchObjectEdit)
            setLeftItem(spcPod,'delete', launchObjectDelete)
            setLeftItem(spcPod,'evict', launchPodEvict)
            let objPod = objectSections.get('Pod')
            if (objPod) {
                let item = objPod.find(o => o.name==='containers')!.items.find(item => item.name === 'container')
                item = item!.items!.find (i => i.name==='ports')!.items!.find (i => i.name==='forward')
                if (item) {
                    item.invoke = (rootObj, port) => { 
                        return buildForward(rootObj, port.name, port.protocol, port.containerPort)
                    }
                }
            }

            // Deployment
            let spcClassDeployment = spaces.get('classDeployment')!
            setLeftItem(spcClassDeployment, 'create', () => launchObjectCreate('Deployment'))
            let spcDeployment = spaces.get('Deployment')!
            setPropertyFunction(spcDeployment, 'status', showDeploymentStatus)
            setLeftItem(spcDeployment,'details', launchObjectDetails)
            setLeftItem(spcDeployment,'scale', launchControllerScale)
            setLeftItem(spcDeployment,'restart', launchControllerRestart)
            setLeftItem(spcDeployment,'log', launchGroupLogs)
            setLeftItem(spcDeployment,'metrics', launchGroupMetrics)
            setLeftItem(spcDeployment,'edit', launchObjectEdit)
            setLeftItem(spcDeployment,'delete', launchObjectDelete)
            
            // DaemonSet
            let spcClassDaemonSet = spaces.get('classDaemonSet')!
            setLeftItem(spcClassDaemonSet, 'create', () => launchObjectCreate('DaemonSet'))
            let spcDaemonSet = spaces.get('DaemonSet')!
            setLeftItem(spcDaemonSet,'details', launchObjectDetails)
            setLeftItem(spcDaemonSet,'restart', launchControllerRestart)
            setLeftItem(spcDaemonSet,'log', launchGroupLogs)
            setLeftItem(spcDaemonSet,'metrics', launchGroupMetrics)
            setLeftItem(spcDaemonSet,'edit', launchObjectEdit)
            setLeftItem(spcDaemonSet,'delete', launchObjectDelete)

            // ReplicaSet
            let spcClassReplicaSet = spaces.get('classReplicaSet')!
            setLeftItem(spcClassReplicaSet, 'create', () => launchObjectCreate('ReplicaSet'))
            let spcReplicaSet = spaces.get('ReplicaSet')!
            setLeftItem(spcReplicaSet,'details', launchObjectDetails)
            setLeftItem(spcReplicaSet,'scale', launchControllerScale)
            setLeftItem(spcReplicaSet,'log', launchGroupLogs)
            setLeftItem(spcReplicaSet,'metrics', launchGroupMetrics)
            setLeftItem(spcReplicaSet,'edit', launchObjectEdit)
            setLeftItem(spcReplicaSet,'delete', launchObjectDelete)

            // ReplicationController
            let spcClassReplicationController = spaces.get('classReplicationController')!
            setLeftItem(spcClassReplicationController, 'create', () => launchObjectCreate('ReplicationController'))
            let spcReplicationController = spaces.get('ReplicationController')!
            setLeftItem(spcReplicationController,'details', launchObjectDetails)
            setLeftItem(spcReplicationController,'restart', launchControllerRestart)
            setLeftItem(spcReplicationController,'scale', launchControllerScale)
            setLeftItem(spcReplicationController,'log', launchGroupLogs)
            setLeftItem(spcReplicationController,'metrics', launchGroupMetrics)
            setLeftItem(spcReplicationController,'edit', launchObjectEdit)
            setLeftItem(spcReplicationController,'delete', launchObjectDelete)

            // StatefulSet
            let spcClassStatefulSet = spaces.get('classStatefulSet')!
            setLeftItem(spcClassStatefulSet, 'create', () => launchObjectCreate('StatefulSet'))
            let spcStatefulSet = spaces.get('StatefulSet')!
            setLeftItem(spcStatefulSet,'details', launchObjectDetails)
            setLeftItem(spcStatefulSet,'scale', launchControllerScale)
            setLeftItem(spcStatefulSet,'restart', launchControllerRestart)
            setLeftItem(spcStatefulSet,'log', launchGroupLogs)
            setLeftItem(spcStatefulSet,'metrics', launchGroupMetrics)
            setLeftItem(spcStatefulSet,'edit', launchObjectEdit)
            setLeftItem(spcStatefulSet,'delete', launchObjectDelete)

            let spcClassJob = spaces.get('classJob')!
            setLeftItem(spcClassJob, 'create', () => launchObjectCreate('Job'))
            let spcJob = spaces.get('Job')!
            setPropertyFunction(spcJob, 'conditions', showJobConditions)
            setLeftItem(spcJob,'details', launchObjectDetails)
            setLeftItem(spcJob,'log', launchJobLogs)
            setLeftItem(spcJob,'edit', launchObjectEdit)
            setLeftItem(spcJob,'delete', launchObjectDelete)
            let spcClassCronJob = spaces.get('classCronJob')!
            setLeftItem(spcClassCronJob, 'create', () => launchObjectCreate('CronJob'))
            let spcCronJob = spaces.get('CronJob')!
            setPropertyFunction(spcCronJob, 'active', showCronJobActive)
            setPropertyFunction(spcCronJob, 'nextExecution', showCronJobNextExecution)
            setLeftItem(spcCronJob,'trigger', launchCronJobTrigger)
            setLeftItem(spcCronJob,'suspend', launchCronJobSuspend)
            setLeftItem(spcCronJob,'resume', launchCronJobResume)
            setLeftItem(spcCronJob,'details', launchObjectDetails)
            setLeftItem(spcCronJob,'edit', launchObjectEdit)
            setLeftItem(spcCronJob,'delete', launchObjectDelete)
            let objCronJob = objectSections.get('CronJob')
            if (objCronJob) {
                let item = objCronJob[0].items.find(item => item.name === 'nextExecution')
                if (item) {
                    item.invoke = (rootObj, obj) => {
                        let x = getNextCronExecution(obj.spec.schedule)
                        return [x?.isoString]
                    }
                }
                item = objCronJob[0].items.find(item => item.name === 'timeLeft')
                if (item) {
                    item.invoke = (rootObj, obj) => {
                        let x = getNextCronExecution(obj.spec.schedule)
                        return [`${x?.timeLeft.days}d${x?.timeLeft.hours}h${x?.timeLeft.minutes}m${x?.timeLeft.seconds}s`]
                    }
                }
                item = objCronJob[1].items.find(item => item.name === 'jobs')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        let allJobs = magnifyData.files.filter(f => f.path.startsWith('/workload/Job/'))
                        allJobs = allJobs.filter(f => {
                            const owners = f.data.origin.metadata.ownerReferences || []
                            return owners.some((owner:any) => owner.name === obj.metadata.name && owner.kind === 'CronJob')
                        })
                        allJobs = allJobs.map(f => f.data.origin)
                        return allJobs
                    }
                }
            }


        // Cluster

            // Node
            let spcNode = spaces.get('Node')!
            setLeftItem(spcNode,'details', launchObjectDetails)
            setLeftItem(spcNode,'cordon', launchNodeCordon)
            setLeftItem(spcNode,'uncordon', launchNodeUnCordon)
            setLeftItem(spcNode,'drain', launchNodeDrain)
            setLeftItem(spcNode,'edit', launchObjectEdit)
            setLeftItem(spcNode,'delete', launchObjectDelete)

            // APIResource
            let spcAPIResource = spaces.get('V1APIResource')!
            setLeftItem(spcAPIResource,'details', launchObjectDetails)
            setLeftItem(spcAPIResource,'browse', launchObjectBrowse)
            
            // Image
            let spcImage = spaces.get('Image')!
            setLeftItem(spcImage,'details', launchObjectDetails)
            
            // ClusterOverview
            let spcClassClusterOverview = spaces.get('classclusteroverview')!
            setLeftItem(spcClassClusterOverview,'search', launchSearch)

            // Namespace
            let spcClassNamespace = spaces.get('classNamespace')!
            setLeftItem(spcClassNamespace, 'create', launchNamespaceCreate)
            let spcNamespace = spaces.get('Namespace')!
            setLeftItem(spcNamespace,'details', launchObjectDetails)
            setLeftItem(spcNamespace,'edit', launchObjectEdit)
            setLeftItem(spcNamespace,'delete', launchObjectDelete)
            setLeftItem(spcNamespace,'search', launchSearch)
            let objNamespace = objectSections.get('Namespace')
            if (objNamespace) {
                let getElements = (namespace:string, kind:string): JSX.Element => {
                    let text=kind
                    if (kind.includes('+')) [kind, text] = kind.split('+')
                    let elements = magnifyData.files.filter(f => f.data?.origin?.kind === kind && f.data?.origin?.metadata.namespace===namespace)?.map(f => f.data?.origin)
                    if (elements.length===0) return <></>

                    return (
                        <Stack flexDirection={'row'}>
                            <Typography width={'13%'}>{text}</Typography>
                            <Stack flexDirection={'column'}>
                                {
                                    elements.map( (el, index) => {
                                        return <a key={index} href={`#`} onClick={() => onMagnifyObjectDetailsLink(kind, el.metadata.name, el.metadata.namespace)}>{el.metadata.name}</a>
                                    })
                                }
                            </Stack>
                        </Stack>
                    )                    
                }
                let item = objNamespace?.find(s => s.name==='content')?.items.find(item => item.name === 'content')
                if (item) {
                    item.invoke = (rootObj, obj) => {
                        return [
                            'Pod','Deployment','DaemonSet','ReplicaSet','ReplicationController+RepController','StatefulSet','Job','CronJob',
                            'PersistentVolumeClaim+PVC','PersistentVolume+PV',
                            'ConfigMap','Secret', 'Service','Endpoints','Ingress', 'Role','RoleBinding'
                        ].map (kind => getElements(obj.metadata.name, kind))
                    }
                }
            }

            // Namespace
            let spcClassComponentStatus = spaces.get('classComponentStatus')!
            let spcComponentStatus = spaces.get('ComponentStatus')!
            setLeftItem(spcComponentStatus,'details', launchObjectDetails)
            setLeftItem(spcComponentStatus,'browse', launchObjectBrowse)


        // Network

            // Service
            let spcClassService = spaces.get('classService')!
            setLeftItem(spcClassService, 'create', () => launchObjectCreate('Service'))
            let spcService = spaces.get('Service')!
            setPropertyFunction(spcService, 'selector', showServiceSelector)
            setLeftItem(spcService,'details', launchObjectDetails)
            setLeftItem(spcService,'edit', launchObjectEdit)
            setLeftItem(spcService,'delete', launchObjectDelete)
            let objService = objectSections.get('Service')
            if (objService) {
                let item = objService.find(o => o.name==='connection')!.items.find(item => item.name === 'ports')!.items!.find(item => item.name === 'forward')
                if (item) {
                    item.invoke = (rootObj, port) => { 
                        return buildForward(rootObj, port.name, port.protocol, port.targetPort)
                    }
                }
            }

            // Endpoints
            let spcClassEndpoints = spaces.get('classEndpoints')!
            setLeftItem(spcClassEndpoints, 'create', () => launchObjectCreate('Endpoints'))
            let spcEndpoints = spaces.get('Endpoints')!
            setLeftItem(spcEndpoints,'details', launchObjectDetails)
            setLeftItem(spcEndpoints,'edit', launchObjectEdit)
            setLeftItem(spcEndpoints,'delete', launchObjectDelete)


            // Ingress
            let spcClassIngress = spaces.get('classIngress')!
            setLeftItem(spcClassIngress, 'create', () => launchObjectCreate('Ingress'))
            let spcIngress = spaces.get('Ingress')!
            setPropertyFunction(spcIngress, 'rules', showIngressRules)
            setLeftItem(spcIngress,'details', launchObjectDetails)
            setLeftItem(spcIngress,'edit', launchObjectEdit)
            setLeftItem(spcIngress,'delete', launchObjectDelete)

            // IngressClass
            let spcClassIngressClass = spaces.get('classIngressClass')!
            setLeftItem(spcClassIngressClass, 'create', () => launchObjectCreate('IngressClass'))
            let spcIngressClass = spaces.get('IngressClass')!
            setLeftItem(spcIngressClass,'default', launchIngressClassDefault)
            setLeftItem(spcIngressClass,'details', launchObjectDetails)
            setLeftItem(spcIngressClass,'edit', launchObjectEdit)
            setLeftItem(spcIngressClass,'delete', launchObjectDelete)
            let objIngressClass = objectSections.get('IngressClass')
            if (objIngressClass) {
                let item = objIngressClass?.find(s => s.name==='properties')?.items.find(item => item.name === 'ingresses')
                if (item) {
                    item.invoke = (rootObj, obj) => {
                        let allIngresses = magnifyData.files.filter(f => f.path.startsWith('/network/Ingress/'))
                        allIngresses = allIngresses.filter(f => f.data.origin.spec?.ingressClassName === rootObj.metadata?.name || f.data.origin.metadata?.annotations?.['kubernetes.io/ingress.class'] === rootObj.metadata?.name)
                        return allIngresses.map(pvc => { return  {name: pvc.data.origin.metadata.name, namespace: pvc.data.origin.metadata.namespace} })
                    }
                }
            }

            // NetworkPolicy
            let spcClassNetworkPolicy = spaces.get('classNetworkPolicy')!
            setLeftItem(spcClassNetworkPolicy, 'create', () => launchObjectCreate('NetworkPolicy'))
            let spcNetworkPolicy = spaces.get('NetworkPolicy')!
            setLeftItem(spcNetworkPolicy,'details', launchObjectDetails)
            setLeftItem(spcNetworkPolicy,'edit', launchObjectEdit)
            setLeftItem(spcNetworkPolicy,'delete', launchObjectDelete)

        // Config

            // ConfigMap
            let spcClassConfigMap = spaces.get('classConfigMap')!
            setLeftItem(spcClassConfigMap, 'create', () => launchObjectCreate('ConfigMap'))
            let spcConfigMap = spaces.get('ConfigMap')!
            setLeftItem(spcConfigMap,'details', launchObjectDetails)
            setLeftItem(spcConfigMap,'edit', launchObjectEdit)
            setLeftItem(spcConfigMap,'delete', launchObjectDelete)

            // Secret
            let spcClassSecret = spaces.get('classSecret')!
            setLeftItem(spcClassSecret, 'create', () => launchObjectCreate('Secret'))
            let spcSecret = spaces.get('Secret')!
            setLeftItem(spcSecret,'details', launchObjectDetails)
            setLeftItem(spcSecret,'edit', launchObjectEdit)
            setLeftItem(spcSecret,'delete', launchObjectDelete)

            // ResourceQuota
            let spcClassResourceQuota = spaces.get('classResourceQuota')!
            setLeftItem(spcClassResourceQuota, 'create', () => launchObjectCreate('ResourceQuota'))
            let spcResourceQuota = spaces.get('ResourceQuota')!
            setLeftItem(spcResourceQuota,'details', launchObjectDetails)
            setLeftItem(spcResourceQuota,'edit', launchObjectEdit)
            setLeftItem(spcResourceQuota,'delete', launchObjectDelete)

            // Limir Range
            let spcClassLimitRange = spaces.get('classLimitRange')!
            setLeftItem(spcClassLimitRange, 'create', () => launchObjectCreate('LimitRange'))
            let spcLimitRange = spaces.get('LimitRange')!
            setLeftItem(spcLimitRange,'details', launchObjectDetails)
            setLeftItem(spcLimitRange,'edit', launchObjectEdit)
            setLeftItem(spcLimitRange,'delete', launchObjectDelete)

            // HorizontalPodAutoscaler
            let spcClassHorizontalPodAutoscaler = spaces.get('classHorizontalPodAutoscaler')!
            setLeftItem(spcClassHorizontalPodAutoscaler, 'create', () => launchObjectCreate('HorizontalPodAutoscaler'))
            let spcHorizontalPodAutoscaler = spaces.get('HorizontalPodAutoscaler')!
            setLeftItem(spcHorizontalPodAutoscaler,'details', launchObjectDetails)
            setLeftItem(spcHorizontalPodAutoscaler,'edit', launchObjectEdit)
            setLeftItem(spcHorizontalPodAutoscaler,'delete', launchObjectDelete)

            // PodDisruptionBudget
            let spcClassPodDisruptionBudget = spaces.get('classPodDisruptionBudget')!
            setLeftItem(spcClassPodDisruptionBudget, 'create', () => launchObjectCreate('PodDisruptionBudget'))
            let spcPodDisruptionBudget = spaces.get('PodDisruptionBudget')!
            setLeftItem(spcPodDisruptionBudget,'details', launchObjectDetails)
            setLeftItem(spcPodDisruptionBudget,'edit', launchObjectEdit)
            setLeftItem(spcPodDisruptionBudget,'delete', launchObjectDelete)

            // PriorityClass
            let spcClassPriorityClass = spaces.get('classPriorityClass')!
            setLeftItem(spcClassPriorityClass, 'create', () => launchObjectCreate('PriorityClass'))
            let spcPriorityClass = spaces.get('PriorityClass')!
            setLeftItem(spcPriorityClass,'details', launchObjectDetails)
            setLeftItem(spcPriorityClass,'edit', launchObjectEdit)
            setLeftItem(spcPriorityClass,'delete', launchObjectDelete)

            // RuntimeClass
            let spcClassRuntimeClass = spaces.get('classRuntimeClass')!
            setLeftItem(spcClassRuntimeClass, 'create', () => launchObjectCreate('RuntimeClass'))
            let spcRuntimeClass = spaces.get('RuntimeClass')!
            setLeftItem(spcRuntimeClass,'details', launchObjectDetails)
            setLeftItem(spcRuntimeClass,'edit', launchObjectEdit)
            setLeftItem(spcRuntimeClass,'delete', launchObjectDelete)

            // Lease
            let spcClassLease = spaces.get('classLease')!
            setLeftItem(spcClassLease, 'create', () => launchObjectCreate('Lease'))
            let spcLease = spaces.get('Lease')!
            setLeftItem(spcLease,'details', launchObjectDetails)
            setLeftItem(spcLease,'edit', launchObjectEdit)
            setLeftItem(spcLease,'delete', launchObjectDelete)

            // ValidatingWebhookConfiguration
            let spcClassValidatingWebhookConfiguration = spaces.get('classValidatingWebhookConfiguration')!
            setLeftItem(spcClassValidatingWebhookConfiguration, 'create', () => launchObjectCreate('ValidatingWebhookConfiguration'))
            let spcValidatingWebhookConfiguration = spaces.get('ValidatingWebhookConfiguration')!
            setLeftItem(spcValidatingWebhookConfiguration,'details', launchObjectDetails)
            setLeftItem(spcValidatingWebhookConfiguration,'edit', launchObjectEdit)
            setLeftItem(spcValidatingWebhookConfiguration,'delete', launchObjectDelete)
            
            // MutatingWebhookConfiguration
            let spcClassMutatingWebhookConfiguration = spaces.get('classMutatingWebhookConfiguration')!
            setLeftItem(spcClassMutatingWebhookConfiguration, 'create', () => launchObjectCreate('MutatingWebhookConfiguration'))
            let spcMutatingWebhookConfiguration = spaces.get('MutatingWebhookConfiguration')!
            setLeftItem(spcMutatingWebhookConfiguration,'details', launchObjectDetails)
            setLeftItem(spcMutatingWebhookConfiguration,'edit', launchObjectEdit)
            setLeftItem(spcMutatingWebhookConfiguration,'delete', launchObjectDelete)
            
        // Storage

            // PersistentVolumeClaim
            let spcClassPersistentVolumeClaim = spaces.get('classPersistentVolumeClaim')!
            setLeftItem(spcClassPersistentVolumeClaim, 'create', () => launchObjectCreate('PersistentVolumeClaim'))
            let spcPersistentVolumeClaim = spaces.get('PersistentVolumeClaim')!
            setLeftItem(spcPersistentVolumeClaim,'details', launchObjectDetails)
            setLeftItem(spcPersistentVolumeClaim,'edit', launchObjectEdit)
            setLeftItem(spcPersistentVolumeClaim,'delete', launchObjectDelete)
            let objPersistentVolumeClaim = objectSections.get('PersistentVolumeClaim')
            if (objPersistentVolumeClaim) {
                let item = objPersistentVolumeClaim.find(i => i.name==='properties')!.items.find(item => item.name === 'pods')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        let allPods = magnifyData.files.filter(f => f.path.startsWith('/workload/Pod/'))
                        let pods = allPods.filter(f => f.data.origin.spec?.volumes?.some( (vol:any) => vol.persistentVolumeClaim?.claimName === obj.metadata.name))
                        let allPodNames = pods.map(f => f.data.origin.metadata.name)
                        return allPodNames
                    }
                }
            }

            // PersistentVolume
            let spcClassPersistentVolume = spaces.get('classPersistentVolume')!
            setLeftItem(spcClassPersistentVolume, 'create', () => launchObjectCreate('PersistentVolume'))
            let spcPersistentVolume = spaces.get('PersistentVolume')!
            setLeftItem(spcPersistentVolume,'details', launchObjectDetails)
            setLeftItem(spcPersistentVolume,'edit', launchObjectEdit)
            setLeftItem(spcPersistentVolume,'delete', launchObjectDelete)

            // StorageClass
            let spcClassStorageClass = spaces.get('classStorageClass')!
            setLeftItem(spcClassStorageClass, 'create', () => launchObjectCreate('StorageClass'))
            let spcStorageClass = spaces.get('StorageClass')!
            setLeftItem(spcStorageClass,'details', launchObjectDetails)
            setLeftItem(spcStorageClass,'edit', launchObjectEdit)
            setLeftItem(spcStorageClass,'delete', launchObjectDelete)
            let objStorageClass = objectSections.get('StorageClass')
            if (objStorageClass) {
                let item = objStorageClass.find(i => i.name==='properties')!.items.find(item => item.name === 'pvs')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        let allPvs = magnifyData.files.filter(f => f.path.startsWith('/storage/PersistentVolume/'))
                        allPvs = allPvs.filter(f => f.data.origin.spec?.storageClassName === rootObj.metadata.name)
                        return allPvs.map(pv => pv.data.origin.metadata.name)
                    }
                }
                item = objStorageClass.find(i => i.name==='properties')!.items.find(item => item.name === 'pvcs')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        let allPvcs = magnifyData.files.filter(f => f.path.startsWith('/storage/PersistentVolumeClaim/'))
                        allPvcs = allPvcs.filter(f => f.data.origin.spec?.storageClassName === rootObj.metadata.name)
                        return allPvcs.map(pvc => { return  {name: pvc.data.origin.metadata.name, namespace: pvc.data.origin.metadata.namespace} })
                    }
                }
            }

            let spcClassVolumeAttachment = spaces.get('classStorageClass')!
            let spcVolumeAttachment = spaces.get('VolumeAttachment')!
            setLeftItem(spcVolumeAttachment,'details', launchObjectDetails)
            setLeftItem(spcVolumeAttachment,'browse', launchObjectBrowse)

            let spcClassCSIDriver = spaces.get('classCSIDriver')!
            let spcCSIDriver = spaces.get('CSIDriver')!
            setLeftItem(spcCSIDriver,'details', launchObjectDetails)
            setLeftItem(spcCSIDriver,'browse', launchObjectBrowse)
            let objCSIDriver = objectSections.get('CSIDriver')
            if (objCSIDriver) {
                let item = objCSIDriver?.find(s => s.name==='properties')?.items.find(item => item.name === 'storageClasses')
                if (item) {
                    item.invoke = (rootObj, obj) => {
                        let stgClasses = magnifyData.files.filter(f => f.path.startsWith('/storage/StorageClass/'))
                        return [
                            <Stack flexDirection={'row'}>
                                <Typography width={'13%'}>StgClass</Typography>
                                <Stack flexDirection={'column'}>
                                    {
                                        stgClasses.map( (i, index) => {
                                            if (i.data.origin.provisioner === rootObj.metadata?.name)
                                                return <a key={index} href={`#`} onClick={() => onMagnifyObjectDetailsLink('StorageClass', i.data.origin.metadata.name, '')}>{i.data.origin.metadata.name}</a>
                                        })                                    
                                    }
                                </Stack>
                            </Stack>
                        ]
                    }
                }
            }

            let spcClassCSINode = spaces.get('classCSINode')!
            let spcCSINode = spaces.get('CSINode')!
            setLeftItem(spcCSINode,'details', launchObjectDetails)
            setLeftItem(spcCSINode,'browse', launchObjectBrowse)

            let spcClassCSIStorageCapacity = spaces.get('classCSIStorageCapacity')!
            let spcCSIStorageCapacity = spaces.get('CSIStorageCapacity')!
            setLeftItem(spcCSIStorageCapacity,'details', launchObjectDetails)
            setLeftItem(spcCSIStorageCapacity,'browse', launchObjectBrowse)

        // Access

            // ServiceAccount
            let spcClassServiceAccount = spaces.get('classServiceAccount')!
            setLeftItem(spcClassServiceAccount, 'create', () => launchObjectCreate('ServiceAccount'))
            let spcServiceAccount = spaces.get('ServiceAccount')!
            setLeftItem(spcServiceAccount,'details', launchObjectDetails)
            setLeftItem(spcServiceAccount,'edit', launchObjectEdit)
            setLeftItem(spcServiceAccount,'delete', launchObjectDelete)
            let objServiceAccount = objectSections.get('ServiceAccount')
            if (objServiceAccount) {
                let item = objServiceAccount.find(s => s.name==='properties')!.items.find(item => item.name === 'tokens')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        let x = magnifyData.files.filter(f => f.data?.origin?.metadata?.annotations && f.data?.origin?.metadata?.namespace && f.data?.origin?.metadata?.annotations['kubernetes.io/service-account.name'] === "kwirth-sa" && f.data?.origin?.metadata?.namespace === obj.metadata.namespace)
                        return x.map(o => { return  { name:o.data.origin.metadata.name, namespace:o.data.origin.metadata.namespace}})
                    }
                }
            }


            // ClusterRole
            let spcClassClusterRole = spaces.get('classClusterRole')!
            setLeftItem(spcClassClusterRole, 'create', () => launchObjectCreate('ClusterRole'))
            let spcClusterRole = spaces.get('ClusterRole')!
            setLeftItem(spcClusterRole,'details', launchObjectDetails)
            setLeftItem(spcClusterRole,'edit', launchObjectEdit)
            setLeftItem(spcClusterRole,'delete', launchObjectDelete)

            // Role
            let spcClassRole = spaces.get('classRole')!
            setLeftItem(spcClassRole, 'create', () => launchObjectCreate('Role'))
            let spcRole = spaces.get('Role')!
            setLeftItem(spcRole,'details', launchObjectDetails)
            setLeftItem(spcRole,'edit', launchObjectEdit)
            setLeftItem(spcRole,'delete', launchObjectDelete)

            // ClusterRoleBinding
            let spcClassClusterRoleBinding = spaces.get('classClusterRoleBinding')!
            setLeftItem(spcClassClusterRoleBinding, 'create', () => launchObjectCreate('ClusterRoleBinding'))
            let spcClusterRoleBinding = spaces.get('ClusterRoleBinding')!
            setLeftItem(spcClusterRoleBinding,'details', launchObjectDetails)
            setLeftItem(spcClusterRoleBinding,'edit', launchObjectEdit)
            setLeftItem(spcClusterRoleBinding,'delete', launchObjectDelete)

            // RoleBinding
            let spcClassRoleBinding = spaces.get('classRoleBinding')!
            setLeftItem(spcClassRoleBinding, 'create', () => launchObjectCreate('RoleBinding'))
            let spcRoleBinding = spaces.get('RoleBinding')!
            setLeftItem(spcRoleBinding,'details', launchObjectDetails)
            setLeftItem(spcRoleBinding,'edit', launchObjectEdit)
            setLeftItem(spcRoleBinding,'delete', launchObjectDelete)


        // Custom

            // CustomResourceDefinition
            let spcClassCustomResourceDefinition = spaces.get('classCustomResourceDefinition')!
            setLeftItem(spcClassCustomResourceDefinition, 'create', () => launchObjectCreate('CustomResourceDefinition'))
            let spcCustomResourceDefinition = spaces.get('CustomResourceDefinition')!
            setLeftItem(spcCustomResourceDefinition,'details', launchObjectDetails)
            setLeftItem(spcCustomResourceDefinition,'edit', launchObjectEdit)
            setLeftItem(spcCustomResourceDefinition,'delete', launchObjectDelete)

            // crd instance
            let spcCrdInstance = spaces.get('crdinstance')!
            setLeftItem(spcCrdInstance, 'delete', launchObjectDelete)
            setLeftItem(spcCrdInstance, 'details', launchObjectDetails)

        // we need to do this because category data is lost when magnify tab is unmounted (we could move this into magnifyData strcuture in order to preserve)
        let namespaceCategory = categories.find(c => c.key==='namespace')
        if (namespaceCategory) {
            for (let f of magnifyData.files.filter(f => f.data?.origin?.kind==='Namespace')) {
                if (!namespaceCategory.all.some(cv => cv.key === f.name)) namespaceCategory.all.push({key:f.name, text:f.name})
            }
        }

        // we provide a mechanism for refreshing cluster usage charts
        magnifyData.refreshUsage = ()  => {
            setRefresh(Math.random())
        }

        // we privde a mechanism for refreshing namespace list when there is a change in namespaces (added/deleted)
        magnifyData.updateNamespaces = (action:string, namespace:string) => {
            let namespaceCategory = categories.find(c => c.key==='namespace')
            if (!namespaceCategory) return
            if (action==='DELETED') {
                namespaceCategory.all = namespaceCategory.all.filter(c => c.key !== namespace)
            }
            else {
                if (!namespaceCategory.all.some(c => c.key===namespace)) namespaceCategory.all.push({ key:namespace })
            }
        }

        return () => {
            // unmount actions
            // +++ we need to add a 'destroy' action for deleting data in addition to unmount (when required)
            setLeftMenuAnchorParent(undefined)
        }
    }, [])

    const buildForward = (rootObj:any, portName:string, portProtocol:string, portNumber:string) => {
        let url = '/kwirth/port-forward/pod/' + rootObj.metadata.namespace + '/' + rootObj.metadata.name + '/' + portNumber
        // sx={{width:'100%', justifyContent:'space-between'}}
        return <Stack direction={'row'} alignItems={'center'}>   
            <Stack direction={'row'} alignItems={'center'} >
                {portName && <Typography>{portName}:</Typography>}
                <Typography>{portNumber.toString().toLowerCase().replace('https','443').replace('http','80')}/{portProtocol}&nbsp;&nbsp;</Typography>
            </Stack>
            <Box sx={{ flexGrow: 1 }} />
            <Button onClick={() => window.open(url, '_blank')}>Forward</Button>
        </Stack>
    }

    // *********************************************************
    // Convenience functions for configuring item actions
    // *********************************************************
    const setPathFunction = (path:string, invoke:(id?:any) => void) => {
        let x = magnifyData.files.find(f => f.path===path)
        if (x) x.children = invoke
    }

    const setPropertyFunction = (space:ISpace, propName:string, invoke:(p:string) => void) => {
        if (!space.properties) return
        let prop = space.properties.find(p => p.name===propName)
        if (!prop) return
        prop.format = 'function'
        prop.source = invoke
    }

    const setLeftItem = (space:ISpace, name:string, invoke:(paths:string[], target?:any) => void) => {
        let x = space.leftItems?.find(li => li.name===name)
        if (x) x.onClick = invoke
    }

    const onContainerSelected = (container:string) => {
        setLeftMenuAnchorParent(undefined)

        if (container==='*all') {
            // we should be able to reuse this for FORWARD actions
            setContentExternalView(EInstanceConfigView.POD)
        }
        else {
            setContentExternalTitle(contentExternalTitle+'+'+container)
            setContentExternalContainer(container)
        }
        setContentExternalVisible(true)
    }

    const onContainersMenuClose = () => {
        setLeftMenuAnchorParent(undefined)
    }

    // *********************************************************
    // Actions
    // *********************************************************

    const launchObjectDetails = (p:string[], currentTarget?:Element) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        if (f[0].path.startsWith('/custom/') && !f[0].path.startsWith('/custom/CustomResourceDefinition/')) {
            setDetailsSections(objectSections.get('#crdinstance#')!)
        }
        else {
            setDetailsSections(objectSections.get(f[0].data.origin.kind)!)
            let spc = spaces.get(f[0].data.origin.kind)
            if (spc && spc.leftItems) setContentDetailsActions(spc.leftItems)

            // we request a fresh events list
            if (f[0].data.origin.metadata) {
                // objects APIResource doesnt contain metadata
                if (f[0].data.events) delete f[0].data.events
                sendCommand(EMagnifyCommand.EVENTS, ['object', f[0].data.origin.metadata.namespace, f[0].data.origin.kind, f[0].data.origin.metadata.name])
            }
            else {
                //magnifyData.files = [...magnifyData.files]
                // +++ para api resources esrto no es necesario, no hay eventos, pero al recibir una respusta a la consulta se dispara una action de REFRESH y se refresca
                sendCommand(EMagnifyCommand.EVENTS, ['object', undefined, f[0].data.origin.kind, f[0].data.origin.name])
            }
        }

        setSelectedFiles([f[0]])
        setContentDetailsTarget(currentTarget)
        setContentDetailsVisible(true)
    }

    const launchObjectCreate = (kind:string) => {
        let template = templates.get(kind) || `apiVersion: v1\nKind: ${kind}\nejemplo: true`
        setSelectedFiles([])
        setContentEditAllowEdit(true)
        setContentEditNew(template.trim())
        setContentEditVisible(true)
    }

    const launchObjectDelete = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setMsgBox(MsgBoxYesNo('Delete '+f[0].data.origin.kind,<Box>Are you sure you want to delete {f[0].data.origin.kind}<b> {f[0].displayName}</b>{p.length>1?` (and other ${p.length-1} items)`:''}?</Box>, setMsgBox, (a) => {
            if (a === MsgBoxButtons.Yes) {
                sendCommand(EMagnifyCommand.DELETE, f.map(o => yamlParser.dump(o.data.origin, { indent: 2 })))  //+++test
            }
        }))
    }

    const launchSearch = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        if (p[0]==='/cluster/overview') {
            setSearchScope(':cluster:')
            setSelectedFiles(magnifyData.files)
        }
        else {
            setSearchScope(f[0].data.origin.metadata.name)
            setSelectedFiles(magnifyData.files.filter(x => x.data?.origin?.metadata.namespace === f[0].data.origin.metadata.name))
        }
        setSearchVisible(true)
    }

    const launchObjectEdit = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setSelectedFiles([f[0]])
        setContentEditAllowEdit(true)
        setContentEditVisible(true)
    }

    const launchObjectBrowse = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setSelectedFiles([f[0]])
        setContentEditAllowEdit(false)
        setContentEditVisible(true)
    }

    const launchNamespaceCreate = (p:string[]) => {
        setInputBoxResult ( () => (name:any) => {
            if (name) {
                let obj = `
                    apiVersion: 'v1'
                    kind: 'Namespace'
                    metadata:
                        name: ${name}
                `
                sendCommand(EMagnifyCommand.CREATE, [obj])
            }
        })
        setInputBoxMessage('Enter namespace name')
        setInputBoxTitle('Create namespace')
    }

    // Pod actions
    const launchPodEvict = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setMsgBox(MsgBoxYesNo('Delete '+f[0].data.origin.kind,<Box>Are you sure you want to evict {f[0].data.origin.kind} <b>{f[0].data.origin.metadata.name}</b>?</Box>, setMsgBox, (a) => {
            if (a === MsgBoxButtons.Yes) {
                f.map(pod => sendCommand(EMagnifyCommand.POD, [ 'evict', pod.data.origin.metadata.namespace, pod.data.origin.metadata.name]))
            }
        }))
    }

    const launchControllerScale = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        
        if (f.length===1) {
            setInputBoxResult ( () => (value:any) => {
                if (value) sendCommand(EMagnifyCommand.CONTROLLER, [ 'scale', f[0].data.origin.kind, f[0].data.origin.metadata.namespace, f[0].data.origin.metadata.name, value])
            })
            setInputBoxMessage('Enter scaling value')
            setInputBoxDefault(f[0].data.origin.spec.replicas)
            setInputBoxTitle('Scale '+f[0].data.origin.kind)
        }
    }

    const launchPodLogs = (p:string[], currentTarget:Element) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setSelectedFiles(f)
        setContentExternalView(EInstanceConfigView.CONTAINER)
        setContentExternalTitle(f[0].data.origin.metadata.name)
        setContentExternalType('log')
        setContentExternalOptions({ autostart:true, pauseable:true, stopable:true, configurable:true})
        setLeftMenuContent(f[0])
        setLeftMenuIncludeAllContainers(true)
        setLeftMenuAnchorParent(currentTarget)
    }

    const launchPodFileman = (p:string[], currentTarget:Element) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setSelectedFiles(f)
        setContentExternalView(EInstanceConfigView.CONTAINER)
        setContentExternalTitle(f[0].data.origin.metadata.name)
        setContentExternalType('fileman')
        setContentExternalOptions({ autostart:true, pauseable:false, stopable:false, configurable:false})
        setLeftMenuContent(f[0])
        setLeftMenuIncludeAllContainers(false)
        setLeftMenuAnchorParent(currentTarget)
    }

    const launchPodShell = (p:string[], currentTarget:Element) => {
        console.log(p)
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setSelectedFiles(f)
        setContentExternalView(EInstanceConfigView.CONTAINER)
        setContentExternalTitle(f[0].data.origin.metadata.name)
        setContentExternalType('ops')
        setContentExternalOptions({ autostart:true, pauseable:false, stopable:false, configurable:false})
        setLeftMenuContent(f[0])
        setLeftMenuIncludeAllContainers(false)
        setLeftMenuAnchorParent(currentTarget)
    }

    const launchPodForward = (p:string[], currentTarget:Element) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setSelectedFiles(f)
        setLeftMenuContent(f[0])
        setLeftMenuIncludeAllContainers(false)
        setLeftMenuAnchorParent(currentTarget)
    }

    const launchPodMetrics = (p:string[], currentTarget:Element) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        if (!f) return
        setSelectedFiles(f)
        setContentExternalView(EInstanceConfigView.CONTAINER)
        setContentExternalOptions({ autostart:true, pauseable:true, stopable:true, configurable:true})
        setContentExternalTitle(f[0].data.origin.metadata.name)
        setContentExternalType('metrics')
        setLeftMenuContent(f[0])
        setLeftMenuIncludeAllContainers(true)
        setLeftMenuAnchorParent(currentTarget)
    }

    const showPodContainers = (p:any) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f) return
        if (!f.data?.origin?.status) return <></>
        let result:JSX.Element[]=[]
        if (f.data.origin.status.containerStatuses && f.data.origin.status.containerStatuses.length>0) {
            f.data.origin.status.containerStatuses.map((c:any, index:number) => {
                let color='orange'
                if (c.started) {
                    color='green'
                    if (f?.data.origin.metadata.deletionTimestamp) color = 'blue'
                }
                else {
                    if (c.state.terminated) color = 'gray'
                }
                result.push(<Box key={index} sx={{ width: '8px', height: '8px', backgroundColor: color, margin: '1px', display: 'inline-block' }}/>)
            })
        }
        return result
    }

    const showPodStatus = (p:any) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f || !f.data?.origin?.status) return <></>
        let status = f.data.origin?.metadata?.deletionTimestamp? 'Terminating' : f.data.origin?.status.phase
        return <Typography color={status==='Running'?'green':(status==='Terminating'?'blue':status==='Succeeded'?'gray':(status==='Pending'?'orange':'red'))} fontSize={12}>{status}</Typography>
    }

    const showDeploymentStatus = (p:any) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f || !f.data?.origin?.status) return <></>
        let status='Stalled'
        if (f.data.origin?.status?.conditions && f.data.origin.status.conditions.length>0) {
            if (f.data.origin.status.conditions.some((c:any) => c.type+c.status ==='AvailableTrue') && f.data.origin.status.conditions.some((c:any) => c.type+c.status ==='ProgressingTrue')) status='Running'
            else if (f.data.origin.status.conditions.some((c:any) => c.type+c.status ==='AvailableFalse') && f.data.origin.status.conditions.some((c:any) => c.type+c.status ==='ProgressingTrue')) status='Scaling'
        }
        return <Typography color={status==='Running'?'green':(status==='Scaling'?'orange':'red')} fontSize={12}>{status}</Typography>
    }

    // Ingress actions
    const showIngressRules = (p:any) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f) return
        if (!f.data?.origin?.spec?.rules) return <></>

        return <Stack direction={'column'}>
            {
                f.data.origin.spec.rules.map((rule:any,ruleIndex:number) => 
                    rule.http.paths.map ( (path:any, pathIndex:number) => 
                    <Typography key={ruleIndex+'-'+pathIndex} fontSize={12}>http://{rule.host}{path.path}&nbsp;&rarr;&nbsp;{path.backend.service.name}:{path.backend.service.port.number}</Typography>
                ))
            }
        </Stack>

    }

    // Service actions
    const showServiceSelector = (p:any) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f) return
        if (!f.data?.origin?.spec?.selector) return <></>
        return <Stack direction={'column'}>
            {
                Object.keys(f.data.origin.spec.selector).map( (key,index) => 
                    <Typography key={index}fontSize={12}>{key}={f?.data.origin.spec.selector[key]}</Typography>
                )
            }
        </Stack>

    }

    // Group actions
    const launchControllerRestart = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        
        if (f.length===1) {
            sendCommand(EMagnifyCommand.CONTROLLER, [ 'restart', f[0].data.origin.kind, f[0].data.origin.metadata.namespace, f[0].data.origin.metadata.name])
        }
    }

    const launchGroupLogs = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setContentExternalView(EInstanceConfigView.GROUP)
        setContentExternalTitle(f[0].data.origin.metadata.name)
        setSelectedFiles(f)
        setContentExternalType('log')
        setContentExternalVisible(true)
    }

    const launchGroupMetrics = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        //+++ falta decidir como agrupamos, group o merge: neceistamos un pequeño menu en externlaContent
        setContentExternalView(EInstanceConfigView.GROUP)
        setContentExternalTitle(f[0].data.origin.metadata.name)
        setSelectedFiles(f)
        setContentExternalType('metrics')
        setContentExternalVisible(true)
    }

    // Job actions
    const launchJobLogs = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setContentExternalView(EInstanceConfigView.GROUP)
        setContentExternalTitle(f[0].data.origin.metadata.name)
        setSelectedFiles(f)
        setContentExternalType('log')
        setContentExternalVisible(true)
    }

    const showJobConditions = (p:any) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f) return
        if (!f.data?.origin?.status?.conditions) return <></>
        let result:JSX.Element[]=[]
        for (let cond of f.data.origin.status.conditions) {
            if (cond.status==='True') result.push(<Typography key={cond.type} fontSize={12}>{cond.type}</Typography>)
        }
        return <Stack direction={'column'}>
            {result}
        </Stack>

    }

    // IngressClass actions
    const launchIngressClassDefault = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        f.map( one => sendCommand(EMagnifyCommand.INGRESSCLASS, [ 'default', one.data.origin.metadata.name]))
    }

    // Node actions
    const launchNodeDrain = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(EMagnifyCommand.NODE, ['drain',f[0].data.origin.metadata.name])
    }

    const launchNodeCordon = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(EMagnifyCommand.NODE, ['cordon', f[0].data.origin.metadata.name])
    }

    const launchNodeUnCordon = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(EMagnifyCommand.NODE, ['uncordon', f[0].data.origin.metadata.name])
    }

    // CronJob actions
    const launchCronJobTrigger = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(EMagnifyCommand.CRONJOB, ['trigger', f[0].data.origin.metadata.namespace, f[0].data.origin.metadata.name])
    }

    const launchCronJobSuspend = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(EMagnifyCommand.CRONJOB, ['suspend', f[0].data.origin.metadata.namespace, f[0].data.origin.metadata.name])
    }

    const launchCronJobResume = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(EMagnifyCommand.CRONJOB, ['resume', f[0].data.origin.metadata.namespace, f[0].data.origin.metadata.name])
    }

    const showCronJobNextExecution = (p:string) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f) return
        let x = getNextCronExecution(f.data.origin.spec.schedule)
        return [`${x?.timeLeft.days}d${x?.timeLeft.hours}h${x?.timeLeft.minutes}m${x?.timeLeft.seconds}s`]
    }

    const showCronJobActive = (p:string) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f) return
        return [`${f.data.origin.status?.active?.length || 0}`]
    }

    // handlers for showing general data inside filemanager
    const getMoreEvents = () => {  // +++ review
        let magnifyMessage:IMagnifyMessage = {
            msgtype: 'magnifymessage',
            accessKey: props.channelObject.accessString!,
            instance: props.channelObject.instanceId,
            id: uuid(),
            namespace: '',
            group: '',
            pod: '',
            container: '',
            command: EMagnifyCommand.EVENTS,
            action: EInstanceMessageAction.COMMAND,
            flow: EInstanceMessageFlow.REQUEST,
            type: EInstanceMessageType.DATA,
            channel: props.channelObject.channel.channelId,
            params: [ 'cluster', '', '', '', '50']
        }
        if (props.channelObject.webSocket) props.channelObject.webSocket.send(JSON.stringify( magnifyMessage ))

    }

    const showBackground = (f:IFileObject) => {
        let id = f.path.replaceAll('/','')
        const imagePath = require(`./images/${id}.png`);
        return <Box width={'100%'} height={'100%'} bgcolor={'#f1f1f1'} display={'flex'} justifyContent={'center'} alignItems={'center'}>
                <img src={imagePath}/>
        </Box>
    }

    const showOverview = () => {
        if (!magnifyData.clusterInfo) return <></>
        
        return <Box bgcolor={'#f1f1f1'} width={'100%'} height={'100%'}>
            <Card sx={{m:1, display: 'flex', flexDirection: 'column', height: 'calc(100% - 55px)'}}>
                <CardContent sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', p: 2}}>
                    <Box sx={{ flex:1, overflowY: 'auto', ml:1, mr:1 }}>
                        <Typography>Cluster: {props.channelObject.clusterInfo?.name}</Typography>
                        <Typography>Version: {magnifyData.clusterInfo.major}.{magnifyData.clusterInfo.minor}&nbsp;&nbsp;({magnifyData.clusterInfo.gitVersion})</Typography>
                        <Typography>Platform: {magnifyData.clusterInfo.platform}</Typography>
                        <Typography>Nodes: {magnifyData.files.filter(f => f.class==='Node').length}</Typography>

                        <Divider sx={{mt:1, mb:1}}/>

                        <ClusterMetrics channelObject={props.channelObject}/>
                        
                        <Divider sx={{mt:1, mb:1}}/>

                        <Validations files={magnifyData.files} onLink={onMagnifyObjectDetailsLink} onNavigate={onFileManagerNavigate} options={{ summary: true}} />

                        <Divider sx={{mt:1, mb:1}}/>

                        <Stack direction={'column'}>
                            {
                                magnifyData.clusterEvents?.map( (e,index) => {
                                    let severity= e.type? e.type[0]:''
                                    let color='black'
                                    if (severity==='W') color='orange'
                                    if (severity==='E') color='red'
                                    return <Stack key={index} direction={'row'}>
                                        <Typography sx={{width:'5%', color}}>{severity}</Typography>
                                        <Typography sx={{width:'25%', color}}>{e.eventTime||e.firstTimestamp||e.lastTimestamp}</Typography>
                                        <Typography sx={{width:'70%', color}}>{e.message}</Typography>
                                    </Stack>
                                })
                            }
                        </Stack>
                        <Stack direction={'row'}>
                            <Typography flexGrow={1}/>
                            <Button onClick={getMoreEvents}>More Events</Button>
                        </Stack>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    }

    const showClusterOverview = () => {
        return <Box bgcolor={'#f1f1f1'} width={'100%'} height={'100%'}> 
            <Card sx={{m:1}}>
                <CardHeader title={'Cluster overview'}/>
                <CardContent>
                    <Typography>Total CPU: {magnifyData.files.filter(f => f.class==='Node').reduce ((ac,v) => ac + +v.data.origin.status.capacity.cpu,0)}</Typography>
                    <Typography>Total Memory: {convertBytesToSize (magnifyData.files.filter(f => f.class==='Node').reduce ((ac,v) => ac + convertSizeToBytes(v.data.origin.status.capacity.memory),0))}</Typography>
                    <Divider sx={{mt:2, mb:2}}/>
                    <Typography>Actual pods: {magnifyData.files.filter(f => f.class==='Pod').length}</Typography>
                    <Typography>Max pods: {magnifyData.files.filter(f => f.class==='Node').reduce ((ac,v) => ac + +v.data.origin.status.capacity.pods,0)}</Typography>
                </CardContent>
            </Card>
        </Box>
    }

    const showWorkloadOverview = () => {
        return <Box bgcolor={'#f1f1f1'} width={'100%'} height={'100%'}> 
            <Card sx={{m:1}}>
                <CardHeader title={'Workload overview'}/>
                <CardContent>
                    <Typography>Pods: {magnifyData.files.filter(f => f.class==='Pod').length}</Typography>
                    <Divider sx={{mt:2, mb:2}}/>
                    <Typography>Deployments: {magnifyData.files.filter(f => f.class==='Deployment').length}</Typography>
                    <Typography>Daemon sets: {magnifyData.files.filter(f => f.class==='DaemonSet').length}</Typography>
                    <Typography>Replica sets: {magnifyData.files.filter(f => f.class==='ReplicaSet').length}</Typography>
                    <Typography>Replication Controllers: {magnifyData.files.filter(f => f.class==='ReplicationController').length}</Typography>
                    <Typography>Stateful sets: {magnifyData.files.filter(f => f.class==='StatefulSet').length}</Typography>
                    <Divider sx={{mt:2, mb:2}}/>
                    <Typography>Jobs: {magnifyData.files.filter(f => f.class==='Job').length}</Typography>
                    <Typography>Cron jobs: {magnifyData.files.filter(f => f.class==='CronJob').length}</Typography>
                    <Divider sx={{mt:2, mb:2}}/>
                    <Typography>Validations</Typography>
                    <Validations files={magnifyData.files} onLink={onMagnifyObjectDetailsLink} onNavigate={onFileManagerNavigate} options={{ replicaSet: true, daemonSet:true, deployment:true, statefulSet:true, job:true }}/>
                </CardContent>

            </Card>
        </Box>
    }

    const showConfigOverview = () => {
        return <Box bgcolor={'#f1f1f1'} width={'100%'} height={'100%'}> 
            <Card sx={{m:1}}>
                <CardHeader title={'Config overview'}/>
                <CardContent>
                    <Typography>ConfigMap: {magnifyData.files.filter(f => f.class==='ConfigMap').length}</Typography>
                    <Typography>Secret: {magnifyData.files.filter(f => f.class==='Secret').length}</Typography>
                    <Divider sx={{mt:2, mb:2}}/>
                    <Typography fontSize={'16'}>Validations</Typography>
                    <Validations files={magnifyData.files} onLink={onMagnifyObjectDetailsLink} onNavigate={onFileManagerNavigate} options={{configMap:true, secret:true}}/>
                </CardContent>
            </Card>
        </Box>
    }

    const showNetworkOverview = () => {
        return <Box bgcolor={'#f1f1f1'} width={'100%'} height={'100%'}> 
            <Card sx={{m:1}}>
                <CardHeader title={'Config overview'}>
                </CardHeader>
                <CardContent>
                    <Typography>Services: {magnifyData.files.filter(f => f.class==='Service').length}</Typography>
                    <Divider sx={{mt:2, mb:2}}/>
                    <Typography>Ingresses: {magnifyData.files.filter(f => f.class==='Ingress').length}</Typography>
                    <Typography>Ingress classes: {magnifyData.files.filter(f => f.class==='IngressClass').length}</Typography>
                    <Divider sx={{mt:2, mb:2}}/>
                    <Typography fontSize={'16'}>Validations</Typography>
                    <Validations files={magnifyData.files} onLink={onMagnifyObjectDetailsLink} onNavigate={onFileManagerNavigate} options={{ingress:true, service:true}}/>
                </CardContent>

            </Card>
        </Box>
    }

    const onFileManagerNavigate = (dest:string) => {
        fileManagerRef.current?.changeFolder(dest)
    }

    const showStorageOverview = () => {
        return <Box bgcolor={'#f1f1f1'} width={'100%'} height={'100%'}> 
            <Card sx={{m:1}}>
                <CardHeader title={'Storage overview'}>
                </CardHeader>
                <CardContent>
                    <Typography>Total PVC's: {magnifyData.files.filter(f => f.class==='PersistentVolumeClaim').length}</Typography>
                    <Typography>Total storage: {convertBytesToSize(magnifyData.files.filter(f => f.class==='PersistentVolumeClaim').reduce((ac, v) => ac+v.data.size, 0))}</Typography>
                    <Divider sx={{mt:2, mb:2}}/>
                    <Typography>Validations</Typography>
                    <Validations files={magnifyData.files} onLink={onMagnifyObjectDetailsLink} onNavigate={onFileManagerNavigate} options={{ volumeAttachment: true }}/>
                </CardContent>
            </Card>
        </Box>
    }

    const showPreferences = () => {
        return <UserPreferences preferences={magnifyData.userPreferences} files={magnifyData.files} onReload={onUserPreferencesReload} channelObject={props.channelObject}/>
    }

    const onUserPreferencesReload = () => {
        magnifyData.files = magnifyData.files.filter(f => f.isDirectory && f.path.split('/').length-1 <= 2)
        magnifyData.files = magnifyData.files.filter(f => f.class!=='crdgroup')
        magnifyData.currentPath='/overview'
        requestList(props.channelObject)
    }

    const sendCommand = (command: EMagnifyCommand, params:string[]) => {
        if (!props.channelObject.webSocket) return
        
        let magnifyMessage:IMagnifyMessage = {
            flow: EInstanceMessageFlow.REQUEST,
            action: EInstanceMessageAction.COMMAND,
            channel: props.channelObject.channel.channelId,
            type: EInstanceMessageType.DATA,
            accessKey: props.channelObject.accessString!,
            instance: props.channelObject.instanceId,
            id: uuid(),
            command: command,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            params: params,
            msgtype: 'magnifymessage'
        }
        let payload = JSON.stringify( magnifyMessage )
        props.channelObject.webSocket.send(payload)
    }

    const sendCommandAsync = (channelObject:IChannelObject, command: EMagnifyCommand, params:string[]) : Promise<any> => {
        return new Promise( (resolve, reject) => {
            let msgId = uuid()
            magnifyData.pendingWebSocketRequests.set(msgId, resolve)
            setTimeout(() => {
                magnifyData.pendingWebSocketRequests.delete(msgId)
                reject(new Error("Timeout async request "+msgId))
            }, 10000)
            
            let magnifyMessage:IMagnifyMessage = {
                flow: EInstanceMessageFlow.REQUEST,
                action: EInstanceMessageAction.COMMAND,
                channel: props.channelObject.channel.channelId,
                type: EInstanceMessageType.DATA,
                accessKey: channelObject.accessString!,
                instance: channelObject.instanceId,
                id: msgId,
                command: command,
                namespace: '',
                group: '',
                pod: '',
                container: '',
                params: params,
                msgtype: 'magnifymessage'
            }
            let payload = JSON.stringify( magnifyMessage )
            if (channelObject.webSocket) channelObject.webSocket.send(payload)
        })
    }

    // FileManager handlers
    const onError = (error: IError, file: IFileObject) => {
        let uiConfig = props.channelObject.config as IMagnifyConfig
        uiConfig.notify(props.channelObject.channel.channelId, ENotifyLevel.ERROR, error.message)
    }

    const onFolderChange = (folder:string) => {
        magnifyData.currentPath = folder
    }

    const onMagnifyObjectDetailsLink = (kind:string, name:string, namespace:string) => {
        contentWindowId.current = -1
        setContentDetailsVisible(false)
        flushSync( () => setSelectedFiles([]) )
        let path = buildPath(kind, name, namespace)
        let f = magnifyData.files.find(f => f.path === path)
        if (f) {
            launchObjectDetails([f.path], undefined)
        }
        else {
            console.log(path)
            setMsgBox(MsgBoxOkError('Object details',<Box>Object with name '<b>{name}</b>' of kind '{kind}' has not been found on artifacts database.</Box>, setMsgBox))
        }
    }

    // ContentExternal
    const onContentExternalClose = (content:IContentExternalObject) => {
        let i = magnifyData.contentWindows.indexOf(content)
        if (i>=0) magnifyData.contentWindows.splice(i,1)
        contentWindowId.current = -1
        setContentExternalContainer('')
        setContentExternalType('')
        setContentExternalVisible(false)
    }

    const onContentExternalMinimize = (content:IContentExternalObject) => {
        if (!magnifyData.contentWindows.includes(content)) magnifyData.contentWindows.push(content)
        contentWindowId.current = -1
        setContentExternalContainer('')
        setContentExternalType('')
        setContentExternalVisible(false)
    }

    const onContentExternalRestore = (index:number) => {
        contentWindowId.current = index
        flushSync(() => {
            // we restore original ContentExternal config, since there is one only instance of ContentExternal  for showing different data
            setContentExternalTitle((magnifyData.contentWindows[index] as IContentExternalObject).title)
            setContentExternalType((magnifyData.contentWindows[index] as IContentExternalObject).channel.channelId)
            setContentExternalContainer((magnifyData.contentWindows[index] as IContentExternalObject).container)
            setContentExternalOptions((magnifyData.contentWindows[index] as IContentExternalObject).options)
            setContentExternalVisible(true) 
        })
        setRefresh(Math.random())
    }

    const onContentExternalRefresh = () => {
        setRefresh(Math.random())
    }

    // ContentEdit
    const onContentEditClose = (content:IContentEditObject) => {
        let i = magnifyData.contentWindows.indexOf(content)
        if (i>=0) magnifyData.contentWindows.splice(i,1)
        contentWindowId.current = -1
        setContentEditVisible(false)
    }

    const onContentEditMinimize = (content:IContentEditObject) => {
        if (!magnifyData.contentWindows.includes(content)) magnifyData.contentWindows.push(content)
        contentWindowId.current = -1
        setContentEditVisible(false)
    }

    const onContentEditRestore = (index:number) => {
        contentWindowId.current = index
        setContentEditAllowEdit((magnifyData.contentWindows[index] as IContentEditObject).allowEdit)
        setContentEditVisible(true)
        setRefresh(Math.random())
    }

    const onContentEditOk = (content:{code:string, source?:IFileObject}) => {
        setContentEditVisible(false)
        sendCommand(EMagnifyCommand.APPLY, [content.code])
    }

    // ContentDetails
    const onContentDetailsClose = (content:IContentDetailsObject) => {
        let i = magnifyData.contentWindows.indexOf(content)
        if (i>=0) magnifyData.contentWindows.splice(i,1)
        contentWindowId.current = -1
        setContentDetailsVisible(false)
    }

    const onContentDetailsMinimize = (content:IContentDetailsObject) => {
        if (!magnifyData.contentWindows.includes(content)) magnifyData.contentWindows.push(content)
        contentWindowId.current = -1
        setContentDetailsVisible(false)
    }

    const onContentDetailsRestore = (index:number) => {
        contentWindowId.current = index
        flushSync(() => setContentDetailsVisible(true) )
        setRefresh(Math.random())
    }

    const onContentDetailsApply = (path:string, obj:any) => {
        setContentDetailsVisible(false)
        sendCommand(EMagnifyCommand.APPLY, [yamlParser.dump(obj, { indent: 2 })])
    }

    // actions launched from the ContentDetails
    const onContentDetailsAction = (action:string, path:string, container?:string) => {
        setContentDetailsVisible(false)
        let f = magnifyData.files.find(f => f.path === path)
        switch (action) {
            case 'delete':
                launchObjectDelete([path])
                break
            case 'edit':
                if (!f) return

                setSelectedFiles([f])
                setContentEditAllowEdit(true)
                setContentEditVisible(true)
                break
            case 'browse':
                if (!f) return
                setSelectedFiles([f])
                setContentEditAllowEdit(false)
                setContentEditVisible(true)
                break
            case 'shell':
                if (f) {
                    setSelectedFiles([f])
                    setContentExternalView(EInstanceConfigView.CONTAINER)
                    setContentExternalType('ops')
                    setContentExternalOptions({ autostart:true, pauseable:false, stopable:false, configurable:false})
                    setContentExternalTitle(f.data.origin.metadata.name+'+'+container)
                    setContentExternalContainer(container!)
                    setContentExternalVisible(true)
                }
                break
            case 'log':
            case 'metrics':
                if (f) {
                    setSelectedFiles([f])
                    setContentExternalType(action)
                    setContentExternalTitle(f.data.origin.metadata.name+'+'+container)
                    setContentExternalOptions({ autostart:true, pauseable:true, stopable:true, configurable:true})
                    if (container==='*all') {
                        setContentExternalView(EInstanceConfigView.POD)
                    }
                    else {
                        setContentExternalView(EInstanceConfigView.CONTAINER)
                        setContentExternalTitle(f.data.origin.metadata.name+'+'+container)
                        setContentExternalContainer(container!)
                    }
                    setContentExternalVisible(true)
                }
                break
            case 'evict':
                launchPodEvict([path])
                break
            case 'forward':
                //+++launchPodForward([path], container)
                break
            case 'cordon':
                launchNodeCordon([path])
                break
            case 'uncordon':
                launchNodeUnCordon([path])
                break
            case 'drain':
                launchNodeDrain([path])
                break
            case 'scale':
                launchControllerScale([path])
                break
            case 'restart':
                launchControllerRestart([path])
                break
            case 'trigger':
                launchCronJobTrigger([path])
                break
            case 'suspend':
                launchCronJobSuspend([path])
                break
            case 'resume':
                launchCronJobResume([path])
                break
        }
    }

    const onComponentNotify = (channel:string|undefined, level: ENotifyLevel, msg: string)  => {
        msg = 'Channel message: '+ msg;
        (props.channelObject.config as IMagnifyConfig).notify(channel, level, msg)
    }

    return <>
        { magnifyData.started &&
            <Box ref={magnifyBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', flexGrow:1, height: `${magnifyBoxHeight}px`, ml:1, mr:1}}>
                <FileManager
                    ref={fileManagerRef}
                    files={magnifyData.files}
                    spaces={spaces}
                    actions={actions}
                    icons={icons}
                    initialPath={magnifyData.currentPath}
                    layout='list'
                    enableFilePreview={false}
                    onCreateFolder={undefined}
                    onError={onError}
                    onRename={undefined}
                    onPaste={undefined}
                    onDelete={undefined}
                    onFolderChange={onFolderChange}
                    onRefresh={undefined}
                    permissions={permissions}
                    filePreviewPath='http://avoid-console-error'
                    primaryColor='#1976d2'
                    fontFamily='Roboto, Helvetica, Arial, sans-serif'
                    height='100%'
                    className='custom-fm'
                    searchMode='auto'
                    searchRegex={true}
                    searchCasing={true}
                    showContextMenu={false}
                    showRefresh={false}
                    categories={categories}
                    maxNavigationPaneLevel={2}
                    minFileActionsLevel={2}
                    />
                {
                    leftMenuAnchorParent && <ContainersMenu f={containersMenuContent} onClose={onContainersMenuClose} onContainerSelected={onContainerSelected} anchorParent={leftMenuAnchorParent} includeAllContainers={leftMenuIncludeAllContainers} />
                }
                <Stack direction={'row'} sx={{mt:1}}>
                    {
                        magnifyData.contentWindows.map((ec, index) => {
                            switch (ec.type) {
                                case 'external':
                                    let extcon = ec as IContentExternalObject
                                    let text = extcon.channelObject.container
                                    if (text.length>20) text = text.substring(0,10) + '...' + text.substring(text.length-10)
                                    // +++ add a preview of terminal using: www.npmjs.com/package/html-to-image
                                    let pod = extcon.channelObject.pod
                                    if (pod && pod!=='') pod = 'Pod: '+ pod
                                    let container = extcon.channelObject.container
                                    if (container && container !=='') {
                                        pod = 'Pod: '+container.split('+')[0]
                                        container = 'Container: '+container.split('+')[1]
                                    }
                                    return (
                                        <Tooltip key={index} title={<>Pod: {extcon.channelObject.pod}{extcon.channelObject.container!==''? <><br/>Container: {extcon.channelObject.container}</>: <></>}</>}>
                                            <Button onClick={() => onContentExternalRestore(index)}>
                                                {extcon.channel.getChannelIcon()}
                                                {text}
                                            </Button>
                                        </Tooltip>
                                    )
                                case 'edit':
                                    let extconed:IContentEditObject = ec as IContentEditObject
                                    let texted = extconed.content.title ||''
                                    let shortText = texted
                                    if (shortText.length>20) shortText = shortText.substring(0,10) + '...' + shortText.substring(shortText.length-10)
                                    return (
                                        <Tooltip key={index} title={texted}>
                                            <Button onClick={() => onContentEditRestore(index)}>
                                                {extconed.allowEdit? <Edit/> : <EditOff/>}
                                                {shortText}
                                            </Button>
                                        </Tooltip>
                                    )
                                case 'details':
                                    let extcondet = ec as IContentDetailsObject
                                    let textdet = extcondet.content.title || ''
                                    let shortdet = textdet
                                    if (shortdet.length>20) shortdet = shortdet.substring(0,10) + '...' + shortdet.substring(shortdet.length-10)
                                    return (
                                        <Tooltip key={index} title={textdet}>
                                            <Button onClick={() => onContentDetailsRestore(index)}>
                                                <List/>
                                                {shortdet}
                                            </Button>
                                        </Tooltip>
                                    )
                                default:
                                    return <></>
                            }
                        })
                    }
                </Stack>
                { msgBox }
                <InputBox title={inputBoxTitle} default={inputBoxDefault} message={inputBoxMessage} onClose={() => setInputBoxTitle(undefined)} onResult={inputBoxResult}/>
            </Box>
        }

        { contentExternalVisible && 
            <ContentExternal 
            content={contentWindowId.current < 0 ? undefined : magnifyData.contentWindows[contentWindowId.current] as IContentExternalObject}
            channelObject={props.channelObject}
            channelId={contentExternalType}
            title={contentExternalTitle}
            selectedFiles={selectedFiles}
            frontChannels={props.channelObject.frontChannels!}
            onClose={onContentExternalClose}
            onMinimize={onContentExternalMinimize}
            onRefresh={onContentExternalRefresh}
            onNotify={onComponentNotify}
            contentView={contentExternalView}
            data-refresh={refresh}
            container={contentExternalContainer}
            settings={magnifyData.userPreferences}
            options={contentExternalOptions}
            />

        }

        { contentEditVisible &&
            <ContentEdit 
                content={contentWindowId.current<0? undefined : magnifyData.contentWindows[contentWindowId.current] as IContentEditObject}
                selectedFile={selectedFiles.length>0? selectedFiles[0]: undefined}
                newContent={contentWindowId.current>=0 || selectedFiles.length>0? undefined : contentEditNew}
                allowEdit={contentEditAllowEdit}
                onMinimize={onContentEditMinimize}
                onClose={onContentEditClose}
                onOk={onContentEditOk}
            />
        }

        { contentDetailsVisible &&
            <ContentDetails
                content={contentWindowId.current>=0 ? magnifyData.contentWindows[contentWindowId.current] as IContentDetailsObject : undefined}
                selectedFile={contentWindowId.current<0 && selectedFiles.length>0? selectedFiles[0] : undefined}
                sections={detailsSections}
                onMinimize={onContentDetailsMinimize}
                onClose={onContentDetailsClose}
                onApply={onContentDetailsApply}
                onLink={onMagnifyObjectDetailsLink}
                onAction={onContentDetailsAction}
                data-refresh={refresh}
                actions={contentDetailsActions}
                includeAllContainers={new Map([['log',2],['metrics',2],['fileman',1],['shell',1],['evict',0],['cordon',0], ['uncordon',0], ['drain',0], ['scale',0], ['restart',0], ['trigger',0], ['suspend',0], ['resume',0],  ])}
            />
        }

        { searchVisible &&
            <ArtifactSearch scope={searchScope} onLink={(k,e,n) => {setSearchVisible(false); onMagnifyObjectDetailsLink(k,e,n)}} onClose={() => setSearchVisible(false)} selectedFiles={selectedFiles}/>
        }

    </>
}
export { MagnifyTabContent }