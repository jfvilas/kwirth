import { useEffect, useRef, useState } from 'react'
import { IChannelObject } from '../IChannel'
import { FilemanCommandEnum, IFileData, IFilemanMessage, IFilemanObject } from './FilemanObject'
import '@jfvilas/react-file-manager/dist/style.css'
import { FileManager } from '@jfvilas/react-file-manager'
import { Box } from '@mui/material';
import { InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum } from '@jfvilas/kwirth-common';
import { v4 as uuidv4 } from 'uuid'
import './custom-fm.css'

interface IContentProps {
    webSocket?: WebSocket
    channelObject: IChannelObject
}

const FilemanTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    const filemanBoxRef = useRef<HTMLDivElement | null>(null)
    const [logBoxTop, setLogBoxTop] = useState(0)
    const [refresh, setRefresh] = useState(0)

    let filemanObject:IFilemanObject = props.channelObject.uiData
    let permissions={
        create: true,
        delete: true,
        download: true,
        copy: true,
        move: true,
        rename: true,
        upload: true
    }    
    let level = filemanObject.currentPath.split('/').length - 1
    if (level<3) {
        permissions = {
            create: false,
            delete: false,
            download: false,
            copy: false,
            move: false,
            rename: false,
            upload: false
        }
    }

    useEffect(() => {
        if (filemanBoxRef.current) setLogBoxTop(filemanBoxRef.current.getBoundingClientRect().top)
    })

    interface IFileUploadConfig  { 
        url: string
        method?: "POST" | "PUT"
        headers?: { [key: string]: string }
    }

    let fileUploadConfig:IFileUploadConfig = {
        url: `${props.channelObject.clusterUrl}/channel/fileman/upload?key=${props.channelObject.instanceId}`,
        method:'POST',
        headers: {
            'Authorization': 'Bearer '+ props.channelObject.accessString
        }
    }

    const onDelete = async (files: Array<IFileData>) => {
        console.log('remove', files, filemanObject.files)    
        for (let file of files) {
            let [namespace,pod,container] = file.path.split('/').slice(1)
            filemanObject.files = filemanObject.files.filter(f => f.path !== file.path)
            await sendCommand(FilemanCommandEnum.DELETE, namespace, pod, container, [file.path])
            setRefresh(Math.random())
        }
    }

    const onCreateFolder = async (name: string, parentFolder: IFileData) => {
        setRefresh(Math.random())
        console.log('cre', parentFolder.path + '/' + name)
        let [namespace,pod,container] = parentFolder.path.split('/').slice(1)
        sendCommand(FilemanCommandEnum.CREATE, namespace, pod, container, [parentFolder.path + '/' + name])
    }

    const onDownload = async (files: Array<IFileData>) => {
        for (let file of files) {
            console.log(file)
            // Crear la URL para la descarga
            const url = `${props.channelObject.clusterUrl}/channel/fileman/download?filename=${file.path}`
            
            try {
                // Hacer una petición fetch para obtener el archivo
                const response = await fetch(url, { headers: { 'Authorization': 'Bearer '+ props.channelObject.accessString } })

                if (response.ok) {
                    // Convertir la respuesta en un Blob
                    const blob = await response.blob()

                    // Crear un enlace para descargar el archivo
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = file.path.split('/').slice(-1)[0]
                    if (file.isDirectory) link.download += '.tar.gz'
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    URL.revokeObjectURL(link.href)
                } else {
                    console.error(`Error al descargar el archivo: ${file.path}`)
                }
            } catch (error) {
                console.error(`Error en la descarga del archivo: ${file.path}`, error)
            }
        }
    }
    // const onDownloadSimple = (files: Array<IFileData>) => {
    //     for (let file of files) {
    //         let url = `${props.channelObject.clusterUrl}/channel/fileman/download?key=${props.channelObject.instanceId}&filename=${file.path}`
    //         const link = document.createElement('a')
    //         link.href = url
    //         document.body.appendChild(link)
    //         link.click()
    //         document.body.removeChild(link)
    //     }
    // }

    const onPaste = (files: Array<IFileData>, destFolder:IFileData, operation:string) => {
        let command = operation==='move'? FilemanCommandEnum.MOVE : FilemanCommandEnum.COPY
        for (let file of files) {
            let [namespace,pod,container] = file.path.split('/').slice(1)
            console.log(command, namespace, pod, container, [file.path, destFolder.path])
            sendCommand(command, namespace, pod, container, [file.path, destFolder.path])
        }        
    }

    const onError = (error: { type: string, message: string }, file: IFileData) => {
        props.channelObject.uiConfig.notify(error.message, 'error')
    }

    const onRename	= (file: IFileData, newName: string) => {
        let [namespace,pod,container] = file.path.split('/').slice(1)
        filemanObject.files = filemanObject.files.filter (f => f.path!==file.path)
        sendCommand(FilemanCommandEnum.RENAME, namespace, pod, container, [file.path, newName])
    }

    const onRefresh = () => {
        if (level >= 3) {
            filemanObject.files = filemanObject.files.filter ( f => !f.path.startsWith(filemanObject.currentPath+'/'))
            getLocalDir(filemanObject.currentPath+'/')
        }
        else {
            sendCommand(FilemanCommandEnum.HOME, '', '', '', [])
        }

    }

    const sendCommand = (command: FilemanCommandEnum, namespace:string, pod:string, container:string,  params:string[]) => {
        if (!props.channelObject.webSocket) return
        
        let filemanMessage:IFilemanMessage = {
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.COMMAND,
            channel: 'fileman',
            type: InstanceMessageTypeEnum.DATA,
            accessKey: props.channelObject.accessString!,
            instance: props.channelObject.instanceId,
            id: uuidv4(),
            command: command,
            namespace: namespace,
            group: '',
            pod: pod,
            container: container,
            params: params,
            msgtype: 'filemanmessage'
        }
        let payload = JSON.stringify( filemanMessage )
        if (props.channelObject.webSocket) props.channelObject.webSocket.send(payload)
    }

    const getLocalDir = (folder:string) => {
        let [namespace,pod,container] = folder.split('/').slice(1)
        let filemanMessage:IFilemanMessage = {
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.COMMAND,
            channel: 'fileman',
            type: InstanceMessageTypeEnum.DATA,
            accessKey: props.channelObject.accessString!,
            instance: props.channelObject.instanceId,
            id: uuidv4(),
            command: FilemanCommandEnum.DIR,
            namespace: namespace,
            group: '',
            pod: pod,
            container: container,
            params: [folder],
            msgtype: 'filemanmessage'
        }
        let payload = JSON.stringify( filemanMessage )
        if (props.channelObject.webSocket) props.channelObject.webSocket.send(payload)
    }

    const onFolderChange = (folder:string) => {
        filemanObject.currentPath = folder
        folder +='/'
        let level = folder.split('/').length - 1
        if (level > 2) getLocalDir(folder)
    }

    const onFileUploading = (file: File, parentFolder: File) => { 
        return { filename: filemanObject.currentPath + '/' + file.name }
    }

    return <>
        { filemanObject.started &&
            <Box ref={filemanBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', flexGrow:1, height: `calc(100vh - ${logBoxTop}px - 10px)`, paddingLeft: '5px', paddingRight:'5px'}}>
                <FileManager files={filemanObject.files}
                    initialPath={filemanObject.currentPath}
                    enableFilePreview={false}
                    onCreateFolder={onCreateFolder}
                    onError={onError}
                    onRename={onRename}
                    onPaste={onPaste}
                    onDelete={onDelete}
                    onFolderChange={onFolderChange}
                    onRefresh={onRefresh}
                    onFileUploading={onFileUploading}
                    onDownload={onDownload}
                    permissions={permissions}
                    fileUploadConfig={fileUploadConfig}
                    filePreviewPath='http://avoid-console-error'
                    primaryColor='#1976d2'
                    fontFamily='Roboto, Helvetica, Arial, sans-serif'
                    height='100%'
                    className='custom-fm'
                />
            </Box>
        }
    </>
}
export { FilemanTabContent }