import React from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { IChannel, IChannelObject, IContentProps } from '../IChannel'
import { EMagnifyCommand, IMagnifyMessage, IMagnifyData } from './MagnifyData'
import { Box, Button, Card, CardContent, CardHeader, Divider, Stack, Tooltip, Typography } from '@mui/material'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, EInstanceConfigView } from '@jfvilas/kwirth-common'
import { ICategory, IError, IFileObject, ISpace, ISpaceMenuItem } from '@jfvilas/react-file-manager'
import { FileManager } from '@jfvilas/react-file-manager'
import { v4 as uuid } from 'uuid'
import { IMagnifyConfig } from './MagnifyConfig'
import { ENotifyLevel } from '../../tools/Global'
import { actions, icons, menu, spaces } from './components/RFMConfig'
import { IDetailsSection } from './components/DetailsObject'
import { objectSections } from './components/DetailsSections'
import { Edit, List } from '@mui/icons-material'
import { MsgBoxButtons, MsgBoxOkError, MsgBoxYesNo } from '../../tools/MsgBox'
import { ContentExternal, IContentExternalObject } from './components/ContentExternal'
import { ContentDetails, IContentDetailsObject } from './components/ContentDetails'
import { ContentEdit, IContentEditObject } from './components/ContentEdit'
import { LeftItemMenu } from './LeftItemMenu'
import { UserPreferences } from './components/UserPreferences'
import { buildPath, requestList } from './MagnifyChannel'
import { InputBox } from '../../tools/FrontTools'
import { templates } from './components/Templates'
import { convertBytesToSize, convertSizeToBytes, getNextCronExecution } from './Tools'
import '@jfvilas/react-file-manager/dist/style.css'
import './custom-fm.css'
import { addGetAuthorization } from '../../tools/AuthorizationManagement'
import { ClusterMetrics } from './components/ClusterMetrics'
import { NamespaceSearch } from './components/NamespaceSearch'

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

    const magnifyBoxRef = useRef<HTMLDivElement | null>(null)
    const [magnifyBoxHeight, setMagnifyBoxHeight] = useState(0)
    const [msgBox, setMsgBox] = useState(<></>)

    const [contentEditVisible, setContentEditVisible] = useState(false)
    const [contentEditNew, setContentEditNew] = useState<string>('')
    const contentWindowId = useRef<number>(-1)

    const [contentExternalVisible, setContentExternalVisible] = useState<boolean>(false)
    const [contentExternalType, setContentExternalType] = useState<string>('')
    const [contentExternalView, setContentExternalView] = useState<EInstanceConfigView>(EInstanceConfigView.POD)
    const [contentExternalTitle, setContentExternalTitle] = useState<string>('n/a')
    const [contentExternalContainer, setContentExternalContainer] = useState<string>('')

    const [inputBoxTitle, setInputBoxTitle] = useState<any>()
    const [inputBoxMessage, setInputBoxMessage] = useState<any>()
    const [inputBoxResult, setIinputBoxResult] = useState<(result:any) => void>()

    const [selectedFiles, setSelectedFiles] = useState<IFileObject[]>([])

    const [leftMenuAnchorParent, setLeftMenuAnchorParent] = useState<Element>()
    const [leftMenuContent, setLeftMenuContent] = useState<any>()
    const [leftMenuIncludeAllContainers, setLeftMenuIncludeAllContainers] = useState<boolean>(false)
    
    const [contentDetailsVisible, setContentDetailsVisible] = useState(false)
    const [detailsSections, setDetailsSections] = useState<IDetailsSection[]>([])
    const [contentDetailsActions, setContentDetailsActions] = useState<ISpaceMenuItem[]>([])

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

        // Main menu
            setPathFunction('/overview', showOverview)
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
            setLeftItem(spcPod,'shell', launchPodShell)
            setLeftItem(spcPod,'forward', launchPodForward)
            setLeftItem(spcPod,'logs', launchPodLogs)
            setLeftItem(spcPod,'metrics', launchPodMetrics)
            setLeftItem(spcPod,'details', launchObjectDetails)
            setLeftItem(spcPod,'edit', launchObjectEdit)
            setLeftItem(spcPod,'delete', launchObjectDelete)
            setLeftItem(spcPod,'evict', launchPodEvict)
            let objPod = objectSections.get('Pod')
            if (objPod) {
                let item = objPod.find(o => o.name==='containers')!.items.find(item => item.name === 'container')
                item = item!.items!.find (i => i.name==='ports')!.items!.find (i => i.name==='forward')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        return buildForward(rootObj, obj.name, obj.protocol, obj.containerPort)
                    }
                }
            }

            // Deployment
            let spcClassDeployment = spaces.get('classDeployment')!
            setLeftItem(spcClassDeployment, 'create', () => launchObjectCreate('Deployment'))
            let spcDeployment = spaces.get('Deployment')!
            setLeftItem(spcDeployment,'details', launchObjectDetails)
            setLeftItem(spcDeployment,'scale', launchGroupScale)
            setLeftItem(spcDeployment,'restart', launchGroupRestart)
            setLeftItem(spcDeployment,'logs', launchGroupLogs)
            setLeftItem(spcDeployment,'metrics', launchGroupMetrics)
            setLeftItem(spcDeployment,'edit', launchObjectEdit)
            setLeftItem(spcDeployment,'delete', launchObjectDelete)
            let objDeployment = objectSections.get('Deployment')
            if (objDeployment) {
                let item = objDeployment.find(o => o.name==='properties')!.items.find(item => item.name === 'status')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        return ['running']
                    }
                }
                item = objDeployment[1].items.find(item => item.name === 'pods')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        const selectors = obj.spec?.selector?.matchLabels
                        if (!selectors) return []

                        let allPods = magnifyData.files.filter(f => f.path.startsWith('/workload/Pod/'))
                        allPods = allPods.filter(f => {
                            const podLabels = f.data.origin.metadata?.labels || {}
                            return Object.entries(selectors).every(([key, value]) => {
                                return podLabels[key] === value
                            })
                        })
                        allPods = allPods.map(f => f.data.origin)
                        return allPods
                    }
                }
            }
            
            // DaemonSet
            let spcClassDaemonSet = spaces.get('classDaemonSet')!
            setLeftItem(spcClassDaemonSet, 'create', () => launchObjectCreate('DaemonSet'))
            let spcDaemonSet = spaces.get('DaemonSet')!
            setLeftItem(spcDaemonSet,'details', launchObjectDetails)
            setLeftItem(spcDaemonSet,'restart', launchGroupRestart)
            setLeftItem(spcDaemonSet,'logs', launchGroupLogs)
            setLeftItem(spcDaemonSet,'metrics', launchGroupMetrics)
            setLeftItem(spcDaemonSet,'edit', launchObjectEdit)
            setLeftItem(spcDaemonSet,'delete', launchObjectDelete)
            let objDaemonSet = objectSections.get('DaemonSet')
            if (objDaemonSet) {
                //+++ esto mismo se hace en la custom function de los Deployment
                let item = objDaemonSet[0].items.find(item => item.name === 'status')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        return ['running']
                    }
                }
                item = objDaemonSet[1].items.find(item => item.name === 'pods')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        const selectors = obj.spec?.selector?.matchLabels
                        if (!selectors) return []

                        let allPods = magnifyData.files.filter(f => f.path.startsWith('/workload/Pod/'))
                        allPods = allPods.filter(f => {
                            const podLabels = f.data.origin.metadata?.labels || {}
                            return Object.entries(selectors).every(([key, value]) => {
                                return podLabels[key] === value
                            })
                        })
                        allPods = allPods.map(f => f.data.origin)
                        return allPods
                    }
                }
            }

            // ReplicaSet
            let spcClassReplicaSet = spaces.get('classReplicaSet')!
            setLeftItem(spcClassReplicaSet, 'create', () => launchObjectCreate('ReplicaSet'))
            let spcReplicaSet = spaces.get('ReplicaSet')!
            setLeftItem(spcReplicaSet,'details', launchObjectDetails)
            setLeftItem(spcReplicaSet,'scale', launchGroupScale)
            setLeftItem(spcReplicaSet,'logs', launchGroupLogs)
            setLeftItem(spcReplicaSet,'metrics', launchGroupMetrics)
            setLeftItem(spcReplicaSet,'edit', launchObjectEdit)
            setLeftItem(spcReplicaSet,'delete', launchObjectDelete)
            let objReplicaSet = objectSections.get('ReplicaSet')
            if (objReplicaSet) {
                //+++ esto mismo se hace en la custom function de los Deployment
                let item = objReplicaSet[0].items.find(item => item.name === 'status')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        return ['running']
                    }
                }
                item = objReplicaSet[1].items.find(item => item.name === 'pods')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        const selectors = obj.spec?.selector?.matchLabels
                        if (!selectors) return []

                        let allPods = magnifyData.files.filter(f => f.path.startsWith('/workload/Pod/'))
                        allPods = allPods.filter(f => {
                            const podLabels = f.data.origin.metadata?.labels || {}
                            return Object.entries(selectors).every(([key, value]) => {
                                return podLabels[key] === value
                            })
                        })
                        allPods = allPods.map(f => f.data.origin)
                        return allPods
                    }
                }
            }

            // ReplicationController
            let spcClassReplicationController = spaces.get('classReplicationController')!
            setLeftItem(spcClassReplicationController, 'create', () => launchObjectCreate('ReplicationController'))
            let spcReplicationController = spaces.get('ReplicationController')!
            setLeftItem(spcReplicationController,'details', launchObjectDetails)
            setLeftItem(spcReplicationController,'logs', launchGroupLogs)
            setLeftItem(spcReplicationController,'metrics', launchGroupMetrics)
            setLeftItem(spcReplicationController,'edit', launchObjectEdit)
            setLeftItem(spcReplicationController,'delete', launchObjectDelete)

            // StatefulSet
            let spcClassStatefulSet = spaces.get('classStatefulSet')!
            setLeftItem(spcClassStatefulSet, 'create', () => launchObjectCreate('StatefulSet'))
            let spcStatefulSet = spaces.get('StatefulSet')!
            setLeftItem(spcStatefulSet,'details', launchObjectDetails)
            setLeftItem(spcStatefulSet,'scale', launchGroupScale)
            setLeftItem(spcStatefulSet,'restart', launchGroupRestart)
            setLeftItem(spcStatefulSet,'logs', launchGroupLogs)
            setLeftItem(spcStatefulSet,'metrics', launchGroupMetrics)
            setLeftItem(spcStatefulSet,'edit', launchObjectEdit)
            setLeftItem(spcStatefulSet,'delete', launchObjectDelete)
            let objStatefulSet = objectSections.get('StatefulSet')
            if (objStatefulSet) {
                //+++ esto mismo se hace en la custom function de los Deployment
                let item = objStatefulSet[0].items.find(item => item.name === 'status')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        return ['running']
                    }
                }
                item = objStatefulSet[1].items.find(item => item.name === 'pods')
                if (item) {
                    //+++ este codigo es igual al de otros
                    item.invoke = (rootObj, obj) => { 
                        const selectors = obj.spec?.selector?.matchLabels
                        if (!selectors) return []

                        let allPods = magnifyData.files.filter(f => f.path.startsWith('/workload/Pod/'))
                        allPods = allPods.filter(f => {
                            const podLabels = f.data.origin.metadata?.labels || {}
                            return Object.entries(selectors).every(([key, value]) => {
                                return podLabels[key] === value
                            })
                        })
                        allPods = allPods.map(f => f.data.origin)
                        return allPods
                    }
                }
            }

            let spcClassJob = spaces.get('classJob')!
            setLeftItem(spcClassJob, 'create', () => launchObjectCreate('Job'))
            let spcJob = spaces.get('Job')!
            setPropertyFunction(spcJob, 'conditions', showJobConditions)
            setLeftItem(spcJob,'details', launchObjectDetails)
            setLeftItem(spcJob,'logs', launchJobLogs)
            setLeftItem(spcJob,'edit', launchObjectEdit)
            setLeftItem(spcJob,'delete', launchObjectDelete)
            let objJob = objectSections.get('Job')
            if (objJob) {
                //+++ esto mismo se hace en la custom function de los Deployment
                let item = objJob.find(s => s.name==='properties')!.items.find(item => item.name === 'status')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        return ['running']
                    }
                }
                item = objJob.find(s => s.name==='properties')!.items.find(item => item.name === 'pods')
                if (item) {
                    item.invoke = (rootObj, obj) => { 
                        let allPods = magnifyData.files.filter(f => f.path.startsWith('/workload/Pod/'))
                        allPods = allPods.filter(f => {
                            const owners = f.data.origin.metadata.ownerReferences || []
                            return owners.some((owner:any) => owner.name === obj.metadata.name && owner.kind === 'Job')
                        })
                        allPods = allPods.map(f => f.data.origin)
                        return allPods

                    }
                }
            }

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
                let item = objNamespace?.find(s => s.name==='content')?.items.find(item => item.name === 'content')
                let getElements = (namespace:string, kind:string): JSX.Element => {
                    let text=kind
                    if (kind.includes('+')) [kind, text] = kind.split('+')
                    let elements = magnifyData.files.filter(f => f.data?.origin?.kind === kind && f.data?.origin?.metadata.namespace===namespace)?.map(f => f.data?.origin?.metadata.name)
                    if (elements.length===0) return <></>
                    
                    return (
                        <Stack flexDirection={'row'}>
                            <Typography width={'15%'}>{text}:&nbsp;</Typography>
                            <Stack flexDirection={'column'}>
                                {
                                    elements.map( (e) => {
                                        return <a href={`#`} onClick={() => onMagnifyObjectDetailsLink(kind,e)}>{e}</a>
                                    })
                                }
                            </Stack>
                        </Stack>
                    )
                }
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
                    item.invoke = (rootObj, obj) => { 
                        return buildForward(rootObj, obj.name, obj.protocol, obj.targetPort)
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

            // StorageClass
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
                        return allPvcs.map(pvc => pvc.data.origin.metadata.name)
                    }
                }
            }

            let spcClassVolumeAttachment = spaces.get('classStorageClass')!
            let spcVolumeAttachment = spaces.get('VolumeAttachment')!
            setLeftItem(spcVolumeAttachment,'details', launchObjectDetails)

            let spcClassCSIDriver = spaces.get('classCSIDriver')!
            let spcCSIDriver = spaces.get('CSIDriver')!
            setLeftItem(spcCSIDriver,'details', launchObjectDetails)

            let spcClassCSINode = spaces.get('classCSINode')!
            let spcCSINode = spaces.get('CSINode')!
            setLeftItem(spcCSINode,'details', launchObjectDetails)

            let spcClassCSIStorageCapacity = spaces.get('classCSIStorageCapacity')!
            let spcCSIStorageCapacity = spaces.get('CSIStorageCapacity')!
            setLeftItem(spcCSIStorageCapacity,'details', launchObjectDetails)

        // Access

            // ServiceAccount
            let spcClassServiceAccount = spaces.get('classServiceAccount')!
            setLeftItem(spcClassServiceAccount, 'create', () => launchObjectCreate('ServiceAccount'))
            let spcServiceAccount = spaces.get('ServiceAccount')!
            setLeftItem(spcServiceAccount,'details', launchObjectDetails)
            setLeftItem(spcServiceAccount,'edit', launchObjectEdit)
            setLeftItem(spcServiceAccount,'delete', launchObjectDelete)

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

        let objSectionServiceAccount = objectSections.get('ServiceAccount')
        if (objSectionServiceAccount) {
            let item = objSectionServiceAccount[0].items.find(item => item.name === 'tokens')
            if (item) {
                item.invoke = (rootObj, obj) => { 
                    let x = magnifyData.files.filter(f => f.data?.origin?.metadata?.annotations && f.data?.origin?.metadata?.namespace && f.data?.origin?.metadata?.annotations['kubernetes.io/service-account.name'] === "kwirth-sa" && f.data?.origin?.metadata?.namespace === obj.metadata.namespace)
                    return x.map(o => o.data.origin.metadata.name)
                }
            }
        }

        launchTasks(props.channelObject)

        magnifyData.updateNamespaces = (action:string, namespace:string) => {
            let nsCategory = categories.find(c => c.key==='namespace')
            if (!nsCategory) return
            if (action==='DELETED') {
                nsCategory.all = nsCategory.all.filter(c => c.key !== namespace)
            }
            else {
                if (!nsCategory.all.some(c => c.key===namespace)) nsCategory.all.push({ key:namespace })
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
                <Typography>{portNumber.toString().toLowerCase().replace('http','80')}/{portProtocol}&nbsp;&nbsp;</Typography>
            </Stack>
            <Box sx={{ flexGrow: 1 }} />
            <Button onClick={() => window.open(url, '_blank')}>Forward</Button>
        </Stack>
    }

    const launchTasks = (channelObject:IChannelObject) => {

        // cluster usage +++ maybe nodemetrics is enough to get this data
        setInterval( (c:IChannelObject) => {
            fetch(`${c.clusterUrl}/metrics/usage/cluster`, addGetAuthorization(c.accessString!)).then ( (result) => {
                result.json().then ( (data) => {
                    let md:IMagnifyData = c.data
                    data.timestamp = new Date().getHours()+':'+new Date().getMinutes()+':'+new Date().getSeconds()
                    md.metricsCluster.push(data)
                    if (md.metricsCluster.length>10) md.metricsCluster.shift()
                    setRefresh(Math.random())
                })
            })
        }, 30000, channelObject)

        // pod cpu/mem & cluster cpu/mem
        setInterval( (c:IChannelObject) => {
            let magnifyMessage:IMagnifyMessage = {
                msgtype: 'magnifymessage',
                accessKey: channelObject.accessString!,
                instance: channelObject.instanceId,
                id: uuid(),
                namespace: '',
                group: '',
                pod: '',
                container: '',
                command: EMagnifyCommand.LIST,
                action: EInstanceMessageAction.COMMAND,
                flow: EInstanceMessageFlow.REQUEST,
                type: EInstanceMessageType.DATA,
                channel: 'magnify',
                params: [ 'PodMetrics', 'NodeMetrics' ]
            }
            if (channelObject.webSocket) channelObject.webSocket.send(JSON.stringify( magnifyMessage ))
        }, 60000, channelObject)

        // request cluster events
        setInterval ( (c:IChannelObject) => {
            let magnifyMessage:IMagnifyMessage = {
                msgtype: 'magnifymessage',
                accessKey: c.accessString!,
                instance: c.instanceId,
                id: uuid(),
                namespace: '',
                group: '',
                pod: '',
                container: '',
                command: EMagnifyCommand.EVENTS,
                action: EInstanceMessageAction.COMMAND,
                flow: EInstanceMessageFlow.REQUEST,
                type: EInstanceMessageType.DATA,
                channel: 'magnify',
                params: [ 'cluster', '', '', '', '10']
            }
            if (c.webSocket) c.webSocket.send(JSON.stringify( magnifyMessage ))
        }, 10000, channelObject)

    }

    // *********************************************************
    // Convenience functions for configuring item actions
    // *********************************************************
    const setPathFunction = (path:string, invoke:() => void) => {
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
        let x = space.leftItems?.find(f => f.name===name)
        if (x) x.onClick = invoke
    }

    const onLeftItemMenuContainerSelected = (container:string) => {
        setLeftMenuAnchorParent(undefined)

        if (container==='*all') {
            //+++action : content external o forward
            setContentExternalView(EInstanceConfigView.POD)
        }
        else {
            setContentExternalTitle(contentExternalTitle+'+'+container)
            setContentExternalContainer(container)
        }
        setContentExternalVisible(true)
    }

    const onLeftItemMenuClose = () => {
        setLeftMenuAnchorParent(undefined)
    }

    // *********************************************************
    // Actions
    // *********************************************************

    const launchObjectDetails = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        if (f[0].path.startsWith('/custom/') && !f[0].path.startsWith('/custom/CustomResourceDefinition/')) {
            setDetailsSections(objectSections.get('#crdinstance#')!)
        }
        else {
            setDetailsSections(objectSections.get(f[0].data.origin.kind)!)
            let spc = spaces.get(f[0].data.origin.kind)
            if (spc && spc.leftItems) {
                //let items = spc.leftItems.filter(i => i.name !== 'details' && i.name !== 'edit' && i.name !== 'delete')
                setContentDetailsActions(spc.leftItems)
            }
        }

        // we request a fresh events list
        if (f[0].data.events) delete f[0].data.events
        sendCommand(EMagnifyCommand.EVENTS, ['object', f[0].data.origin.metadata.namespace, f[0].data.origin.kind, f[0].data.origin.metadata.name])

        setSelectedFiles([f[0]])
        setContentDetailsVisible(true)
    }

    const launchObjectCreate = (kind:string) => {
        let template = templates.get(kind) || `apiVersion: v1\nKind: ${kind}\nejemplo: true`
        setSelectedFiles([])
        setContentEditNew(template.trim())
        setContentEditVisible(true)
    }

    const launchObjectDelete = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setMsgBox(MsgBoxYesNo('Delete '+f[0].data.origin.kind,<Box>Are you sure you want to delete {f[0].data.origin.kind}<b> {f[0].name}</b>?</Box>, setMsgBox, (a) => {
            if (a === MsgBoxButtons.Yes) {
                sendCommand(EMagnifyCommand.DELETE, f.map(o => yamlParser.dump(o.data.origin, { indent: 2 })))
            }
        }))
    }

    const launchSearch = (p:string[]) => {
        console.log(p)
        let f = magnifyData.files.filter(x => p.includes(x.path))
        if (p[0]==='/cluster/overview') {
            setSearchScope('cluster')
            setSelectedFiles(magnifyData.files)
        }
        else {
            setSearchScope(f[0].name)
            setSelectedFiles(magnifyData.files.filter(x => x.data?.origin?.metadata.namespace===f[0].name))
        }
        setSearchVisible(true)
    }

    const launchObjectEdit = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setSelectedFiles([f[0]])
        setContentEditVisible(true)
    }

    const launchEditFromDetails = (p:string) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f) return

        setSelectedFiles([f])
        setContentEditVisible(true)
    }

    const launchNamespaceCreate = (p:string[]) => {
        setIinputBoxResult ( () => (name:any) => {
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
        setMsgBox(MsgBoxYesNo('Delete '+f[0].data.origin.kind,<Box>Are you sure you want to evict {f[0].data.origin.kind} <b>{f[0].name}</b>?</Box>, setMsgBox, (a) => {
            if (a === MsgBoxButtons.Yes) {
                f.map( one => sendCommand(EMagnifyCommand.POD, [ 'evict', one.data.origin.metadata.namespace, one.data.origin.metadata.name]))
            }
        }))
    }

    const launchPodLogs = (p:string[], currentTarget:Element) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setSelectedFiles(f)
        setContentExternalView(EInstanceConfigView.CONTAINER)
        setContentExternalTitle(f[0].name)
        setContentExternalType('log')
        setLeftMenuContent(f[0])
        setLeftMenuIncludeAllContainers(true)
        setLeftMenuAnchorParent(currentTarget)
    }

    const launchPodShell = (p:string[], currentTarget:Element) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setSelectedFiles(f)
        setContentExternalView(EInstanceConfigView.CONTAINER)
        setContentExternalTitle(f[0].name)
        setContentExternalType('ops')
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
        setContentExternalTitle(f[0].name)
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
            for (let c of f.data.origin.status.containerStatuses) {
                let color='orange'
                if (c.started) {
                    color='green'
                    if (f.data.origin.metadata.deletionTimestamp) color = 'blue'
                }
                else {
                    if (c.state.terminated) color = 'gray'
                }
                result.push(<Box sx={{ width: '8px', height: '8px', backgroundColor: color, margin: '1px', display: 'inline-block' }}/>)
            }
        }
        return result
    }

    // Ingress actions
    const showIngressRules = (p:any) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f) return
        if (!f.data?.origin?.spec?.rules) return <></>
        let result:JSX.Element[]=[]
        for (let rule of f.data.origin.spec.rules) {
            for (let path of rule.http.paths) {
                result.push(
                    <Typography fontSize={12}>http://{rule.host}{path.path}&nbsp;&rarr;&nbsp;{path.backend.service.name}:{path.backend.service.port.number}</Typography>
                )
            }
        }

        return <Stack direction={'column'}>
            {result.map(r => r)}
        </Stack>

    }

    // Service actions
    const showServiceSelector = (p:any) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f) return
        if (!f.data?.origin?.spec?.selector) return <></>
        let result:JSX.Element[]=[]
        for (let key of Object.keys(f.data.origin.spec.selector)) {
            result.push(
                <Typography fontSize={12}>{key}={f.data.origin.spec.selector[key]}</Typography>
            )
        }
        return <Stack direction={'column'}>
            {result}
        </Stack>

    }

    // Group actions
    const launchGroupScale = (p:string[]) => {
        // let f = magnifyData.files.filter(x => p.includes(x.path))
        // console.log('set sca')
    }

    const launchGroupRestart = (p:string[]) => {
        // let f = magnifyData.files.filter(x => p.includes(x.path))
        // console.log('set rest')
    }

    const launchGroupLogs = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setContentExternalView(EInstanceConfigView.GROUP)
        setContentExternalTitle(f[0].name)
        setSelectedFiles(f)
        setContentExternalType('log')
        setContentExternalVisible(true)
    }

    const launchGroupMetrics = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        //+++ falta decidir como agrupamos, group o merge: neceistamos un pequeño menu en externlaContent
        setContentExternalView(EInstanceConfigView.GROUP)
        setContentExternalTitle(f[0].name)
        setSelectedFiles(f)
        setContentExternalType('metrics')
        setContentExternalVisible(true)
    }

    // Job actions
    const launchJobLogs = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setContentExternalView(EInstanceConfigView.GROUP)
        setContentExternalTitle(f[0].name)
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
            if (cond.status==='True') result.push(<Typography fontSize={12}>{cond.type}</Typography>)
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
        sendCommand(EMagnifyCommand.NODE, ['drain',f[0].name])
    }

    const launchNodeCordon = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(EMagnifyCommand.NODE, ['cordon', f[0].name])
    }

    const launchNodeUnCordon = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(EMagnifyCommand.NODE, ['uncordon', f[0].name])
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
    const getMoreEvents = () => {
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
            channel: 'magnify',
            params: [ 'cluster', '', '', '', '50']
        }
        if (props.channelObject.webSocket) props.channelObject.webSocket.send(JSON.stringify( magnifyMessage ))

    }

    const showOverview = () => {
        if (!magnifyData.clusterInfo) return <></>

        return <Card sx={{m:1, display: 'flex', flexDirection: 'column', height: 'calc(100% - 55px)'}}>
            <CardContent sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', p: 2}}>
                <Box sx={{ flex:1, overflowY: 'auto', ml:1, mr:1 }}>
                <Typography>Version: {magnifyData.clusterInfo.major}.{magnifyData.clusterInfo.minor}&nbsp;&nbsp;({magnifyData.clusterInfo.gitVersion})</Typography>
                <Typography>Platform: {magnifyData.clusterInfo.platform}</Typography>
                <Typography>Nodes: {magnifyData.files.filter(f => f.class==='Node').length}</Typography>

                <Divider sx={{mt:1, mb:1}}/>

                <ClusterMetrics channelObject={props.channelObject} data-refresf={refresh}/>
                
                <Divider sx={{mt:1, mb:1}}/>

                <Stack direction={'column'}>
                    {
                        magnifyData.clusterEvents.map(e => {
                            let severity= e.type?e.type[0]:''
                            let color='black'
                            if (severity==='W') color='orange'
                            if (severity==='E') color='red'
                            return <Stack direction={'row'}>
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
    }

    const showClusterOverview = () => {
        return <Box sx={{m:1}}>
            <Card>
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
        return <Box sx={{m:1}}>
            <Card>
                <CardHeader title={'Workload overview'}>

                </CardHeader>
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
                </CardContent>

            </Card>
        </Box>
    }

    const showConfigOverview = () => {
        return <Box sx={{m:1}}>
            <Card>
                <CardHeader title={'Config overview'}>

                </CardHeader>
                <CardContent>
                    <Typography>ConfigMap: {magnifyData.files.filter(f => f.class==='ConfigMap').length}</Typography>
                    <Typography>Secret: {magnifyData.files.filter(f => f.class==='Secret').length}</Typography>
                </CardContent>

            </Card>
        </Box>
    }

    const showNetworkOverview = () => {
        return <Box sx={{m:1}}>
            <Card>
                <CardHeader title={'Config overview'}>

                </CardHeader>
                <CardContent>
                    <Typography>Services: {magnifyData.files.filter(f => f.class==='Service').length}</Typography>
                    <Divider sx={{mt:2, mb:2}}/>
                    <Typography>Ingresses: {magnifyData.files.filter(f => f.class==='Ingress').length}</Typography>
                    <Typography>Ingress classes: {magnifyData.files.filter(f => f.class==='IngressClass').length}</Typography>
                </CardContent>

            </Card>
        </Box>
    }

    const showStorageOverview = () => {
        return <Box sx={{m:1}}>
            <Card>
                <CardHeader title={'Storage overview'}>

                </CardHeader>
                <CardContent>
                    <Typography>Total PVC's: {magnifyData.files.filter(f => f.class==='PersistentVolumeClaim').length}</Typography>
                    <Typography>Total storage: {convertBytesToSize(magnifyData.files.filter(f => f.class==='PersistentVolumeClaim').reduce((ac, v) => convertSizeToBytes(v.data.size), 0))}</Typography>
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
            channel: 'magnify',
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
                channel: 'magnify',
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
        uiConfig.notify(props.channelObject.channel, ENotifyLevel.ERROR, error.message)
    }

    const onFolderChange = (folder:string) => {
        magnifyData.currentPath = folder
    }

    const onMagnifyObjectDetailsLink = (kind:string, name:string) => {
        contentWindowId.current = -1
        setContentDetailsVisible(false)
        flushSync( () => setSelectedFiles([]) )
        let path = buildPath(kind, name)
        let f = magnifyData.files.find(f => f.path === path)
        if (f) {
            launchObjectDetails([f.path])
        }
        else
            setMsgBox(MsgBoxOkError('Object details',<Box>Object with name '<b>{name}</b>' of kind '{kind}' has not been found on artifacts database.</Box>, setMsgBox))
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
        flushSync(() => setContentExternalVisible(true) )
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

    const onContentDetailsAction = (path:string, action:string) => {
        setContentDetailsVisible(false)
        let f = magnifyData.files.filter(x => x.path === path)
        switch (action) {
            case 'shell':
                //+++ launchPodShell([f],xxx) falta seleccioanr container
                break
            case 'logs':
                //+++
                break
            case 'metrics':
                //+++
                break
            case 'evict':
                launchPodEvict([path])
                break
            case 'forward':
                //+++launchPodForward([path], container)
                break
            case 'cordon':
                break
            case 'uncordon':
                break
            case 'drain':
                break
            case 'scale':
                break
            case 'restart':
                break
            case 'trigger':
                break
            case 'suspend':
                break
            case 'resume':
                break
        }
    }

    const onComponentNotify = (channel:IChannel|undefined, level: ENotifyLevel, msg: string)  => {
        msg = 'Channel message: '+ msg;
        (props.channelObject.config as IMagnifyConfig).notify(channel, level, msg)
    }

    return <>
        { magnifyData.started &&
            <Box ref={magnifyBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', flexGrow:1, height: `${magnifyBoxHeight}px`, ml:1, mr:1}}>
                <FileManager
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
                    maxNavigationPaneDepth={2}
                    />
                {
                    leftMenuAnchorParent && <LeftItemMenu f={leftMenuContent} onClose={onLeftItemMenuClose} onOptionSelected={onLeftItemMenuContainerSelected} anchorParent={leftMenuAnchorParent} includeAllContainers={leftMenuIncludeAllContainers} />
                }
                <Stack direction={'row'} sx={{mt:1}}>
                    {
                        magnifyData.contentWindows.map((ec, index) => {
                            switch (ec.type) {
                                case 'external':
                                    let extcon = ec as IContentExternalObject
                                    let text = extcon.channelObject.container
                                    if (text.length>20) text = text.substring(0,10) + '...' + text.substring(text.length-10)
                                    // +++ add a preview of terminal using: https://www.npmjs.com/package/html-to-image
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
                                    let extconed = ec as IContentEditObject
                                    let texted = extconed.content.title ||''
                                    let short = texted
                                    if (short.length>20) short = short.substring(0,10) + '...' + short.substring(short.length-10)
                                    return (
                                        <Tooltip key={index} title={texted}>
                                            <Button onClick={() => onContentEditRestore(index)}>
                                                <Edit/>
                                                {short}
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
                <InputBox title={inputBoxTitle} message={inputBoxMessage} onClose={() => setInputBoxTitle(undefined)} onResult={inputBoxResult}/>
            </Box>
        }

        { contentExternalVisible && 
            <ContentExternal 
                content={contentWindowId.current<0 ? undefined : magnifyData.contentWindows[contentWindowId.current] as IContentExternalObject}
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
                settings={magnifyData.userPreferences}/>
        }

        { contentEditVisible &&
            <ContentEdit 
                content={contentWindowId.current<0? undefined : magnifyData.contentWindows[contentWindowId.current] as IContentEditObject}
                selectedFile={selectedFiles.length>0? selectedFiles[0]: undefined}
                newContent={contentWindowId.current>=0 || selectedFiles.length>0? undefined : contentEditNew}
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
                onEdit={(path:string) => launchEditFromDetails(path)}
                onDelete={(path:string) => launchObjectDelete([path])}
                onLink={onMagnifyObjectDetailsLink}
                onAction={onContentDetailsAction}
                data-refresh={refresh}
                actions={contentDetailsActions}
            />
        }

        { searchVisible &&
            <NamespaceSearch scope={searchScope} onLink={(k,e) => {setSearchVisible(false); onMagnifyObjectDetailsLink(k,e)}} onClose={() => setSearchVisible(false)} selectedFiles={selectedFiles}/>
        }

    </>
}
export { MagnifyTabContent }