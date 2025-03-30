import React, { useState, ChangeEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'

interface IProps {
    onClose:(interval?:number) => {}
    clusterMetricsInterval:number
}
const SettingsCluster: React.FC<any> = (props:IProps) => {
    const [clusterMetricsInterval, setClusterMetricsInterval] = useState(props.clusterMetricsInterval)

    return (<>
        <Dialog open={true} >
            <DialogTitle>Cluster settings</DialogTitle>
            <DialogContent >
                <Stack spacing={2} direction={'column'} sx={{width: '40vh' }}>
                    <TextField value={clusterMetricsInterval} onChange={(e) => setClusterMetricsInterval(+e.target.value)} variant='standard' label='Cluster metrics read interval (seconds)' SelectProps={{native: true}} type='number'></TextField>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onClose(clusterMetricsInterval)}>OK</Button>
                <Button onClick={() => props.onClose(undefined)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export { SettingsCluster }