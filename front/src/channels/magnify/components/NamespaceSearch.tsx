import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, TextField, Typography } from '@mui/material'
import { IFileObject } from '@jfvilas/react-file-manager'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { Close, Fullscreen, FullscreenExit, Minimize, Search } from '@mui/icons-material';
import { objectSearch } from '../Tools';
import { getIconFromKind, IconPod } from '../../../tools/Constants-React';
const _ = require('lodash')

interface IContentEditProps {
    // files: IFileObject[]
    // selectedFile:IFileObject
    scope: string
    selectedFiles: IFileObject[]
    onClose: () => void
    onLink: (kind:string, name:string ) => void
}

// export interface IContentEditObject {
//     type: 'edit'
//     content: { code:string, title: string, source?:IFileObject, maximized?:boolean}
// }

const NamespaceSearch: React.FC<IContentEditProps> = (props:IContentEditProps) => {
//    const content = useRef<IContentEditObject>({ type:'edit', content:{code:'', title:''}})
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
        // if (content.current.content.maximized) {
        //     content.current.content.maximized = false
        //     setPercent(70)
        // }
        // else {
        //     content.current.content.maximized = true
        //     setPercent(100)
        // }
    }

    const close = () => {
        props.onClose()
    }

    const onSearchChange = (event:ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value)
    }

    function getDeepValue(obj:any, pathString:string) {
    const parts = pathString.split('.');
    let current = obj;
    let pathBuffer = "";

    for (let i = 0; i < parts.length; i++) {
        pathBuffer = pathBuffer ? `${pathBuffer}.${parts[i]}` : parts[i];

        if (current && current.hasOwnProperty(pathBuffer)) {
        current = current[pathBuffer]; // Encontró la llave real (aunque tenga puntos)
        pathBuffer = ""; // Limpiamos el buffer para el siguiente nivel
        }
        // Si no existe, sigue acumulando en el buffer (quizás el punto no era separación)
    }
    
    return pathBuffer === "" ? current : undefined;
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
                    <Typography><Search />&nbsp;{props.scope}</Typography>
                    <Typography sx={{flexGrow:1}}></Typography>
                    <IconButton onClick={minimize}>
                        <Minimize />
                    </IconButton>
                    <IconButton onClick={maximizeOrRestore}>
                        {/* { content.current?.content.maximized? <FullscreenExit/> : <Fullscreen/> } */}
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
                    <Typography flexGrow={1}></Typography>
                    <Typography>
                        {search.trim()!=='' && (search.length>=3) && <>Results: {props.selectedFiles.reduce( (acc,file) => acc + objectSearch(file.data?.origin, search).length, 0)}</>}
                    </Typography>
                </Stack>
                <Stack direction={'column'}>
                    {
                        search.trim()!=='' && (search.length>=3) && props.selectedFiles.map((file) => {
                                let res=objectSearch(file.data?.origin, search)
                                return res.map((r) => {
                                    if (!includeStatus && r.startsWith('status')) return
                                    let val = getDeepValue(file.data.origin, r)
                                    return <Stack direction={'row'} sx={{mb:2}} alignItems={'center'}>
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