import React, { useState, ChangeEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'

interface IProps {
    onClose:(interval:number|undefined) => {}
    clusterMetricsInterval:number
}
const SettingsCluster: React.FC<any> = (props:IProps) => {
    const [clusterMetricsInterval, setClusterMetricsInterval] = useState(props.clusterMetricsInterval)

    const onChangeClusterMetricsInterval = (event:ChangeEvent<HTMLInputElement>) => {
        setClusterMetricsInterval(+event.target.value)
    }

    const closeOk = () =>{
        props.onClose(clusterMetricsInterval)
    }

    return (<>
        <Dialog open={true} >
            <DialogTitle>Settings</DialogTitle>
            <DialogContent sx={{height:'30vh'}}>
                <Stack  spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
                    <TextField value={clusterMetricsInterval} onChange={onChangeClusterMetricsInterval} variant='standard' label='Cluster metrics read interval (seconds)' SelectProps={{native: true}} type='number'></TextField>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={closeOk}>OK</Button>
                <Button onClick={() => props.onClose(undefined)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export { SettingsCluster }