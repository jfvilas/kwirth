import { Checkbox, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, TextField, Typography } from '@mui/material'
import { IFileObject } from '@jfvilas/react-file-manager'
import { ChangeEvent, useEffect, useState } from 'react'
import { Close, Fullscreen, FullscreenExit, Minimize, Search } from '@mui/icons-material'
import { objectClone, objectSearch } from '../Tools'
import { getIconFromKind } from '../../../tools/Constants-React'
import './ResizableDialog.css'
import { ResizableDialog } from './ResizableDialog'
import { IContentWindow } from '../MagnifyTabContent'

export interface IArtifactSearchData {
    scope: string
    selectedFiles: IFileObject[]
    onLink: (kind:string, name:string, namespace:string) => void
    searchText: string
    includeStatus: boolean
    merge: boolean
    matchCase: boolean
}

export interface IArtifactSearchProps extends IContentWindow {
    data: IArtifactSearchData
}

const ArtifactSearch: React.FC<IArtifactSearchProps> = (props:IArtifactSearchProps) => {
    const [searchText, setSearchText] = useState(props.data.searchText)
    const [includeStatus, setIncludeStatus] = useState(props.data.includeStatus)
    const [merge, setMerge] = useState(props.data.merge)
    const [matchCase, setMatchCase] = useState(props.data.matchCase)

    const [isMaximized, setIsMaximized] = useState(props.isMaximized)
    let artifactSearchData:IArtifactSearchData = props.data

    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement

        const handleKeyDown = (event: KeyboardEvent) => {
            event.stopPropagation()
            if (event.key === 'Escape') props.onClose(props.id)
        }
        window.addEventListener('keydown', handleKeyDown, true)
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true)
            previousFocus?.focus()
        }
    }, [])

	const onFocus = () => {
		if (props.onFocus) props.onFocus()
	}

	const handleIsMaximized = () => {
		props.onWindowChange(props.id, !isMaximized, props.x, props.y, props. width, props.height)
		setIsMaximized(!isMaximized)
	}

    const onSearchChange = (event:ChangeEvent<HTMLInputElement>) => {
        setSearchText(event.target.value)
        props.data.searchText = event.target.value
    }

    const onIncludeStatusChange = () => {
        setIncludeStatus(!includeStatus)
        props.data.includeStatus = !props.data.includeStatus
    }

    const onMatchCaseChange = () => {
        setMatchCase(!matchCase)
        props.data.matchCase = !props.data.matchCase
    }

    const onMergeChange = () => {
        setMerge(!merge)
        props.data.merge = !props.data.merge
    }

    function getDeepValue(obj:any, pathString:string) {
        const parts = pathString.split('.')
        let current = obj
        let pathBuffer = ''

        for (let i = 0; i < parts.length; i++) {
            pathBuffer = pathBuffer ? `${pathBuffer}.${parts[i]}` : parts[i]

            if (current && current.hasOwnProperty(pathBuffer)) {
            current = current[pathBuffer]
            pathBuffer = ''
            }
        }
        return pathBuffer === '' ? current : undefined
    }

    const getResults= (obj:any, text:string, includeStatus:boolean, matchCase:boolean, merge:boolean) => {
        if (!obj || !obj.kind) return []
        let result = []
        if (obj.kind==='Secret' && obj.data) {
            let newObj = objectClone(obj)
            for (let key of Object.keys(newObj.data))
                newObj.data[key] = atob(newObj.data[key])
            result = objectSearch(newObj, text, matchCase)
        }
        else
            result = objectSearch(obj, text, matchCase)
        if (!includeStatus) result= result.filter(r => !r.startsWith('status'))
        if (merge && result.length>1) {
            result=[result[0]]
        }
        return result
    }

    return (
        <ResizableDialog id={props.id} isMaximized={isMaximized} onFocus={onFocus} onWindowChange={props.onWindowChange} x={props.x} y={props.y} width={props.width} height={props.height}>
            <DialogTitle sx={{ cursor: isMaximized ? 'default' : 'move',  py: 1 }} id='draggable-dialog-title'>
                <Stack direction={'row'} alignItems={'center'}>                    
                    <Typography sx={{flexGrow:1}}></Typography>
                    <Typography><Search />&nbsp;{artifactSearchData.scope===':cluster:'?'All cluster':'Namespace: '+artifactSearchData.scope}</Typography>
                    <Typography sx={{flexGrow:1}}></Typography>

                    <IconButton size="small" onClick={() => props.onMinimize(props.id)}>
                        <Minimize fontSize="small" />
                    </IconButton>

                    <IconButton size="small" onClick={handleIsMaximized}>
                        {isMaximized ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
                    </IconButton>

                    <IconButton size="small" onClick={() => props.onClose(props.id)} sx={{ '&:hover': { color: 'error.main' } }}>
                        <Close fontSize="small" />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent>
                <Stack direction={'row'} alignItems={'center'}>
                    <TextField value={searchText} onChange={onSearchChange} variant='standard' label={'Search...'}></TextField>
                    <FormControlLabel control={<Checkbox/>} checked={includeStatus} onChange={onIncludeStatusChange} label='Include status'/>
                    <FormControlLabel control={<Checkbox/>} checked={matchCase} onChange={onMatchCaseChange} label='Match case'/>
                    <FormControlLabel control={<Checkbox/>} checked={merge} onChange={onMergeChange} label='Merge repeated results'/>
                    <Typography flexGrow={1}></Typography>
                    {searchText.trim()!=='' && (searchText.length>=3) && <Typography>Results: {artifactSearchData.selectedFiles.reduce( (acc,file) => acc + getResults(file.data?.origin, searchText, includeStatus, matchCase, merge).length, 0)}</Typography>}
                </Stack>
                <Stack direction={'column'}>
                    {
                        searchText.trim()!=='' && (searchText.length>=3) && artifactSearchData.selectedFiles.map((file) => {
                            let res = getResults(file.data?.origin, searchText, includeStatus, matchCase, merge)
                            return res.map((r,index) => {
                                let val = getDeepValue(file.data.origin, r)
                                let link
                                if (file.data.origin.metadata)
                                    link = <a href={`#`} onClick={() => artifactSearchData.onLink(file.data.origin.kind, file.data.origin.metadata.name, file.data.origin.metadata.namespace)}>{file.data.origin.metadata.name}</a>
                                else
                                    link = <a href={`#`} onClick={() => artifactSearchData.onLink(file.data.origin.kind, file.data.origin.name, '')}>{file.data.origin.name}</a>
                                return <Stack key={index} direction={'row'} sx={{mb:2}} alignItems={'center'}>
                                    {getIconFromKind(file.data?.origin?.kind, 32)}
                                    <Stack direction={'column'} sx={{ml:2}}>
                                        {/* <a href={`#`} onClick={() => props.onLink(file.data.origin.kind,file.data.origin.metadata.name,file.data.origin.metadata.namespace)}>{file.data.origin.metadata.name}</a> */}
                                        {link}
                                        <span style={{marginLeft:'4px'}}>{r}</span>
                                        <span style={{marginLeft:'4px'}}>{String(val).substring(0,80)}{String(val).length>80?'...':''}</span>
                                    </Stack>
                                </Stack>
                            })
                        })
                    }
                </Stack>
            </DialogContent>
        </ResizableDialog>
    )
}
export { ArtifactSearch }