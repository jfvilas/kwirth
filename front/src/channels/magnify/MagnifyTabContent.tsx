import React from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { IContentProps } from '../IChannel'
import { EMagnifyCommand, IMagnifyMessage, IMagnifyData } from './MagnifyData'
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, EInstanceConfigView } from '@jfvilas/kwirth-common'
import { ICategory, IError, IFileManagerHandle, IFileObject } from '@jfvilas/react-file-manager'
import { FileManager } from '@jfvilas/react-file-manager'
import { v4 as uuid } from 'uuid'
import { IMagnifyConfig } from './MagnifyConfig'
import { ENotifyLevel } from '../../tools/Global'
import { actions, icons, menu, spaces } from './components/RFMConfig'
import { objectSections } from './components/DetailsSections'
import { Edit, EditOff, List, Search } from '@mui/icons-material'
import { MsgBoxButtons, MsgBoxOkError, MsgBoxYesNo } from '../../tools/MsgBox'
import { ContentExternal, IContentExternalData } from './components/ContentExternal'
import { ContentDetails, IDetailsData } from './components/ContentDetails'
import { ContentEdit, IContentEditData } from './components/ContentEdit'
import { MenuContainers } from './components/MenuContainers'
import { buildPath } from './MagnifyChannel'
import { InputBox } from '../../tools/FrontTools'
import { templates } from './components/Templates'
import '@jfvilas/react-file-manager/dist/style.css'
import './custom-fm-magnify.css'
import { ArtifactSearch, IArtifactSearchData } from './components/ArtifactSearch'
import { rfmSetup, setLeftItem, setPropertyFunction } from './components/RFMSetup'
import { MenuWorks } from './components/MenuWorks'
import {useTheme } from '@mui/material';
const yamlParser = require('js-yaml')

export interface IContentWindow {
    id: string
    class: string
    visible: boolean
    atFront: boolean
    atTop: boolean
    startTime: number
    x: number
    y: number
    width: number
    height: number
    isMaximized: boolean
    onMinimize: (id: string) => void
    onClose: (id: string) => void
    onTop: (id: string) => void
    onFocus?: () => void
    onWindowChange: (id:string, isMaximized:boolean, x:number, y:number, width:number, height:number) => void
    title: string
    
    selectedFiles: IFileObject[]
    container?: string
    data: any
}

const MagnifyTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    const theme = useTheme()
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

    const [magnifyBoxHeight, setMagnifyBoxHeight] = useState(0)
    const magnifyBoxRef = useRef<HTMLDivElement | null>(null)
    const fileManagerRef = useRef<IFileManagerHandle>(null)

    const [msgBox, setMsgBox] = useState(<></>)

    const [inputBoxTitle, setInputBoxTitle] = useState<any>()
    const [inputBoxMessage, setInputBoxMessage] = useState<any>()
    const [inputBoxDefault, setInputBoxDefault] = useState<any>()
    const [inputBoxResult, setInputBoxResult] = useState<(result:any) => void>()

    const [menuWorksAnchorParent, setMenuWorksAnchorParent] = useState<Element>()

    const [menuContainersAnchorParent, setMenuContainersAnchorParent] = useState<Element>()
    const [menuContainersFile, setMenuContainersFile] = useState<IFileObject>()
    const [menuContainersChannel, setMenuContainersChannel] = useState<string>('')
    const [menuContainersIncludeAllContainers, setMenuContainersIncludeAllContainers] = useState<boolean>(false)

    const [ , setTick] = useState<number>(0)

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
            let a = window.innerHeight - top
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
        rfmSetup(
            theme, 
            magnifyData,
            props.channelObject,
            spaces,
            onMagnifyObjectDetailsLink,
            onFileManagerNavigate,
            launchObjectCreate,
            launchObjectDelete,
            launchObjectDetails,
            launchObjectEdit,
            launchObjectBrowse,
            launchSearch
        )
        setPodActions()
        setControllerActions()
        setClusterActions()
        setNetworkActions()

        // we provide a mechanism for refreshing cluster usage charts
        magnifyData.refreshUsage = ()  => setTick(t=>t+1)

        // we need to do this because category data is lost when magnify tab is unmounted (we could move this into magnifyData structure in order to preserve)
        let namespaceCategory = categories.find(c => c.key==='namespace')
        if (namespaceCategory) {
            for (let f of magnifyData.files.filter(f => f.data?.origin?.kind==='Namespace')) {
                if (!namespaceCategory.all.some(cv => cv.key === f.name)) namespaceCategory.all.push({key:f.name, text:f.name})
            }
        }

        // we provide a mechanism for refreshing namespace list when there is a change in namespaces (added/deleted)
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
            // +++ we should add a 'destroy' action for deleting data in addition to unmount (when required)
            setMenuContainersAnchorParent(undefined)
        }
    }, [])

    const onContainerSelected = (channel:string, file:IFileObject, container:string) => {
        setMenuContainersAnchorParent(undefined)
        if (container==='*all') {
            launchObjectExternal(channel, [file], EInstanceConfigView.POD, undefined)
        }
        else {
            launchObjectExternal(channel, [file], EInstanceConfigView.CONTAINER, container)
        }
    }

    const onMenuContainersClose = () => {
        setMenuContainersAnchorParent(undefined)
    }

    const onMenuWorksClose = () => {
        setMenuWorksAnchorParent(undefined)
    }

    const onMenuWorksSelected = (action:string) => {
        setMenuWorksAnchorParent(undefined)
        sendCommand(EMagnifyCommand.POD, [ 'work', action])
    }

    // *********************************************************
    // General actions fro any type of object
    // *********************************************************

    const bringWindowToFront = (id: string) => {
        magnifyData.windows.forEach(w => w.atFront = false)
        const win = magnifyData.windows.find(w => w.id === id)
        if (win) {
            win.atFront = true
            setTick(t=>t+1)
        }
    }

    const onWindowChange = (id:string, isMaximized:boolean, x:number,y:number,width:number,height:number) => {
        const existingWindow = magnifyData.windows.find(w => w.id === id)
        if (!existingWindow) return
        existingWindow.isMaximized = isMaximized
        existingWindow.x = x
        existingWindow.y = y
        existingWindow.width = width
        existingWindow.height = height
    }

    const launchObjectDetails = (p:string[], currentTarget?:Element) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        if (f[0].path.startsWith('/custom/') && !f[0].path.startsWith('/custom/CustomResourceDefinition/')) {
            //+++setDetailsSections(objectSections.get('#crdinstance#')!)
        }
        else {
            let existingWin = magnifyData.windows.find(w => w.selectedFiles.find(x => x.path === f[0].path))
            if (existingWin) {
                bringWindowToFront(existingWin.id)
            }
            else {
                let spc = spaces.get(f[0].data.origin.kind)
                let win:IContentWindow = {
                    id: 'details-' + f[0].path + '-' + uuid(),
                    class: 'ContentDetails',
                    visible: true,
                    atTop: false,
                    atFront: true,
                    startTime: Date.now(),
                    title: f[0].data.origin.metadata?.name,
                    isMaximized: false,
                    x: 100,
                    y: 50,
                    width: 800,
                    height: 600,
                    data: {
                        source: f[0],
                        path: f[0].path,
                        sections: objectSections.get(f[0].data.origin.kind)!,
                        actions: spc && spc.leftItems? spc.leftItems : [],
                        onApply: onContentDetailsApply,
                        onAction: onContentDetailsAction,
                        onLink: onMagnifyObjectDetailsLink,
                        containerSelectionOptions: new Map([['log',2],['metrics',2],['fileman',2],['shell',1],['evict',0],['cordon',0], ['uncordon',0], ['drain',0], ['scale',0], ['restart',0], ['trigger',0], ['suspend',0], ['resume',0],  ])
                    } satisfies IDetailsData,
                    selectedFiles: [f[0]],
                    onWindowChange: onWindowChange,
                    onMinimize: onWindowMinimize,
                    onTop: onWindowTop,
                    onClose: onWindowClose,
                }
                magnifyData.windows.push(win)
                setTick(t => t+1)
            }

            // we request a fresh events list
            if (f[0].data.origin.metadata) {
                // objects APIResource doesnt contain metadata
                if (f[0].data.events) delete f[0].data.events
                sendCommand(EMagnifyCommand.EVENTS, ['object', f[0].data.origin.metadata.namespace, f[0].data.origin.kind, f[0].data.origin.metadata.name])
            }
            else {
                // +++ para api resources, images... esto no es necesario, no hay eventos
                // pero lanzando esto, cuando ser recibe una respusta a la consulta se dispara una action de REFRESH y se refresca la vista
                sendCommand(EMagnifyCommand.EVENTS, ['object', undefined, f[0].data.origin.kind, f[0].data.origin.name])
            }
        }
    }

    const launchObjectCreate = (kind:string) => {
        let template = templates.get(kind) || `apiVersion: v1\nKind: ${kind}\nejemplo: true`
        let winId = 'create-' + kind + '-' + uuid()
        let win:IContentWindow = {
            id: winId,
            class: 'ContentEdit',
            visible: true,
            atTop: false,
            atFront: true,
            startTime: Date.now(),
            title: 'Create ' + kind,
            isMaximized: false,
            x: 100,
            y: 50,
            width: 800,
            height: 600,
            data: {
                isInitialized: false,
                allowEdit: true,
                onOk: (code: string, source?: IFileObject): void => {
                    sendCommand(EMagnifyCommand.APPLY, [code])
                    onWindowClose(winId)
                },
                code: template,
                oldCode: undefined
            } satisfies IContentEditData,
            onWindowChange: onWindowChange,
            onTop: onWindowTop,
            onMinimize: onWindowMinimize,
            onClose: onWindowClose,
            selectedFiles: []
        }
        magnifyData.windows.push(win)
        setTick(t => t+1)
    }

    const launchObjectDelete = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setMsgBox(MsgBoxYesNo('Delete '+f[0].data.origin.kind,<Box>Are you sure you want to delete {f[0].data.origin.kind}<b> {f[0].displayName}</b>{p.length>1?` (and other ${p.length-1} items)`:''}?</Box>, setMsgBox, (a) => {
            if (a === MsgBoxButtons.Yes) {
                sendCommand(EMagnifyCommand.DELETE, f.map(o => yamlParser.dump(o.data.origin, { indent: 2 })))
            }
        }))
    }

    const launchObjectEdit = (p:string[]) => launchObjectEditOrBrowse(p, true)
    const launchObjectBrowse = (p:string[]) => launchObjectEditOrBrowse(p, false)

    const launchObjectEditOrBrowse = (p:string[], allowEdit:boolean) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        let wid = (allowEdit?'edit-':'browse-') + f[0].path + '-' + uuid()
        let win:IContentWindow = {
            id: wid,
            class: allowEdit? 'ContentEdit':'ContentBrowse',
            visible: true,
            atTop: false,
            atFront: true,
            startTime: Date.now(),
            title: (allowEdit?'Edit ':'Browse ')+f[0].name,
            isMaximized: false,
            x: 100,
            y: 50,
            width: 800,
            height: 600,
            data: {
                allowEdit,
                onOk: (code: string, source?: IFileObject): void => {
                    sendCommand(EMagnifyCommand.APPLY, [code])
                    onWindowClose(wid)
                },
                isInitialized: false,
                code: undefined,
                oldCode: undefined
            } satisfies IContentEditData,
            selectedFiles: [f[0]],
            onWindowChange: onWindowChange,
            onTop: onWindowTop,
            onMinimize: onWindowMinimize,
            onClose: onWindowClose,
        }
        magnifyData.windows.push(win)
        setTick(t => t+1)
    }

    const launchObjectExternal = (channel:string, files:IFileObject[], view: EInstanceConfigView, container: string|undefined ) => {
        let win:IContentWindow = {
            id: 'external-' + channel + '-' + uuid(),
            class: 'ContentExternal',
            visible: true,
            atTop: false,
            atFront: true,
            startTime: Date.now(),
            title: files[0].data.origin.metadata.name + (container || ''),
            isMaximized: false,
            x: 100,
            y: 50,
            width: 800,
            height: 600,
            data: {
                isInitialized: false,
                channelObject: props.channelObject,
                settings: magnifyData.userPreferences,
                channelId: channel,
                contentView: view,
                frontChannels: props.channelObject.frontChannels!,
                onNotify: onComponentNotify,
                onRefresh: onContentExternalRefresh,
                options: channel === 'shell'?
                    { autostart:true, pauseable:false, stopable:false, configurable:false}
                    :
                    { autostart:true, pauseable:true, stopable:true, configurable:true}
            } satisfies IContentExternalData,
            selectedFiles: files,
            container: container,
            onWindowChange: onWindowChange,
            onTop: onWindowTop,
            onMinimize: onWindowMinimize,
            onClose: onWindowClose,
        }
        magnifyData.windows.push(win)
        setTick(t => t+1)
    }

    const launchSearch = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        let selFiles=[]
        let scope
        if (p[0]==='/cluster/overview') {
            scope = ':cluster:'
            selFiles = magnifyData.files
        }
        else {
            scope = f[0].data.origin.metadata.name
            selFiles = magnifyData.files.filter(x => x.data?.origin?.metadata.namespace === f[0].data.origin.metadata.name)
        }
        let win:IContentWindow = {
            id: 'search-' + scope + '-' + uuid(),
            class: 'ArtifactSearch',
            visible: true,
            atTop: false,
            atFront: true,
            startTime: Date.now(),
            title: 'Search...',
            isMaximized: false,
            x: 100,
            y: 50,
            width: 800,
            height: 600,
            data: {
                scope: scope,
                selectedFiles: selFiles,
                onLink: onMagnifyObjectDetailsLink,
                searchText: '',
                includeStatus: false,
                merge: true,
                matchCase: false
            } satisfies IArtifactSearchData,
            selectedFiles: [f[0]],
            onWindowChange: onWindowChange,
            onTop: onWindowTop,
            onMinimize: onWindowMinimize,
            onClose: onWindowClose,
        }
        magnifyData.windows.push(win)
        setTick(t => t+1)
    }

    // *********************************************************
    // Specific actions for some objects
    // *********************************************************

    // cluster actions
    const setClusterActions = () => {
            // Node
            let spcNode = spaces.get('Node')!
            setLeftItem(spcNode,'cordon', launchNodeCordon)
            setLeftItem(spcNode,'uncordon', launchNodeUnCordon)
            setLeftItem(spcNode,'drain', launchNodeDrain)

            let spcImage = spaces.get('Image')!
            setLeftItem(spcImage,'delete', launchImageDelete)

            // Namespace
            let spcClassNamespace = spaces.get('classNamespace')!
            setLeftItem(spcClassNamespace, 'create', (p:string[]) => {
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
            })
    }

    // workload actions
    const setPodActions = () => {
        let spcClassPod = spaces.get('classPod')!
        setLeftItem(spcClassPod, 'works', (p:string[], currentTarget:Element) => {
            setMenuWorksAnchorParent(currentTarget)
        })
        let spcPod = spaces.get('Pod')!
        setLeftItem(spcPod,'shell', (p:string[], currentTarget:Element) => {
            let f = magnifyData.files.filter(x => p.includes(x.path))
            setMenuContainersChannel('ops')
            setMenuContainersFile(f[0])
            setMenuContainersIncludeAllContainers(false)
            setMenuContainersAnchorParent(currentTarget)
        })

        setLeftItem(spcPod,'forward', (p:string[], currentTarget:Element) => {
            let f = magnifyData.files.filter(x => p.includes(x.path))
            setMenuContainersFile(f[0])
            setMenuContainersIncludeAllContainers(false)
            setMenuContainersAnchorParent(currentTarget)
        })

        setLeftItem(spcPod,'log', (p:string[], currentTarget:Element) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
            setMenuContainersChannel('log')
            setMenuContainersFile(f[0])
            setMenuContainersIncludeAllContainers(true)
            setMenuContainersAnchorParent(currentTarget)
        })

        setLeftItem(spcPod,'metrics', (p:string[], currentTarget:Element) => {
            let f = magnifyData.files.filter(x => p.includes(x.path))
            if (!f) return
            setMenuContainersChannel('metrics')
            setMenuContainersFile(f[0])
            setMenuContainersIncludeAllContainers(true)
            setMenuContainersAnchorParent(currentTarget)
        })

        setLeftItem(spcPod,'fileman', (p:string[], currentTarget:Element) => {
            let f = magnifyData.files.filter(x => p.includes(x.path))
            setMenuContainersChannel('fileman')
            setMenuContainersFile(f[0])
            setMenuContainersIncludeAllContainers(false)
            setMenuContainersAnchorParent(currentTarget)
        })
        setLeftItem(spcPod,'evict', launchPodEvict)
    }

    const launchPodEvict = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        setMsgBox(MsgBoxYesNo('Delete '+f[0].data.origin.kind,<Box>Are you sure you want to evict {f[0].data.origin.kind} <b>{f[0].data.origin.metadata.name}</b>?</Box>, setMsgBox, (a) => {
            if (a === MsgBoxButtons.Yes) {
                f.map(pod => sendCommand(EMagnifyCommand.POD, [ 'evict', pod.data.origin.metadata.namespace, pod.data.origin.metadata.name]))
            }
        }))
    }

    // controller actions
    const setControllerActions = () => {
        // Deployment
        let spcDeployment = spaces.get('Deployment')!
        setPropertyFunction(spcDeployment, 'status', showListDeploymentStatus)
        setLeftItem(spcDeployment,'scale', launchControllerScale)
        setLeftItem(spcDeployment,'restart', launchControllerRestart)
        setLeftItem(spcDeployment,'log', launchControllerLogs)
        setLeftItem(spcDeployment,'metrics', launchControllerMetrics)

        // DaemonSet
        let spcDaemonSet = spaces.get('DaemonSet')!
        setLeftItem(spcDaemonSet,'restart', launchControllerRestart)
        setLeftItem(spcDaemonSet,'log', launchControllerLogs)
        setLeftItem(spcDaemonSet,'metrics', launchControllerMetrics)

        // ReplicaSet
        let spcReplicaSet = spaces.get('ReplicaSet')!
        setLeftItem(spcReplicaSet,'scale', launchControllerScale)
        setLeftItem(spcReplicaSet,'log', launchControllerLogs)
        setLeftItem(spcReplicaSet,'metrics', launchControllerMetrics)

        // ReplicationController
        let spcReplicationController = spaces.get('ReplicationController')!
        setLeftItem(spcReplicationController,'restart', launchControllerRestart)
        setLeftItem(spcReplicationController,'scale', launchControllerScale)
        setLeftItem(spcReplicationController,'log', launchControllerLogs)
        setLeftItem(spcReplicationController,'metrics', launchControllerMetrics)

        // StatefulSet
        let spcStatefulSet = spaces.get('StatefulSet')!
        setLeftItem(spcStatefulSet,'scale', launchControllerScale)
        setLeftItem(spcStatefulSet,'restart', launchControllerRestart)
        setLeftItem(spcStatefulSet,'log', launchControllerLogs)
        setLeftItem(spcStatefulSet,'metrics', launchControllerMetrics)

        let spcJob = spaces.get('Job')!
        setLeftItem(spcJob,'log', launchJobLogs)
        
        let spcCronJob = spaces.get('CronJob')!
        setLeftItem(spcCronJob,'trigger', launchCronJobTrigger)
        setLeftItem(spcCronJob,'suspend', launchCronJobSuspend)
        setLeftItem(spcCronJob,'resume', launchCronJobResume)
    }

    const setNetworkActions = () => {
        let spcIngressClass = spaces.get('IngressClass')!
        setLeftItem(spcIngressClass,'default', launchIngressClassDefault)
    }

    const showListDeploymentStatus = (p:any) => {
        let f = magnifyData.files.find(x => p===x.path)
        if (!f || !f.data?.origin?.status) return <></>
        let status='Stalled'
        if (f.data.origin?.status?.conditions && f.data.origin.status.conditions.length>0) {
            if (f.data.origin.status.conditions.some((c:any) => c.type+c.status ==='AvailableTrue') && f.data.origin.status.conditions.some((c:any) => c.type+c.status ==='ProgressingTrue')) status='Running'
            else if (f.data.origin.status.conditions.some((c:any) => c.type+c.status ==='AvailableFalse') && f.data.origin.status.conditions.some((c:any) => c.type+c.status ==='ProgressingTrue')) status='Scaling'
        }
        return <Typography color={status==='Running'?'green':(status==='Scaling'?'orange':'red')} fontSize={12}>{status}</Typography>
    }


    // Controller actions
    const launchControllerRestart = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))

        if (f.length===1) {
            sendCommand(EMagnifyCommand.CONTROLLER, [ 'restart', f[0].data.origin.kind, f[0].data.origin.metadata.namespace, f[0].data.origin.metadata.name])
        }
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

    const launchControllerLogs = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        launchObjectExternal('log', f, EInstanceConfigView.GROUP, undefined)
    }

    const launchControllerMetrics = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        //+++ falta decidir como agrupamos, group o merge: neceistamos un pequeño menu en externlaContent
        launchObjectExternal('metrics', f, EInstanceConfigView.GROUP, undefined)
    }

    // Job actions
    const launchJobLogs = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        launchObjectExternal('log', f, EInstanceConfigView.GROUP, undefined)
    }

    // IngressClass actions
    const launchIngressClassDefault = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        f.map( one => sendCommand(EMagnifyCommand.INGRESSCLASS, [ 'default', one.data.origin.metadata.name]))
    }

    // Image actions
    const launchImageDelete = (p:string[]) => {
        let f = magnifyData.files.filter(f => p.includes(f.path))
        setMsgBox(MsgBoxYesNo('Delete '+f[0].data.origin.kind,<Box>Are you sure you want to delete {f[0].data.origin.kind}<b> {f[0].displayName}</b>{p.length>1?` (and other ${p.length-1} items)`:''}?</Box>, setMsgBox, (a) => {
            if (a === MsgBoxButtons.Yes) {
                sendCommand(EMagnifyCommand.IMAGE, ['delete',...f.map(image => image.data.origin.metadata.name)])
            }
        }))

    }

    // Node actions
    const launchNodeDrain = (p:string[]) => {
        let f = magnifyData.files.filter(x => p.includes(x.path))
        sendCommand(EMagnifyCommand.NODE, ['drain',f[0].data.origin.metadata.name])
    }

    const launchNodeCordon = (p:string[]) => {
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

    const onFileManagerNavigate = (dest:string) => {
        fileManagerRef.current?.changeFolder(dest)
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

    // FileManager handlers
    const onError = (error: IError, file: IFileObject) => {
        let uiConfig = props.channelObject.config as IMagnifyConfig
        uiConfig.notify(props.channelObject.channel.channelId, ENotifyLevel.ERROR, error.message)
    }

    const onFolderChange = (folder:string) => {
        magnifyData.currentPath = folder
    }

    const onMagnifyObjectDetailsLink = (kind:string, name:string, namespace:string) => {
        let path = buildPath(kind, name, namespace)
        if (kind==='Image') {
            console.log(name, namespace, path)
        }
        let f = magnifyData.files.find(f => f.path === path)
        if (f) {
            launchObjectDetails([f.path], undefined)
        }
        else {
            setMsgBox(MsgBoxOkError('Object details',<Box>Object with name '<b>{name}</b>' of kind '{kind}' in namesapce '${namespace}' has not been found on artifacts database.</Box>, setMsgBox))
        }
    }

    const onContentExternalRefresh = () => setTick(t=>t+1)

    const onWindowClose = (id:string) => {
        let index = magnifyData.windows.findIndex(w => w.id === id)
        if (index<0) return
        magnifyData.windows.splice(index, 1)
        setTick(t=>t+1)
    }

    const onWindowMinimize = (id:string) => {
        let win = magnifyData.windows.find(w => w.id===id)
        if (!win) return
        win.visible = false
        win.atFront = false
        setNewFrontWindow()
        setTick(t => t+1)
    }

    const onWindowTop = (id:string) => {
        let win = magnifyData.windows.find(w => w.id===id)
        if (!win) return
        win.atTop = !win.atTop
        setTick(t => t+1)
    }

    const setNewFrontWindow = () => {
        let lastWinOpen = undefined
        for (let win of magnifyData.windows)
            if (win.visible && !win.atFront && !win.atTop) lastWinOpen = win
        if (lastWinOpen) bringWindowToFront(lastWinOpen.id)
    }

    const onWindowRestore = (id:string) => {
        let win = magnifyData.windows.find(w => w.id===id)
        if (!win) return
        if (win.visible) {
            if (win.atFront) {
                win.visible = false
                win.atFront = false
                setNewFrontWindow()
            }
            else
                bringWindowToFront(win.id)
        }
        else {
            win.visible = true
            bringWindowToFront(win.id)
        }
        setTick(t => t+1)
    }

    const onContentDetailsApply = (path:string, obj:any) => {
        sendCommand(EMagnifyCommand.APPLY, [yamlParser.dump(obj, { indent: 2 })])
    }

    // actions launched from the ContentDetails
    const onContentDetailsAction = (action:string, path:string, container?:string) => {
        let file = magnifyData.files.find(f => f.path === path)
        if (!file) return
        switch (action) {
            case 'delete':
                launchObjectDelete([path])
                break
            case 'edit':
                launchObjectEdit([path])
                break
            case 'browse':
                launchObjectBrowse([path])
                break
            case 'shell':
                launchObjectExternal('ops', [file], EInstanceConfigView.CONTAINER, container)
                break
            case 'log':
            case 'metrics':
            case 'fileman':
                if (container==='*all') {
                    launchObjectExternal(action, [file], EInstanceConfigView.POD, undefined)
                }
                else {
                    launchObjectExternal(action, [file], EInstanceConfigView.CONTAINER, container)
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

    const getContentExternalIcon = (w:IContentWindow) => {
        // +++ optimize, we should not need to instantiate a channel fer getting an icon
        let channelConstructor = props.channelObject.frontChannels!.get(w.data.channelId)!
        if (!channelConstructor) {
            console.log('Inexistent channel:', w.data.channelId)
            return <></>
        }
        else {
            let ch = new channelConstructor()
            return ch.getChannelIcon()
        }
    }

    const renderWindow = (w:IContentWindow, front:boolean, top:boolean) => {
        if (w.visible && w.atFront===front && w.atTop===top) {
            switch (w.class) {
                case 'ContentDetails':
                    return  <ContentDetails 
                        key={w.id}
                        onFocus={() => bringWindowToFront(w.id)}
                        {...w} 
                    />
                case 'ArtifactSearch':
                    return  <ArtifactSearch 
                        key={w.id}
                        onFocus={() => bringWindowToFront(w.id)}
                        {...w} 
                    />
                case 'ContentBrowse':
                case 'ContentEdit':
                    return  <ContentEdit 
                        key={w.id}
                        onFocus={() => bringWindowToFront(w.id)}
                        {...w} 
                    />
                case 'ContentExternal':
                    return  <ContentExternal 
                        key={w.id}
                        onFocus={() => bringWindowToFront(w.id)}
                        {...w} 
                    />
                default:
                    console.error('Invalid window class:', w.class)
            }
        }
    }

    return <>
        { magnifyData.started &&
            <Box ref={magnifyBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', flexGrow:1, height: `${magnifyBoxHeight}px`, ml:1, mr:1, mt:1 }}>
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
                    className='custom-fm-magnify'
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
                    menuContainersAnchorParent && <MenuContainers channel={menuContainersChannel} file={menuContainersFile} onClose={onMenuContainersClose} onContainerSelected={onContainerSelected} anchorParent={menuContainersAnchorParent} includeAllContainers={menuContainersIncludeAllContainers} />
                }
                {
                    menuWorksAnchorParent && <MenuWorks onWorkSelected={onMenuWorksSelected} onClose={onMenuWorksClose} anchorParent={menuWorksAnchorParent} />
                }
                <Stack direction={'row'} sx={{mt:1}}>
                    {
                        magnifyData.windows.map((w) => {
                            let extContentTitle = w.title || 'notitle'
                            let extContentTitleShort = extContentTitle
                            if (extContentTitleShort.length>20) extContentTitleShort = extContentTitleShort.substring(0,10) + '...' + extContentTitleShort.substring(extContentTitleShort.length-10)
                            switch (w.class) {
                                case 'ContentDetails':
                                    return (
                                        <Tooltip key={w.id} title={extContentTitle}>
                                            <Button onClick={() => onWindowRestore(w.id)}>
                                                <List/>{extContentTitleShort}
                                            </Button>
                                        </Tooltip>
                                    )
                                case 'ArtifactSearch':
                                    return (
                                        <Tooltip key={w.id} title={w.title}>
                                            <Button onClick={() => onWindowRestore(w.id)}>
                                                <Search/>{extContentTitleShort}
                                            </Button>
                                        </Tooltip>
                                    )
                                case 'ContentEdit':
                                    return (
                                        <Tooltip key={w.id} title={w.title}>
                                            <Button onClick={() => onWindowRestore(w.id)}>
                                                <Edit/>{extContentTitleShort}
                                            </Button>
                                        </Tooltip>
                                    )
                                case 'ContentBrowse':
                                    return (
                                        <Tooltip key={w.id} title={w.title}>
                                            <Button onClick={() => onWindowRestore(w.id)}>
                                                <EditOff/>{extContentTitleShort}
                                            </Button>
                                        </Tooltip>
                                    )
                                case 'ContentExternal':
                                    return (
                                        <Tooltip key={w.id} title={w.title}>
                                            <Button onClick={() => onWindowRestore(w.id)}>
                                                {getContentExternalIcon(w)}{extContentTitleShort}
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

        { magnifyData.windows.sort((a,b) => a.startTime-b.startTime).map((w) => renderWindow(w, false, false)) }
        { magnifyData.windows.sort((a,b) => a.startTime-b.startTime).map((w) => renderWindow(w, true, false)) }
        { magnifyData.windows.sort((a,b) => a.startTime-b.startTime).map((w) => renderWindow(w, false, true)) }
        { magnifyData.windows.sort((a,b) => a.startTime-b.startTime).map((w) => renderWindow(w, true, true)) }
    </>
}
export { MagnifyTabContent }