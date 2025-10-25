import { useEffect, useRef, useState } from 'react'
import { Box, Button, Grid, IconButton, Menu, MenuItem, MenuList, Slider, Stack, Typography } from '@mui/material'
import { TabContentTrivyAsset } from './TrivyTabContentAsset'
import { Check as CheckIcon } from '@mui/icons-material'
import { assetScore } from './TrivyCommon'
import { TabContentTrivyAssetDetails } from './TrivyTabContentAssetDetails'
import { IContentProps } from '../IChannel'
import { ITrivyInstanceConfig } from './TrivyConfig'
import { ITrivyData } from './TrivyData'
import { IKnown } from '@jfvilas/kwirth-common'
import { Error as ErrorIcon } from '@mui/icons-material'
import { MsgBoxOkError } from '../../tools/MsgBox'

// +++ add filters to trivy content: name, namespace...
// +++ ad info (number of vuln analysis)
// +++ add download report
// +++ add more sort options
// +++ add avatars for common containers plus kwirth (azure, aws...)
// +++ add scope validations per channel

const TrivyTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    let trivyObject:ITrivyData = props.channelObject.data
    let trivyInstanceConfig:ITrivyInstanceConfig = props.channelObject.instanceConfig
    const trivyBoxRef = useRef<HTMLDivElement | null>(null)
    const [trivyBoxTop, setTrivyBoxTop] = useState(0)
    
    const [showMode, setShowMode] = useState('card')
    const [selectedAsset, setSelectedAsset] = useState<IKnown>()
    const [anchorMenu, setAnchorMenu] = useState<HTMLElement|null>(null)
    const [refresh, setRefresh] = useState(0)
    const [order, setOrder] = useState('scd')
    const [filterScore, setFilterScore] = useState<number>(0)
    const [maxScore, setMaxScore] = useState<number>(0)
    const [minScore, setMinScore] = useState<number>(0)
    const [msgBox, setMsgBox] =useState(<></>)

    useEffect(() => {
        if (trivyObject.known.length>0) {
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
        }
    }, [trivyObject.known, trivyObject.score])

    useEffect(() => {
        if (trivyBoxRef.current) setTrivyBoxTop(trivyBoxRef.current.getBoundingClientRect().top)
    })

    const showDetails = (asset:IKnown) => {
        return <TabContentTrivyAssetDetails asset={asset} trivyInstanceConfig={trivyInstanceConfig} onClose={() => setSelectedAsset(undefined)}/>
    }

    const orderBy = (orderName:string) => {
        setAnchorMenu(null)

        let known = trivyObject.known as IKnown[]
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

    const removeAsset = (asset:IKnown) => {
        trivyObject.known = (trivyObject.known).filter(a => a.namespace!==asset.namespace || a.name!==asset.name || a.container!==asset.container)
        setRefresh(Math.random())
    }

    const showErrors = () => {
        let msg = trivyObject.unknown.reduce( (prev,current) => prev + `${current.namespace}/${current.name}/${current.container}: ${current.statusMessage}<br/>`, '')
        setMsgBox(MsgBoxOkError('Trivy', msg, setMsgBox))
    }

    return (
        <Box sx={{ ml:1, mr:1, display:'flex', flexDirection: 'column'}}>
            { trivyObject.started && <>
                <Stack direction={'row'} sx={{overflow:'hidden'}}>
                    <Typography sx={{ml:2,mr:2}}><b>KwirthScore: </b>{trivyObject.score.toPrecision(4)}%</Typography>
                    <Typography>Filter score</Typography>
                    <Slider max={maxScore} min={minScore} value={filterScore} onChange={handleFilter} size='small' sx={{width:'10%', ml:2}} disabled={trivyObject.known.length + trivyObject.unknown.length === 0}/>
                    <Typography sx={{width:'5%', ml:2}}>{filterScore?.toFixed(0)}</Typography>
                    <Typography sx={{flex:1}}></Typography>
                    <IconButton title="Some errors have been detected" onClick={showErrors} disabled={trivyObject.unknown.length === 0}>
                        <ErrorIcon style={{ color: trivyObject.unknown.length>0?'red':'#BDBDBD'}}/>
                    </IconButton>
                    <Button onClick={(event) => setAnchorMenu(event.currentTarget)}>Order</Button>
                    <Button onClick={() => setShowMode('list')}>List</Button>
                    <Button onClick={() => setShowMode('card')}>Card</Button>
                </Stack>

                <Box ref={trivyBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', width:'100%', flexGrow:1, height: `calc(100vh - ${trivyBoxTop}px - 25px)`}}>
                    { showMode==='card' && trivyObject.known && 
                        <Grid container sx={{ml:1,mr:1}}>
                            {(trivyObject.known).filter(asset => assetScore(asset,trivyInstanceConfig) >= filterScore).map( (asset,index) => {
                                return (
                                    <Box key={index} sx={{margin:1, width:'24%'}}>
                                        <TabContentTrivyAsset asset={asset} channelObject={props.channelObject} onDetails={() => setSelectedAsset(asset)} onDelete={() => removeAsset(asset)} view={'card'}/>
                                    </Box>
                                )
                            })}
                        </Grid>
                    }

                    { showMode==='list' && 
                        <Grid container sx={{ml:1,mr:1}}>
                            {(trivyObject.known).filter(asset => assetScore(asset,trivyInstanceConfig)>=filterScore).map( (asset,index) => {
                                return (
                                    <Grid key={index} sx={{margin:1, width:'100%'}}>
                                        <TabContentTrivyAsset asset={asset} channelObject={props.channelObject} onDetails={() => setSelectedAsset(asset)} onDelete={() => removeAsset(asset)} view='list'/>
                                    </Grid>
                                )
                            })}
                        </Grid>
                    } 
                </Box>
            </>}
            { anchorMenu && orderMenu }
            { selectedAsset!==undefined && showDetails(selectedAsset) }
            { msgBox }
        </Box>
    )
}
export { TrivyTabContent }