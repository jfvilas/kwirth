import { useEffect, useRef, useState } from 'react'
import { Box, Button, Grid, Menu, MenuItem, MenuList, Slider, Stack, Typography } from '@mui/material'
import { TabContentTrivyAsset } from './TrivyTabContentAsset'
import { Check as CheckIcon } from '@mui/icons-material'
import { assetScore } from './TrivyCommon'
import { TabContentTrivyAssetDetails } from './TrivyTabContentAssetDetails'
import { IContentProps } from '../IChannel'
import { ITrivyInstanceConfig } from './TrivyConfig'
import { ITrivyObject } from './TrivyObject'

const TrivyTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    let trivyObject:ITrivyObject = props.channelObject.uiData
    let trivyInstanceConfig:ITrivyInstanceConfig = props.channelObject.instanceConfig
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

    console.log('refreshscore', trivyObject.score)
    useEffect(() => {
        let min = Number.MAX_VALUE
        let max = Number.MIN_VALUE
        for (let asset of trivyObject.known) {
            let score = assetScore(asset, trivyInstanceConfig)
            if (score<min) min=score
            if (score>max) max=score
        }
        setMinScore(min)
        setMaxScore(max)
        setFilterScore(min)
        orderBy(order)
    }, [trivyObject.known, trivyObject.score])

    useEffect(() => {
        if (trivyBoxRef.current) setTrivyBoxTop(trivyBoxRef.current.getBoundingClientRect().top)
    })

    const showDetails = (asset:any) => {
        return <TabContentTrivyAssetDetails asset={asset} trivyInstanceConfig={trivyInstanceConfig} onClose={() => setSelectedAsset(undefined)}/>
    }

    const orderBy = (orderName:string) => {
        setAnchorMenu(null)

        let known = trivyObject.known as any[]
        switch(orderName) {
            case 'scd':
                known.sort((a,b) => new Date(b.report.updateTimestamp).getTime() - new Date(a.report.updateTimestamp).getTime())
                break
            case 'sca':
                known.sort((a,b) => new Date(a.report.updateTimestamp).getTime() - new Date(b.report.updateTimestamp).getTime())
                break
            case 'sd':
                known.sort((a,b) => assetScore(b, trivyInstanceConfig) - assetScore(a, trivyInstanceConfig))
                break
            case 'sa':
                known.sort((a,b) => assetScore(a, trivyInstanceConfig) - assetScore(b, trivyInstanceConfig))
                break

        }
        trivyObject.known = known
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

    const removeAsset = (asset:any) => {
        trivyObject.known = (trivyObject.known as any[]).filter(a => a.namespace!==asset.namespace || a.name!==asset.name || a.container!==asset.container)
        setRefresh(Math.random())
    }

    console.log('trivyObject.known',trivyObject.known)
    return (
        <Box sx={{ ml:1, mr:1, display:'flex', flexDirection: 'column'}}>
            <Stack direction={'row'} sx={{overflow:'hidden'}}>
                <Typography sx={{ml:2,mr:2}}><b>KwirthScore: </b>{trivyObject.score.toPrecision(4)}%</Typography>
                <Typography sx={{flex:1}}></Typography>
                <Typography>Filter score</Typography>
                <Slider max={maxScore} min={minScore} value={filterScore} onChange={handleFilter} size='small' sx={{width:'10%', ml:2}}/>
                <Typography sx={{width:'5%', ml:2}}>{filterScore?.toFixed(0)}</Typography>
                <Button onClick={(event) => setAnchorMenu(event.currentTarget)}>Order</Button>
                <Button onClick={() => setShowMode('list')}>List</Button>
                <Button onClick={() => setShowMode('card')}>Card</Button>
            </Stack>

            <Box ref={trivyBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', width:'100%', flexGrow:1, height: `calc(100vh - ${trivyBoxTop}px - 25px)`}}>
                { showMode==='card' && trivyObject.known && 
                    <Grid container sx={{ml:1,mr:1}}>
                        {(trivyObject.known as any[]).filter(asset => assetScore(asset,trivyInstanceConfig)>=filterScore).map( (asset,index) => {
                            return (
                                <Grid xs={12} sm={6} md={4} lg={3} key={index} sx={{margin:1}}>
                                    <TabContentTrivyAsset asset={asset} channelObject={props.channelObject} onDetails={() => setSelectedAsset(asset)} onDelete={() => removeAsset(asset)} view={'card'} webSocket={props.webSocket!}/>
                                </Grid>
                            )
                        })}
                    </Grid>
                }

                { showMode==='list' && 
                    <Grid container sx={{ml:1,mr:1}}>
                        {(trivyObject.known as any[]).filter(asset => assetScore(asset,trivyInstanceConfig)>=filterScore).map( (asset,index) => {
                            return (
                                <Grid key={index} sx={{margin:1, width:'100%'}}>
                                    <TabContentTrivyAsset asset={asset} channelObject={props.channelObject} onDetails={() => setSelectedAsset(asset)} onDelete={() => removeAsset(asset)} view='list' webSocket={props.webSocket!}/>
                                </Grid>
                            )
                        })}
                    </Grid>
                } 
            </Box>
            { anchorMenu && orderMenu }
            { selectedAsset!==undefined && showDetails(selectedAsset) }
        </Box>
    )
}
export { TrivyTabContent }