import { useEffect, useRef, useState } from 'react'
import { IChannelObject } from '../../../model/ITabObject'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid, Menu, MenuItem, MenuList, Slider, Stack, Typography } from '@mui/material'
import { TrivyObject } from '../../../model/TrivyObject'
import { TabContentTrivyAsset, TabContentTrivyVuln } from './TabContentTrivyAsset'
import { Check as CheckIcon } from '@mui/icons-material'
import { assetScore } from './TrivyCommon'

interface IProps {
    webSocket?: WebSocket
    channelObject: IChannelObject
}

const TabContentTrivy: React.FC<IProps> = (props:IProps) => {
    let trivyObject = props.channelObject.data as TrivyObject
    const trivyBoxRef = useRef<HTMLDivElement | null>(null)
    const [trivyBoxTop, setTrivyBoxTop] = useState(0)
    
    const [showMode, setShowMode] = useState('card')
    const [selectedAsset, setSelectedAsset] = useState()
    const [anchorMenu, setAnchorMenu] = useState<HTMLElement|null>(null)
    const [refresh, setRefresh] = useState(0)
    const [order, setOrder] = useState('scd')
    const [filterScore, setFilterScore] = useState<number>(0)
    const [maxScore, setMaxScore] = useState<number>(0)
    const [minScore, setMinScore] = useState<number>(0)

    useEffect(() => {
        if (!trivyObject.score?.known) return
        
        let min = Number.MAX_VALUE
        let max = Number.MIN_VALUE
        for (let asset of trivyObject.score.known) {
            let score = assetScore(asset, trivyObject)
            if (score<min) min=score
            if (score>max) max=score
        }
        setMinScore(min)
        setMaxScore(max)
        setFilterScore(min)
        orderBy(order)
    }, [trivyObject.score?.known])

    useEffect(() => {
        if (trivyBoxRef.current) setTrivyBoxTop(trivyBoxRef.current.getBoundingClientRect().top)
    }, [])

    const showDetails = (asset:any) => {
        return (
            <Dialog open={true}  sx={{height:'80%'}}>
                <DialogTitle>
                    {`${asset.namespace}/${asset.name}/${asset.container}`}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        <Stack direction='column'>
                            <Typography><b>Summary:</b> {`Critical: ${asset.report.summary.criticalCount}  High: ${asset.report.summary.highCount}  Medium: ${asset.report.summary.mediumCount}  Low: ${asset.report.summary.lowCount} (`}<b>KwirthScore:</b> {`${assetScore(asset, trivyObject).toFixed(2)}%)`}</Typography>
                            <Typography><b>Image:</b> {`${asset.report.registry.server}/${asset.report.artifact.repository}:${asset.report.artifact.tag}`}</Typography>
                            <Typography><b>OS:</b> {`${asset.report.os.family}/${asset.report.os.name}`}</Typography>
                            <Typography sx={{mt:0.5}}><b>Scanner:</b> {`${asset.report.scanner.name} ${asset.report.scanner.version}  (${asset.report.scanner.vendor})`}</Typography>
                            <Typography><b>Scan date:</b> {`${asset.report.updateTimestamp}`}</Typography>
                            <Stack sx={{mt:0.5}}>
                                {(asset.report.vulnerabilities as any[]).map(v => <TabContentTrivyVuln vuln={v}/>)}
                            </Stack>
                        </Stack>
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSelectedAsset(undefined)}>ok</Button>
                </DialogActions>
            </Dialog>
        )
    }

    const orderBy = (orderName:string) => {
        setAnchorMenu(null)

        let known = trivyObject.score.known as any[]
        switch(orderName) {
            case 'scd':
                known.sort((a,b) => new Date(b.report.updateTimestamp).getTime() - new Date(a.report.updateTimestamp).getTime())
                break
            case 'sca':
                known.sort((a,b) => new Date(a.report.updateTimestamp).getTime() - new Date(b.report.updateTimestamp).getTime())
                break
            case 'sd':
                known.sort((a,b) => assetScore(b, trivyObject) - assetScore(a, trivyObject))
                break
            case 'sa':
                known.sort((a,b) => assetScore(a, trivyObject) - assetScore(b, trivyObject))
                break

        }
        trivyObject.score.known = known
        setOrder(orderName)
        setRefresh(Math.random())
    }

    let orderMenu = (
        <Menu anchorEl={anchorMenu} open={Boolean(anchorMenu)} onClose={() => setAnchorMenu(null)}>
            <MenuList dense sx={{width:'150px'}}>
                <MenuItem key='sdd' onClick={() => orderBy('scd')}>{order==='scd'?<CheckIcon/>:<Box sx={{width:'26px'}}/>}Scan date desc</MenuItem>
                <MenuItem key='sda' onClick={() => orderBy('sca')}>{order==='sca'?<CheckIcon/>:<Box sx={{width:'26px'}}/>}Scan date asc</MenuItem>
                <MenuItem key='sd' onClick={() => orderBy('sd')}>{order==='sd'?<CheckIcon/>:<Box sx={{width:'26px'}}/>}Score desc</MenuItem>
                <MenuItem key='sa' onClick={() => orderBy('sa')}>{order==='sa'?<CheckIcon/>:<Box sx={{width:'26px'}}/>}Score asc</MenuItem>
            </MenuList>
        </Menu>
    )
    
    const handleFilter = (e:Event,v:number|number[]) => {
        setFilterScore(v as number)
    }

    return ( trivyObject.score?.score && <>
        <Stack direction={'row'} sx={{overflow:'hidden'}}>
            <Typography sx={{ml:2,mr:2}}><b>KwirthScore: </b>{(trivyObject.score?.score as number)?.toPrecision(4)}%</Typography>
            <Typography sx={{flex:1}}></Typography>
            <Typography>Filter score</Typography>
            <Slider max={maxScore} min={minScore} onChange={handleFilter} size='small' sx={{width:'10%', ml:2}}/>
            <Typography sx={{width:'5%', ml:2}}>{filterScore?.toFixed(0)}</Typography>
            <Button onClick={(event) => setAnchorMenu(event.currentTarget)}>Order</Button>
            <Button onClick={() => setShowMode('list')}>List</Button>
            <Button onClick={() => setShowMode('card')}>Card</Button>
        </Stack>

        <Box ref={trivyBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', width:'100%', flexGrow:1, height: `calc(100vh - ${trivyBoxTop}px - 25px)`}}>
            { showMode==='card' && trivyObject.score?.known && 
                <Grid container sx={{ml:1,mr:1}}>
                    {(trivyObject.score.known as any[]).filter(asset => assetScore(asset,trivyObject)>=filterScore).map( (asset,index) => {
                        return (
                            <Grid xs={12} sm={6} md={4} lg={3} key={index} sx={{margin:1}}>
                                <TabContentTrivyAsset asset={asset} trivyObject={trivyObject} onDetails={() => setSelectedAsset(asset)} view={'card'}/>
                            </Grid>
                        )
                    })}
                </Grid>
            }

            { showMode==='list' && 
                <Grid container sx={{ml:1,mr:1}}>
                    {(trivyObject.score.known as any[]).filter(asset => assetScore(asset,trivyObject)>=filterScore).map( (asset,index) => {
                        return (
                            <Grid key={index} sx={{margin:1, width:'100%'}}>
                                <TabContentTrivyAsset asset={asset} trivyObject={trivyObject} onDetails={() => setSelectedAsset(asset)} view='list'/>
                            </Grid>
                        )
                    })}
                </Grid>
            } 
        </Box>
        { selectedAsset!==undefined && showDetails(selectedAsset) }
        { anchorMenu && orderMenu }
    </>)
}
export { TabContentTrivy }