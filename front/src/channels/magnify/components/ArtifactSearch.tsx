import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, TextField, Typography } from '@mui/material'
import { IFileObject } from '@jfvilas/react-file-manager'
import { ChangeEvent, useEffect, useState } from 'react'
import { Close, Minimize, Search } from '@mui/icons-material'
import { objectClone, objectSearch } from '../Tools'
import { getIconFromKind } from '../../../tools/Constants-React'

interface IContentEditProps {
    scope: string
    selectedFiles: IFileObject[]
    onClose: () => void
    onLink: (kind:string, name:string ) => void
}

const ArtifactSearch: React.FC<IContentEditProps> = (props:IContentEditProps) => {
    const [searchText, setSearch] = useState('')
    const [includeStatus, setIncludeStatus] = useState(false)
    const [matchCase, setMatchCase] = useState(false)
    const percent = 70

    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement;

        const handleKeyDown = (event: KeyboardEvent) => {
            event.stopPropagation()
            if (event.key === 'Escape') props.onClose()
            //+++if (event.key === 'Enter' && event.ctrlKey) closeOk
        }
        window.addEventListener('keydown', handleKeyDown, true)
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true)
            previousFocus?.focus()
        }
    }, [])

    const close = () => {
        props.onClose()
    }

    const onSearchChange = (event:ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value)
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

    const getResults= (obj:any, text:string, includeStatus:boolean, matchCase:boolean) => {
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
        return result
    }

    return (
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
                <Stack direction={'row'} alignItems={'center'}>                    
                    <Typography sx={{flexGrow:1}}></Typography>
                    <Typography><Search />&nbsp;{props.scope===':cluster:'?'All cluster':'Namespace: '+props.scope}</Typography>
                    <Typography sx={{flexGrow:1}}></Typography>
                    <IconButton disabled={true}>
                        <Minimize />
                    </IconButton>
                    <IconButton disabled={true}>
                    </IconButton>
                    <IconButton onClick={close}>
                        <Close />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent>
                <Stack direction={'row'} alignItems={'center'}>
                    <TextField value={searchText} onChange={onSearchChange} variant='standard' label={'Search...'}></TextField>
                    <FormControlLabel control={<Checkbox/>} value={includeStatus} onChange={() => setIncludeStatus(!includeStatus)} label='Include status'/>
                    <FormControlLabel control={<Checkbox/>} value={matchCase} onChange={() => setMatchCase(!matchCase)} label='Match case'/>
                    <Typography flexGrow={1}></Typography>
                    <Typography>
                        {searchText.trim()!=='' && (searchText.length>=3) && <>Results: {props.selectedFiles.reduce( (acc,file) => acc + getResults(file.data?.origin, searchText, includeStatus, matchCase).length, 0)}</>}
                    </Typography>
                </Stack>
                <Stack direction={'column'}>
                    {
                        searchText.trim()!=='' && (searchText.length>=3) && props.selectedFiles.map((file) => {
                                let res = getResults(file.data?.origin, searchText, includeStatus, matchCase)
                                return res.map((r) => {
                                    let val = getDeepValue(file.data.origin, r)
                                    return <Stack direction={'row'} sx={{mb:2}} alignItems={'center'}>
                                        {getIconFromKind(file.data?.origin?.kind, 32)}
                                        <Stack direction={'column'} sx={{ml:2}}>
                                            <a href={`#`} onClick={() => props.onLink(file.data.origin.kind,file.data.origin.metadata.name)}>{file.data.origin.metadata.name}</a>
                                            <span style={{marginLeft:'4px'}}>{r}</span>
                                            <span style={{marginLeft:'4px'}}>{String(val).substring(0,80)}{String(val).length>80?'...':''}</span>
                                        </Stack>
                                    </Stack>
                                })
                            }
                        )
                    }
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={props.onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    )
}
export { ArtifactSearch }