import React, { useState } from 'react'
import { Accordion, AccordionActions, AccordionDetails, AccordionSummary, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { ExpandMore } from '@mui/icons-material'
import { MagnifyUserSettings } from '../MagnifyUserSettings'
import { IFileObject } from '@jfvilas/react-file-manager'


interface IProps {
    settings: MagnifyUserSettings
    files: IFileObject[]
    onReload?: () => void
}

const UserSettings: React.FC<IProps> = (props:IProps) => {
    const [logLines, setLogLines] = useState(props.settings.logLines)

    const saveGeneral = () => {
    }
    
    const saveChannels = () => {
        props.settings.logLines = logLines
    }

    
    const changesDetectedGeneral = () => {
        return false
    }
    const changesDetectedChannels = () => {
        if (props.settings.logLines !== logLines) return true
        
        return false
    }
    
    const reload = () => {
        if (props.onReload) props.onReload()
    }
    
    return <Box sx={{m:1}}>
        <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="span">General</Typography>
            </AccordionSummary>
            <AccordionDetails>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse
                malesuada lacus ex, sit amet blandit leo lobortis eget.
            </AccordionDetails>
            <AccordionActions>
                <Button onClick={saveGeneral} disabled={!changesDetectedGeneral()}>Save</Button>
            </AccordionActions>
        </Accordion>
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="span">Channels</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <TextField value={logLines} onChange={(event) => {setLogLines(+event.target.value)}} variant='standard' label='Max messages' SelectProps={{native: true}} type='number' fullWidth />
            </AccordionDetails>
            <AccordionActions>
                <Button onClick={saveChannels} disabled={!changesDetectedChannels()}>Save</Button>
            </AccordionActions>
        </Accordion>
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="span">Debug</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Stack direction={'column'} >
                    <Stack direction={'row'} alignItems={'center'}>
                        <Typography sx={{flexGrow:1}}>Show files collection on browser console ({props.files.length} objects, {(JSON.stringify(props.files).length/1024/1024).toFixed(2)}  MB approx.)</Typography>
                        <Button onClick={reload}>Reload</Button> {/*+++ el reload hace que todo crezca en 4 objetos de cada vez*/}
                        <Button onClick={() => console.log(props.files)}>Show files</Button>
                    </Stack>
                </Stack>
            </AccordionDetails>
            <AccordionActions>
            </AccordionActions>
        </Accordion>
    </Box>
    
    }

export { UserSettings }