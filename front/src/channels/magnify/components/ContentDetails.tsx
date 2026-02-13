import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { IFileObject, ISpaceMenuItem } from '@jfvilas/react-file-manager'
import { useEffect, useRef, useState } from 'react'
import { Close, ContentCopy, Delete, Edit, Fullscreen, FullscreenExit, Minimize } from '@mui/icons-material'
import { DetailsObject, IDetailsSection } from './DetailsObject'
import { objectClone } from '../Tools'
import { ContainersMenu } from './ContainersMenu'
const _ = require('lodash')
const copy = require('clipboard-copy')

interface IContentDetailsProps {
    selectedFile?:IFileObject
    content?: IContentDetailsObject
    sections: IDetailsSection[]
    actions: ISpaceMenuItem[]
    onApply: (path:string, obj:any) => void
    onEdit: (path:string) => void
    onDelete: (path:string) => void
    onAction: (action:string, path:string, container?:string) => void
    onMinimize: (content:IContentDetailsObject) => void
    onClose: (content:IContentDetailsObject) => void
    onLink: (kind:string, name:string, namespace:string) => void
    includeAllContainers: Map<string, number>
}

export interface IContentDetailsObject {
    type: 'details'
    content: { path:string, title: string, source:IFileObject, maximized:boolean}
}

const ContentDetails: React.FC<IContentDetailsProps> = (props:IContentDetailsProps) => {
    const content = useRef<IContentDetailsObject>()
    const [percent, setPercent] = useState<number>(70)
    const [containsEdit, setContainsEdit] = useState<boolean>(false)
    const [dataChanged, setDataChanged] = useState<boolean>(false)
    const [leftMenuAnchorParent, setContainersMenuAnchorParent] = useState<Element>()
    const [selectedAction, setSelectedAction] = useState('')
    
    const newObject = useRef()
    let showEdit = false
    let showDelete = false
    let items = props.actions.filter(a => a.name!=='details')
    if (items.some(a => a.name==='edit')) {
        items=items.filter(a => a.name!=='edit')
        showEdit=true
    }
    if (items.some(a => a.name==='delete')) {
        items=items.filter(a => a.name!=='delete')
        showDelete=true
    }
   
    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement

        const handleKeyDown = (event: KeyboardEvent) => {
            event.stopPropagation()
            if (event.key === 'Escape') props.onClose(content.current!)
        }

        window.addEventListener('keydown', handleKeyDown, true)
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true)
            previousFocus?.focus()
        }
    }, [])

    useEffect( () => {
        if (props.content) {
            content.current = props.content
            setPercent(content.current.content.maximized? 100 : 70)
        }
        else if (props.selectedFile) {
            content.current = { type:'details', content:{path:'', title:'', source: {name:'', isDirectory:false, path:''}, maximized:false}}
            if (props.selectedFile.data.origin.metadata)
                content.current.content.title = (props.selectedFile.data.origin.metadata.namespace? props.selectedFile.data.origin.metadata.namespace+'/': '') + props.selectedFile.data.origin.metadata.name
            else {
                // this is valid for API Resources
                content.current.content.title = props.selectedFile.data.origin.name
            }
            content.current.content.path = props.selectedFile.path
            content.current.content.source = props.selectedFile
            setPercent(70)
        }
        else {
            console.log('Must not happen!')
        }
        newObject.current = objectClone(content.current!.content.source.data.origin)
    },[])

    const minimize = () => {
        if (content.current) props.onMinimize(content.current)
    }

    const maximizeOrRestore = () => {
        if (content.current) {
            if (content.current.content.maximized) {
                content.current.content.maximized = false
                setPercent(70)
            }
            else {
                content.current.content.maximized = true
                setPercent(100)
            }
        }
    }

    const apply = () => {
        if (content.current) props.onApply(content.current.content.path, newObject.current)
    }

    const close = () => {
        if (content.current) props.onClose(content.current)
    }

    const editObject = () => {
        if (content.current) props.onEdit(content.current.content.path)
    }

    const deleteObject = () => {
        if (content.current) props.onDelete((content.current.content.path))
    }

    const link = (kind:string, name:string, namespace:string) => {
        props.onLink(kind, name, namespace)
    }

    const onChangeData = (path:string, data:any) => {
        if (content.current?.content.source.data.origin.kind === 'ConfigMap') {
            _.set(newObject.current, path, data)
        }
        if (content.current?.content.source.data.origin.kind === 'Secret') {
            _.set(newObject.current, path, btoa(data))
        }
        setDataChanged(true)
    }

    const onContainsEdit = (val:boolean) => {
        setContainsEdit(val)
    }

    const actionClick = (action:string, currentTarget:Element) => {
        if (props.selectedFile && props.selectedFile.path.startsWith('/workload/Pod/')) {
            if (props.includeAllContainers.get(action)! >= 1) {
                setContainersMenuAnchorParent(currentTarget)
                setSelectedAction(action)
            }
            else {
                if (props.selectedFile) props.onAction(action, props.selectedFile.path, undefined)
            }
        }
        else {
            if (props.selectedFile) props.onAction(action, props.selectedFile.path, undefined)
        }
    }

    const onOptionSelected = (container:string) => {
        if (props.selectedFile) props.onAction(selectedAction, props.selectedFile.path, container)
    }

    return (
        <>
        <Dialog open={true} 
            sx={{
            '& .MuiDialog-paper': {
                width: `${percent}vw`,
                height: `${percent}vh`,
                maxWidth: `${percent}vw`,
                maxHeight: `${percent}vh`
            },
            }}>
            <DialogTitle>
                <Stack direction='row' alignItems={'center'}>
                    <Typography fontSize={18}>{content.current && content.current.content.source.data?.origin.kind+': '+(content.current.content.source.data?.origin?.metadata?content.current.content.source.data?.origin.metadata?.name:content.current.content.source.data?.origin.name)}</Typography>
                    <Tooltip title='Copy'>
                        <IconButton color='primary' onClick={() => copy(content.current && content.current.content.source.data?.origin.metadata?.name)}><ContentCopy fontSize='small'/></IconButton>
                    </Tooltip>
                    {
                        items.map((a,index) => {
                            return <Tooltip key={index} title={a.text}>
                                <IconButton color='primary' onClick={(event) => actionClick(a.name!, event.currentTarget)}>{a.icon!}</IconButton>
                            </Tooltip>
                        })
                    }
                    {showEdit && <Tooltip title='Edit'>
                        <IconButton color='primary' onClick={editObject}><Edit fontSize='small'/></IconButton>
                    </Tooltip>}
                    { showDelete && <Tooltip title='Delete'>
                        <IconButton color='primary' onClick={deleteObject}><Delete fontSize='small'/></IconButton>
                    </Tooltip>}
                    

                    <Typography sx={{flexGrow:1}}/>

                    <IconButton onClick={minimize}>
                        <Minimize />
                    </IconButton>
                    <IconButton onClick={maximizeOrRestore}>
                        { content.current?.content.maximized? <FullscreenExit/> : <Fullscreen/> }
                    </IconButton>
                    <IconButton onClick={close}>
                        <Close />
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent >
                {
                    content.current && <DetailsObject object={content.current.content.source} sections={props.sections} onChangeData={onChangeData} onLink={link} onContainsEdit={onContainsEdit}/>
                }
            </DialogContent>
            <DialogActions>
                <Button onClick={apply} disabled={!containsEdit || !dataChanged}>Apply</Button>
            </DialogActions>
        </Dialog>
        {
            leftMenuAnchorParent && 
            props.selectedFile &&
            props.selectedFile.path.startsWith('/workload/Pod/') && 
            props.includeAllContainers.get(selectedAction)!>=0 &&
            <ContainersMenu f={props.selectedFile} onClose={() => setContainersMenuAnchorParent(undefined)} onContainerSelected={onOptionSelected} anchorParent={leftMenuAnchorParent} includeAllContainers={Boolean(props.includeAllContainers.get(selectedAction)===2)} />
        }
        </>
    )
}
export { ContentDetails }
