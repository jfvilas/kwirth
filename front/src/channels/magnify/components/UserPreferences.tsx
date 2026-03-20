import React, { useRef, useState } from 'react'
import { Accordion, AccordionActions, AccordionDetails, AccordionSummary, Box, Button, Checkbox, FormControlLabel, MenuItem, Select, SelectChangeEvent, Stack, TextareaAutosize, TextField, Typography } from '@mui/material'
import { ExpandMore } from '@mui/icons-material'
import { allKinds, IKind, MagnifyUserPreferences } from './MagnifyUserPreferences'
import { IFileObject } from '@jfvilas/react-file-manager'
import { IChannelObject } from '../../IChannel'

interface IUserPreferencesProps {
    channelObject: IChannelObject
    preferences: MagnifyUserPreferences
    files: IFileObject[]
    onDataReload?: () => void
}

export interface ICustomAction {
    type: 'kwirth'|'kube'
    name: string
    podYaml: string
    onReady: 'shell'|'http'|'https'
    url?: string
    forward?: boolean
}

const UserPreferences: React.FC<IUserPreferencesProps> = (props:IUserPreferencesProps) => {
    const [palette, setPalette] = useState(props.preferences.palette || 'light')
    const [logLines, setLogLines] = useState(props.preferences.logLines)
    const [tracing, setTracing ] = useState(props.preferences.tracing)
    const [sourceList, setSourceList] = useState<IKind[]>(props.preferences.dataConfig?.source)
    const [syncList, setSyncList] = useState<IKind[]>(props.preferences.dataConfig?.sync)
    const [dataHelm, setDataHelm] = useState<boolean>(props.preferences.dataHelm)
    const [dataManagedFields, setDataManagedFields] = useState<boolean>(props.preferences.dataManagedFields)
    const [customActions, setCustomActions] = useState<ICustomAction[]>(props.preferences.customActions || [])
    
    const [displayChanged, setDisplayChanged] = useState(false)
    const [dataChanged, setDataChanged] = useState(false)
    const [debugChanged, setDebugChanged] = useState(false)
    const [externalChanged, setExternalChanged] = useState(false)
    const filterRef = useRef<HTMLInputElement>(null)

    const save = () => {
        if (!props.channelObject.writeChannelUserPreferences) return
        props.preferences.palette = palette
        props.preferences.dataHelm = dataHelm
        props.preferences.dataManagedFields = dataManagedFields
        props.preferences.dataConfig.source = sourceList
        props.preferences.dataConfig.sync = syncList
        props.preferences.logLines = logLines
        props.preferences.tracing = tracing
        props.preferences.customActions = customActions
        props.channelObject.writeChannelUserPreferences(props.channelObject.channel.channelId, props.preferences)
        setDisplayChanged(false)
        setDataChanged(false)
        setDebugChanged(false)
        setExternalChanged(false)
    }
    
    const reload = () => {
        if (props.onDataReload) props.onDataReload()
    }

    const showFiles = () => {
        console.log(props.files.filter(f => f.name.includes(filterRef.current!.value) || f.path.includes(filterRef.current!.value)))
    }

    const changeKind = (type:string, kind:IKind) => {
        let list=sourceList
        if (type==='sync') list=syncList

        if (list.some(k => k.name===kind.name))
            list=list.filter(k => k.name!==kind.name)
        else
            list.push(kind)
        if (type==='source') setSourceList([...list])
        if (type==='sync') setSyncList([...list])
        setDataChanged(true)
    }

    const onChangePalette = (event: SelectChangeEvent) => {
        setPalette(event.target.value)
        props.channelObject.setPalette?.(event.target.value)
        setDisplayChanged(true)
    }

    const removeCustomAction = (index:number) => {
        customActions.splice(index,1)
        setCustomActions([...customActions])
    }

    return <Box width={'100%'} height={'100%'} display={'flex'} flexDirection={'column'} p={2} sx={{bgcolor: 'background.default', borderBottomRightRadius:'8px', overflowY: 'auto'}}> 
        <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="span"><b>Display</b></Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Stack direction={'column'} >
                    <Stack direction={'row'} alignItems={'center'}>
                        <Typography sx={{flexGrow:1}}>Palette mode</Typography>
                        <Select value={palette} onChange={onChangePalette} variant='standard' sx={{width:'100px'}}>
                            <MenuItem value='light'>Light</MenuItem>
                            <MenuItem value='dark'>Dark</MenuItem>
                        </Select>
                    </Stack>
                </Stack>
            </AccordionDetails>
            <AccordionActions>
                <Button onClick={save} disabled={!displayChanged}>Save</Button>
            </AccordionActions>
        </Accordion>

        <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="span"><b>Custom actions</b></Typography>
            </AccordionSummary>
            <AccordionDetails>
                {
                    customActions.map((ca,index) => {
                        return (
                            <Stack key={'action'+index} direction={'column'} gap={1} sx={{mb:2}}>
                                <Stack direction={'row'} gap={1} alignItems={'center'}>
                                    <Select value={ca.type} onChange={(event) => { ca.type = event.target.value; setCustomActions([...customActions])}} variant='standard' sx={{width:'100px'}}>
                                        <MenuItem value='kwirth'>Kwirth</MenuItem>
                                        <MenuItem value='kube'>Kube</MenuItem>
                                    </Select>
                                    <TextField value={ca.name} onChange={(event) => { ca.name = event.target.value; setCustomActions([...customActions])}} variant='standard'>Name</TextField>
                                    <Select value={ca.onReady} onChange={(event) => { ca.onReady = event.target.value; setCustomActions([...customActions])}} variant='standard' sx={{width:'100px'}}>
                                        <MenuItem value='shell'>Shell</MenuItem>
                                        <MenuItem value='http'>HTTP</MenuItem>
                                        <MenuItem value='https'>HTTPS</MenuItem>
                                    </Select>
                                    <FormControlLabel control={<Checkbox onChange={(event) => { ca.forward=event.target.checked; setCustomActions([...customActions])}} checked={ca.forward} disabled={ca.onReady==='shell'}/>} label={'Forward'}/>
                                    <TextField value={ca.url} onChange={(event) => { ca.url=event.target.value; setCustomActions([...customActions])}} disabled={ca.onReady==='shell' || ca.forward} fullWidth variant='standard'>Url</TextField>
                                    <Typography sx={{flexGrow:1}}/>
                                    <Button onClick={() => removeCustomAction(index)}>Remove</Button>
                                </Stack>
                                <TextareaAutosize key={'yaml'+index} value={ca.podYaml} onChange={(event) => { ca.podYaml=event.target.value; setCustomActions([...customActions])}} style={{height: '100px'}}></TextareaAutosize>
                            </Stack>
                        )
                    })
                }
                <Stack direction={'row'} justifyContent={'end'}>
                    <Button onClick={() => setCustomActions([...customActions, { type:'kube', name: '', podYaml: '', onReady: 'shell'}])}>Add</Button>
                </Stack>
            </AccordionDetails>
            <AccordionActions>
                <Button onClick={save}>Save</Button>
            </AccordionActions>
        </Accordion>

        <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="span"><b>External content</b></Typography>
            </AccordionSummary>
            <AccordionDetails>
                <TextField value={logLines} onChange={(event) => {setLogLines(+event.target.value); setExternalChanged(true)}} variant='standard' label='Max messages' SelectProps={{native: true}} type='number' fullWidth />
            </AccordionDetails>
            <AccordionActions>
                <Button onClick={save} disabled={!externalChanged}>Save</Button>
            </AccordionActions>
        </Accordion>

        <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="span"><b>Data management</b></Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Stack direction={'row'}>
                    <Stack direction={'column'} sx={{width:'59%'}}>
                        <Typography fontWeight={700}>Storage</Typography>
                        <FormControlLabel control={<Checkbox onChange={(event) => {setDataHelm(event.target.checked); setDataChanged(true)}} checked={dataHelm}/>} label={'Keep Helm data'}/>
                        <FormControlLabel control={<Checkbox onChange={(event) => {setDataManagedFields(event.target.checked); setDataChanged(true)}} checked={dataManagedFields}/>} label={'Keep managed fields'}/>
                    </Stack>

                    <Stack direction={'column'} sx={{width:'59%'}}>
                        <Typography fontWeight={700}>Source</Typography>
                        { allKinds.map(kind => {
                            return (
                                <FormControlLabel key={kind.name} control={<Checkbox onChange={() => changeKind('source', kind)} checked={sourceList.some(s => s.name===kind.name)}/>} label={kind.name}/>
                            )
                        })} 
                    </Stack>
                    <Stack direction={'column'} sx={{width:'100%'}}>
                        <Typography fontWeight={700}>Sync</Typography>
                        { allKinds.map(kind => {
                            return (
                                <FormControlLabel key={kind.name} control={<Checkbox onChange={() => changeKind('sync', kind)} checked={syncList.some(s => s.name===kind.name)}/>} label={kind.name}/>
                            )
                        })} 
                    </Stack>
                </Stack>
            </AccordionDetails>
            <AccordionActions>
                <Button onClick={save} disabled={!dataChanged}>Save</Button>
            </AccordionActions>
        </Accordion>

        <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="span"><b>Debug</b></Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Stack direction={'column'} >
                    <Stack direction={'row'} alignItems={'center'}>
                        <Typography sx={{flexGrow:1}}>Show files collection on browser console ({props.files.length} objects, {(JSON.stringify(props.files).length/1024/1024).toFixed(2)}  MB approx.)</Typography>
                        <TextField inputRef={filterRef} label='Text filter...' variant='standard'></TextField>
                        <Button onClick={reload}>Reload</Button>
                        <Button onClick={showFiles}>Show files</Button>
                    </Stack>
                    <Stack direction={'row'} alignItems={'center'}>
                        <Typography sx={{flexGrow:1}}>Metrics names</Typography>
                        <Button onClick={() => console.log(props.channelObject.metricsList?.keys())}>Show metrics</Button>
                    </Stack>
                    <Stack direction={'row'} alignItems={'center'}>
                        <Typography sx={{flexGrow:1}}>Objects</Typography>
                        <Button onClick={() => console.log(props.channelObject)}>Show object</Button>
                    </Stack>
                    <Stack direction={'row'} alignItems={'center'}>
                        <Typography sx={{flexGrow:1}}>Message tracing (send to console received messages)</Typography>
                        <Checkbox checked={tracing} onChange={() => { setTracing(!tracing); setDebugChanged(true)}}/>
                    </Stack>
                </Stack>
            </AccordionDetails>
            <AccordionActions>
                <Button onClick={save} disabled={!debugChanged}>Save</Button>
            </AccordionActions>
        </Accordion>

    </Box>
    }

export { UserPreferences }