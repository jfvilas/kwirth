import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, TextField, Typography } from '@mui/material'
import { IFileObject } from '@jfvilas/react-file-manager'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { Close, Fullscreen, FullscreenExit, Minimize, Search } from '@mui/icons-material';
import { objectSearch } from '../Tools';
import { getIconFromKind, IconPod } from '../../../tools/Constants-React';
const _ = require('lodash')

interface IContentEditProps {
    files: IFileObject[]
    selectedFile:IFileObject
    onClose: () => void
    onLink: (kind:string, name:string ) => void
}

export interface IContentEditObject {
    type: 'edit'
    content: { code:string, title: string, source?:IFileObject, maximized?:boolean}
}

const NamespaceSearch: React.FC<IContentEditProps> = (props:IContentEditProps) => {
    const content = useRef<IContentEditObject>({ type:'edit', content:{code:'', title:''}})
    const [search, setSearch] = useState('')
    const [includeStatus, setIncludeStatus] = useState(false)
    const [percent, setPercent] = useState<number>(70)
   
    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement;

        const handleKeyDown = (event: KeyboardEvent) => {
            event.stopPropagation()
            if (event.key === 'Escape') props.onClose()
            //   if (event.key === 'Enter') {
            //     console.log("Acción confirmada en el popup");
            //   }
        }

        window.addEventListener('keydown', handleKeyDown, true)

        // 4. Llevamos el foco al popup para accesibilidad
        //cardRef.current?.focus();

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true)
            previousFocus?.focus()
        }
    }, [])

    const onChangeStatus = () => {
        setIncludeStatus(!includeStatus)
    }

    useEffect( () => {
    },[])

    const minimize = () => {
    }

    const ok = () => {
    }

    const maximizeOrRestore = () => {
        if (content.current.content.maximized) {
            content.current.content.maximized = false
            setPercent(70)
        }
        else {
            content.current.content.maximized = true
            setPercent(100)
        }
    }

    const close = () => {
        props.onClose()
    }

    const onSearchChange = (event:ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value)
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
                    <Typography><Search />&nbsp;{props.selectedFile?.name}</Typography>
                    <Typography sx={{flexGrow:1}}></Typography>
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

            <DialogContent>
                <Stack direction={'row'} alignItems={'center'}>
                    <TextField value={search} onChange={onSearchChange} variant='standard' label={'Search...'}></TextField>
                    <FormControlLabel control={<Checkbox/>} value={includeStatus} onChange={onChangeStatus} label='Include status'/>
                </Stack>
                <Stack direction={'column'}>
                    {
                        search.trim()!=='' && props.files.filter(f => f.data?.origin?.metadata?.namespace === props.selectedFile.data.origin.metadata.name)
                            .map((file, index1) => {
                                let res=objectSearch(file.data.origin, search)
                                return res.map((r, index2) => {
                                    if (!includeStatus && r.startsWith('status')) return
                                    let val = _.get(file.data.origin, r)
                                    if (val===undefined) return
                                    return <Stack key={''+index1+index2}direction={'row'} sx={{mb:2}} alignItems={'center'}>
                                        {getIconFromKind(file.data.origin.kind, 32)}
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
export { NamespaceSearch }