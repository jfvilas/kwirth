import React, { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'

interface IProps {
    onClose:(interval?:number) => {}
    clusterName: string
    clusterMetricsInterval:number
}
const SettingsCluster: React.FC<any> = (props:IProps) => {
    const [clusterMetricsInterval, setClusterMetricsInterval] = useState(props.clusterMetricsInterval)

    return (<>
        <Dialog open={true} >
            <DialogTitle>Cluster settings</DialogTitle>
            <DialogContent >
                <Stack spacing={2} direction={'column'} sx={{width: '40vh' }}>
                    <Typography>Enter Kwirth cluster configuration for cluster '<b>{props.clusterName}</b>'</Typography>
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