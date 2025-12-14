import { useEffect, useRef, useState } from 'react'
import { IChannelObject } from '../IChannel'
import { LensCommandEnum, ILensMessage, ILensData } from './LensData'
import { Box, Button, Card, CardContent, CardHeader, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import { InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum } from '@jfvilas/kwirth-common'
import { IError, IFileObject, ISpace } from '@jfvilas/react-file-manager'
import { FileManager } from '@jfvilas/react-file-manager'
import { v4 as uuid } from 'uuid'
import { ILensConfig } from './LensConfig'
import { ENotifyLevel } from '../../tools/Global'
import '@jfvilas/react-file-manager/dist/style.css'
import './custom-fm.css'
import { menu, spaces } from './RFMConfig'
import { IResourceSelected } from '../../components/ResourceSelector'
import { ILogConfig, ILogInstanceConfig, LogSortOrderEnum } from '../log/LogConfig'
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml'
import React from 'react'
import { IDetailsSection, LensObjectDetails } from './components/ObjectDetails'
import { objectSections } from './components/DetailsSections'
import { Close, ContentCopy, Delete, Edit } from '@mui/icons-material'
import { MsgBoxButtons, MsgBoxYesNo } from '../../tools/MsgBox'
const _ = require('lodash')
const copy = require('clipboard-copy')

const yamlParser = require('js-yaml');

interface IContentProps {
    webSocket?: WebSocket
    channelObject: IChannelObject
}

const LensTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    const lensBoxRef = useRef<HTMLDivElement | null>(null)
    const [lensBoxTop, setLensBoxTop] = useState(0)
    const [msgBox, setMsgBox] =useState(<></>)
    const [editorVisible, setEditorVisible] = useState(false)
    const [editorContent, setEditorContent] = useState<{code:string, source?:IFileObject}>({code:''})
    const [detailsVisible, setDetailsVisible] = useState(false)
    const [detailsContent, setDetailsContent] = useState<any>()
    const [detailsSections, setDetailsSections] = useState<IDetailsSection[]>([])
    const [detailsChanges, setDetailsChanges] = useState({})

    let lensData:ILensData = props.channelObject.data
    let permissions={
        create: false,
        delete: false,
        download: false,
        copy: false,
        move: false,
        rename: false,
        upload: false
    }
    let icons = new Map()
    let actions = new Map()

    useEffect(() => {
        if (lensBoxRef.current) setLensBoxTop(lensBoxRef.current.getBoundingClientRect().top)
    })

    useEffect(() => {
        if (!lensData.files.some(f => f.path ==='/overview')) {
            lensData.files.push(...menu)

            setPathFunction('/overview', showOverview)
            setPathFunction('/workload', showWorkloadOverview)
            setPathFunction('/config', showConfigOverview)

            // let sampleFiles = [
            //         {
            //             name: "users-svc",
            //             isDirectory: false,
            //             path: "/network/service/users-svc",
            //             class: 'service'
            //         },
            //         {
            //             name: "login-svc",
            //             isDirectory: false,
            //             path: "/network/service/login-svc",
            //             class: 'service'
            //         },
            //         {
            //             name: "customer-svc",
            //             isDirectory: false,
            //             path: "/network/service/customer-svc",
            //             class: 'service'
            //         },
            //         {
            //             name: "eulen-ingress",
            //             isDirectory: false,
            //             path: "/network/ingress/eulen-ingress",
            //             class: 'ingress'
            //         },
            //         {
            //             name: "superset-ingress",
            //             isDirectory: false,
            //             path: "/network/ingress/superset-ingress",
            //             class: 'ingress'
            //         }
            // ]
            //lensData.files.push(...sampleFiles)

        // Workload

            // Deployment
            let spcDeployment = spaces.get('deployment')!
            setLeftItem(spcDeployment,'edit', launchEdit)

        // Workload
            // Pod
            let spcPod = spaces.get('pod')!
            setPropertyFunction(spcPod, 'container', showPodContainers)
            setPropertyFunction(spcPod, 'cpu', showPodCpu)
            setPropertyFunction(spcPod, 'memory', showPodMemory)
            setLeftItem(spcPod,'viewlog', launchLog)
            setLeftItem(spcPod,'details', launchDetails)
            setLeftItem(spcPod,'delete', launchDelete)

        // Cluster

            // Node
            let spcNode = spaces.get('node')!
            setLeftItem(spcNode,'details', launchDetails)
            setLeftItem(spcNode,'drain', launchNodeDrain)
            setLeftItem(spcNode,'cordon', launchNodeCordon)

            // Namespace
            let spcClassNamespace = spaces.get('classnamespace')!
            setLeftItem(spcClassNamespace, 'create', () => launchCreate('namespace'))
            let spcNamespace = spaces.get('namespace')!
            setLeftItem(spcNamespace,'details', launchDetails)
            setLeftItem(spcNamespace,'edit', launchEdit)
            setLeftItem(spcNamespace,'delete', launchDelete)

        // Network

            // Service
            let spcClassService = spaces.get('classservice')!
            setLeftItem(spcClassService, 'create', () => launchCreate('service'))
            let spcService = spaces.get('service')!
            setLeftItem(spcService,'details', launchDetails)
            setLeftItem(spcService,'edit', launchEdit)
            setLeftItem(spcService,'delete', launchDelete)

            // Ingress
            let spcClassIngress = spaces.get('classingress')!
            setLeftItem(spcClassIngress, 'create', () => launchCreate('ingress'))
            let spcIngress = spaces.get('ingress')!
            setLeftItem(spcIngress,'details', launchDetails)
            setLeftItem(spcIngress,'edit', launchEdit)
            setLeftItem(spcIngress,'delete', launchDelete)

        // Config

            // ConfigMap
            let spcClassConfigMap = spaces.get('classconfigmap')!
            setLeftItem(spcClassConfigMap, 'create', () => launchCreate('configmap'))

            let spcConfigMap = spaces.get('configmap')!
            setLeftItem(spcConfigMap,'details', launchDetails)
            setLeftItem(spcConfigMap,'edit', launchEdit)
            setLeftItem(spcConfigMap,'delete', launchDelete)
            let spcSecret = spaces.get('secret')!
            setLeftItem(spcSecret,'details', launchDetails)
            setLeftItem(spcSecret,'edit', launchEdit)
            setLeftItem(spcSecret,'delete', launchDelete)

        // Storage

            // StorageClass
            let spcClassStorageClass = spaces.get('classstorageclass')!
            setLeftItem(spcClassStorageClass, 'create', () => launchCreate('storageclass'))
            let spcStorageClass = spaces.get('storageclass')!
            setLeftItem(spcStorageClass,'details', launchDetails)
            setLeftItem(spcStorageClass,'edit', launchEdit)
            setLeftItem(spcStorageClass,'delete', launchDelete)

            // PersistentVolumeClaim
            let spcClassPersistentVolumeClaim = spaces.get('classpersistentvolumeclaim')!
            setLeftItem(spcClassPersistentVolumeClaim, 'create', () => launchCreate('persistentvolumeclaim'))
            let spcPersistentVolumeClaim = spaces.get('persistentvolumeclaim')!
            setLeftItem(spcPersistentVolumeClaim,'details', launchDetails)
            setLeftItem(spcPersistentVolumeClaim,'edit', launchEdit)
            setLeftItem(spcPersistentVolumeClaim,'delete', launchDelete)

            // PersistentVolume
            let spcClassPersistentVolume = spaces.get('classpersistentvolume')!
            setLeftItem(spcClassPersistentVolume, 'create', () => launchCreate('persistentvolume'))
            let spcPersistentVolume = spaces.get('persistentvolume')!
            setLeftItem(spcPersistentVolume,'details', launchDetails)
            setLeftItem(spcPersistentVolume,'edit', launchEdit)
            setLeftItem(spcPersistentVolume,'delete', launchDelete)

        }
    }, [])

    // const yamlLinter = linter(view => {
    //     console.log('lint')
    //     let diagnostics: Diagnostic[] = []
    //     try {
    //         console.log(editorValue.code)
    //         let x = yamlParser.dump(editorValue.code)
    //         console.log(x)
    //     }
    //     catch (e:any) {
    //         console.log('error')
    //         if (e.mark) {
    //             const line = e.mark.line;
    //             const column = e.mark.column;

    //             let pos = view.state.doc.line(line + 1).from + column;
    //             if (pos > view.state.doc.length) {
    //                 pos = view.state.doc.length - 1;
    //             }

    //             diagnostics.push({
    //                 from: pos,
    //                 to: pos + 1, // Resaltar un solo carácter o un pequeño rango
    //                 severity: "error", // Indica que es un error crítico
    //                 message: e.reason || "YAML syntax error",
    //             });
    //         }
    //         else {
    //             // Manejar errores que no tienen una marca específica
    //             diagnostics.push({
    //                 from: 0,
    //                 to: 1,
    //                 severity: "error",
    //                 message: e.reason || "GEneral YAML  syntaxerror",
    //             });
    //         }
    //     }

    //     return diagnostics
    // })

    const applyEditorChanges = () => {
        setEditorVisible(false)
        sendCommand(LensCommandEnum.CREATE, [editorContent.code])
    }

    const updateEditorValue= (newCode:any) => {
        editorContent.code=newCode
    }

    const launchEdit = (f:IFileObject[]) => {
        setEditorContent({
            code: yamlParser.dump(f[0].data.origin, { indent: 2 }),
            source: f[0]
        })
        setEditorVisible(true)
    }

    const launchDelete = (f:IFileObject[]) => {
        setMsgBox(MsgBoxYesNo('Delete '+f[0].data.origin.kind,<>Are you sure you want to delete {f[0].data.origin.kind.toLowerCase()}&nbsp;<b>{f[0].name}</b>?</>, setMsgBox, (a) => {
            if (a === MsgBoxButtons.Yes) {
                console.log('delete')
            }
        }))
    }

    const launchCreate = (obj:string) => {
        console.log('create ', obj)
        setEditorContent({
            code: `Kind: ${obj}\r\nejemplo: true`,
            source: undefined
        })
        setEditorVisible(true)
    }

    const setLeftItem = (space:ISpace, name:string, invoke:any) => {
        let x = space.leftItems?.find(f => f.name===name)
        if (x) x.onClick = invoke
    }

    const launchLog = (x:IFileObject[]) => {
        let logResource:IResourceSelected = {
            channelId: 'log',
            clusterName: props.channelObject.clusterName,
            view: 'pod',
            namespaces: [x[0].data.origin.metadata.namespace],
            groups: [],
            pods: [x[0].data.origin.metadata.name],
            containers: [],
            name: `logname`
        }
        let logConfig:ILogConfig = {
            startDiagnostics: false,
            follow: true,
            maxMessages: 5000,
            maxPerPodMessages: 5000,
            sortOrder: LogSortOrderEnum.TIME
        }
        let logInstanceConfig:ILogInstanceConfig = {
            previous: false,
            timestamp: false,
            fromStart: false
        }
        let logSettings ={
            config:logConfig,
            instanceConfig:logInstanceConfig
        }
        if (props.channelObject.onCreateTab) props.channelObject.onCreateTab(logResource, true, logSettings)
    }

    const launchDetails = (x:IFileObject[]) => {
        setDetailsContent(x[0])
        setDetailsSections(objectSections.get(x[0].data.origin.kind)!)
        setDetailsVisible(true)
    }

    const launchNodeDrain = (x:IFileObject[]) => {
        console.log('drain node ',x[0].name)
    }

    const launchNodeCordon = (x:IFileObject[]) => {
        console.log('cordon node ',x[0].name)
    }

    const updateSource = () => {
        console.log(detailsContent)
    }

    const showOverview = () => {
        return 'Cluster date time: ' + new Date().toISOString()
    }

    const showWorkloadOverview = () => {
        return <Box sx={{m:1}}>
            <Card>
                <CardHeader title={'Workload overview'}>

                </CardHeader>
                <CardContent>
                    <Typography>Pods: {lensData.files.filter(f => f.class==='pod').length}</Typography>
                </CardContent>

            </Card>
        </Box>
    }

    const showConfigOverview = () => {
        console.log(lensData.files)
        return <Box sx={{m:1}}>
            <Card>
                <CardHeader title={'Workload overview'}>

                </CardHeader>
                <CardContent>
                    <Typography>ConfigMap: {lensData.files.filter(f => f.class==='configmap').length}</Typography>
                    <Typography>Secret: {lensData.files.filter(f => f.class==='secret').length}</Typography>
                </CardContent>

            </Card>
        </Box>
    }

    const setPathFunction = (path:string, f:any) => {
        let x = lensData.files.find(f => f.path===path)
        if (x) x.children = f
    }

    const setPropertyFunction = (space:ISpace, propName:string, invoke:(f:IFileObject) => void) => {
        if (!space.properties) return
        let prop = space.properties.find(p => p.name===propName)
        if (!prop) return
        prop.format = 'function'
        prop.source = invoke
    }

    const showPodContainers = (f:IFileObject) => {
        if (!f.data?.origin?.status) return <></>
        let result:JSX.Element[]=[]
        for (let c of f.data.origin.status.containerStatuses) {
            let color='orange'
            if (c.started)
                color='green'
            else {
                if (c.state.terminated) color = 'gray'
            }
            result.push(<Box sx={{ width: '8px', height: '8px', backgroundColor: color, margin: '1px', display: 'inline-block' }}/>)
        }
        return result
    }
    const showPodCpu = (f:IFileObject) => {
        return '#'
    }
    const showPodMemory = (f:IFileObject) => {
        return '#'
    }

    const onDelete = (files: IFileObject[]) => {
    }

    const onCreateFolder = async (name: string, parentFolder: IFileObject) => {
    }

    const onError = (error: IError, file: IFileObject) => {
        let uiConfig = props.channelObject.config as ILensConfig
        uiConfig.notify(ENotifyLevel.ERROR, error.message)
    }

    const sendCommand = (command: LensCommandEnum, params:string[]) => {
        if (!props.channelObject.webSocket) return
        
        let lensMessage:ILensMessage = {
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.COMMAND,
            channel: 'lens',
            type: InstanceMessageTypeEnum.DATA,
            accessKey: props.channelObject.accessString!,
            instance: props.channelObject.instanceId,
            id: uuid(),
            command: command,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            params: params,
            msgtype: 'lensmessage'
        }
        let payload = JSON.stringify( lensMessage )
        props.channelObject.webSocket.send(payload)
    }

    const onFolderChange = (folder:string) => {
        lensData.currentPath = folder
        // folder +='/'
        // let level = folder.split('/').length - 1
        // if (level > 2) getLocalDir(folder)
    }

    const onChangeData = (src:string, data:any) => {
        setDetailsChanges( _.set(detailsChanges, src, data))
        console.log(detailsChanges)
    }

    const editFromDetails = (f:IFileObject) => {
        setDetailsVisible(false)
        setEditorContent({
            code: yamlParser.dump(f.data.origin, { indent: 2 }),
            source: f
        })
        setEditorVisible(true)
    }

    return <>
        { lensData.started &&
            <Box ref={lensBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', flexGrow:1, height: `calc(100vh - ${lensBoxTop}px - 16px)`, paddingLeft: '5px', paddingRight:'5px', marginTop:'8px'}}>
                <FileManager
                    files={lensData.files}
                    spaces={spaces}
                    actions={actions}
                    icons={icons}
                    initialPath={lensData.currentPath}
                    enableFilePreview={false}
                    onCreateFolder={onCreateFolder}
                    onError={onError}
                    onRename={undefined}
                    onPaste={undefined}
                    onDelete={onDelete}
                    onFolderChange={onFolderChange}
                    onRefresh={undefined}
                    permissions={permissions}
                    filePreviewPath='http://avoid-console-error'
                    primaryColor='#1976d2'
                    fontFamily='Roboto, Helvetica, Arial, sans-serif'
                    height='100%'
                    className='custom-fm'
                    search='auto'
                    searchRegex={true}
                    searchCasing={true}
                />
                { msgBox }
            </Box>
        }
        <Dialog open={editorVisible} 
            sx={{
            '& .MuiDialog-paper': {
                width: '70vw',
                height: '70vh',
                maxWidth: '70vw',
                maxHeight: '70vh', 
            },
            }}>
            <DialogTitle>
                <Typography>{(editorContent.source?.data.origin.metadata.namespace? editorContent.source?.data.origin.metadata.namespace+'/': '')+editorContent.source?.data.origin.metadata.name}</Typography>
            </DialogTitle>
            <DialogContent>
                <CodeMirror value={editorContent.code} onChange={updateEditorValue} extensions={[yaml()]} />
            </DialogContent>
            <DialogActions>
                <Button onClick={applyEditorChanges}>Ok</Button>
                <Button onClick={() => setEditorVisible(false)}>Cancel</Button>
            </DialogActions>
        </Dialog>
        {detailsVisible && <Dialog open={true} 
            sx={{
            '& .MuiDialog-paper': {
                width: '70vw',
                height: '70vh',
                maxWidth: '70vw',
                maxHeight: '70vh', 
            },
            }}>
            <DialogTitle>
                <Stack direction='row' alignItems={'center'}>
                    <Typography fontSize={18}>{detailsContent?.data.origin.kind+': '+detailsContent?.data.origin.metadata?.name}</Typography>
                    <IconButton color='primary' onClick={() => copy(detailsContent?.data.origin.metadata?.name)}><ContentCopy fontSize='small'/></IconButton>
                    <Typography sx={{flexGrow:1}}/>
                    <IconButton color='primary' onClick={() => {editFromDetails(detailsContent)}}><Edit fontSize='small'/></IconButton>
                    <IconButton color='primary' onClick={() => {setDetailsVisible(false); launchDelete([detailsContent])}}><Delete fontSize='small'/></IconButton>
                    <IconButton color='primary' onClick={() => {setDetailsVisible(false)}}><Close fontSize='small'/></IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent>
                <LensObjectDetails object={detailsContent} sections={detailsSections} onChangeData={onChangeData}/>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => {setDetailsVisible(false); updateSource()}}>Ok</Button>
                <Button onClick={() => setDetailsVisible(false)}>Cancel</Button>
            </DialogActions>
        </Dialog>}

    </>
}
export { LensTabContent }