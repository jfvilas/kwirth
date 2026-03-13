import { useEffect, useRef, useState } from 'react'
import { Box, Button, Grid, IconButton, Menu, MenuItem, MenuList, Slider, Stack, Typography } from '@mui/material'
import { Check as CheckIcon } from '@mui/icons-material'
import { assetScore, TReportType } from './TrivyCommon'
import { IContentProps } from '../IChannel'
import { ITrivyInstanceConfig } from './TrivyConfig'
import { IAsset, ITrivyData } from './TrivyData'
import { Error as ErrorIcon } from '@mui/icons-material'
import { MsgBoxOkError } from '../../tools/MsgBox'
import { TrivyTabContentAssetDetails } from './TrivyTabContentAssetDetails'
import { TrivyTabContentAsset } from './TrivyTabContentAsset'

// +++ add filters to trivy content: name, namespace...
// +++ add info (number of vuln analysis)
// +++ add download report
// +++ add more sort options
// +++ add avatars for common containers plus kwirth (azure, aws...)
// +++ add scope validations per channel

// +++ back: si se desinstala trivy, parar los informers (todo el channel)

const TrivyTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    let trivyData:ITrivyData = props.channelObject.data
    let trivyInstanceConfig:ITrivyInstanceConfig = props.channelObject.instanceConfig
    const trivyBoxRef = useRef<HTMLDivElement | null>(null)
    const [trivyBoxTop, setTrivyBoxTop] = useState(0)
    
    const [showMode, setShowMode] = useState('card')
    const [selectedType, setSelectedType] = useState<TReportType>('vulnerabilityreports')
    const [selectedAsset, setSelectedAsset] = useState<IAsset>()
    const [anchorMenu, setAnchorMenu] = useState<HTMLElement|null>(null)
    const [order, setOrder] = useState('scd')
    const [filterScore, setFilterScore] = useState<number>(0)
    const [maxScore, setMaxScore] = useState<number>(0)
    const [minScore, setMinScore] = useState<number>(0)
    const [msgBox, setMsgBox] =useState(<></>)

    useEffect(() => {
        if (trivyData.assets.length>0) {
            let min = Number.MAX_VALUE
            let max = Number.MIN_VALUE
            for (let asset of trivyData.assets) {
                let score = assetScore(asset, trivyInstanceConfig, 'vulnerabilityreports')
                if (score<min) min=score
                if (score>max) max=score
            }
            setMinScore(min)
            setMaxScore(max)
            setFilterScore(min)
            orderBy(order)
        }
    }, [trivyData.assets, trivyData.score])

    useEffect(() => {
        if (trivyBoxRef.current) setTrivyBoxTop(trivyBoxRef.current.getBoundingClientRect().top)
    })

    const showDetails = (asset:IAsset, type:TReportType) => {
        return <TrivyTabContentAssetDetails asset={asset} trivyInstanceConfig={trivyInstanceConfig} onClose={() => setSelectedAsset(undefined)} detail={type}/>
    }

    const orderBy = (orderName:string) => {
        setAnchorMenu(null)

        let assets = trivyData.assets
        switch(orderName) {
            case 'scd':
                assets.sort((a,b) => new Date(b.vulnerabilityreports.report?.updateTimestamp).getTime() - new Date(a.vulnerabilityreports.report?.updateTimestamp).getTime())
                break
            case 'sca':
                assets.sort((a,b) => new Date(a.vulnerabilityreports.report?.updateTimestamp).getTime() - new Date(b.vulnerabilityreports.report?.updateTimestamp).getTime())
                break
            case 'sd':
                assets.sort((a,b) => assetScore(b, trivyInstanceConfig, 'vulnerabilityreports') - assetScore(a, trivyInstanceConfig, 'vulnerabilityreports'))
                break
            case 'sa':
                assets.sort((a,b) => assetScore(a, trivyInstanceConfig, 'vulnerabilityreports') - assetScore(b, trivyInstanceConfig, 'vulnerabilityreports'))
                break

        }
        //trivyData.assets = assets
        setOrder(orderName)
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

    const rescanAsset = (asset:IAsset) => {
        trivyData.assets = (trivyData.assets).filter(a => a.namespace!==asset.namespace || a.name!==asset.name || a.container!==asset.container)
    }

    const showErrors = () => {
        let msg = trivyData.assets.reduce( (prev,current) => prev + `${current.namespace}/${current.name}/${current.container}: ${current.unknown.statusMessage}<br/>`, '')
        setMsgBox(MsgBoxOkError('Trivy', msg, setMsgBox))
    }

    return (
        <Box sx={{ ml:1, mr:1, display:'flex', flexDirection: 'column'}}>
            { trivyData.started && <>
                <Stack direction={'row'} sx={{overflow:'hidden'}}>
                    <Typography sx={{ml:2,mr:2}}><b>KwirthScore: </b>{trivyData.score?.toPrecision(4)}%</Typography>
                    <Typography>Filter score</Typography>
                    <Slider max={maxScore} min={minScore} value={filterScore} onChange={handleFilter} size='small' sx={{width:'10%', ml:2}}/>
                    <Typography sx={{width:'5%', ml:2}}>{filterScore?.toFixed(0)}</Typography>
                    <Typography sx={{flex:1}}></Typography>
                    <IconButton title="Some errors have been detected" onClick={showErrors}>
                        <ErrorIcon style={{ color: trivyData.assets.length>0?'red':'#BDBDBD'}}/>
                    </IconButton>
                    <Button onClick={(event) => setAnchorMenu(event.currentTarget)}>Order</Button>
                    <Button onClick={() => setShowMode('list')}>List</Button>
                    <Button onClick={() => setShowMode('card')}>Card</Button>
                </Stack>

                <Box ref={trivyBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', width:'100%', flexGrow:1, height: `calc(100vh - ${trivyBoxTop}px - 25px)`}}>
                    { showMode==='card' && trivyData.assets && 
                        <Grid container sx={{ml:1,mr:1}}>
                            {trivyData.assets.map( (asset,index) => {
                                return (
                                    <Box key={index} sx={{margin:1, width:'24%'}}>
                                        <TrivyTabContentAsset asset={asset} channelObject={props.channelObject} onVulns={() => {setSelectedAsset(asset); setSelectedType('vulnerabilityreports')}} onAudit={() => {setSelectedAsset(asset); setSelectedType('configauditreports')}} onRescan={() => rescanAsset(asset)} view={'card'}/>
                                    </Box>
                                )
                            })}
                        </Grid>
                    }

                    { showMode==='list' && 
                        <Grid container sx={{ml:1,mr:1}}>
                            {trivyData.assets.filter(asset => assetScore(asset,trivyInstanceConfig, 'vulnerabilityreports')>=filterScore).map( (asset,index) => {
                                return (
                                    <Grid key={index} sx={{margin:1, width:'100%'}}>
                                        <TrivyTabContentAsset asset={asset} channelObject={props.channelObject} onVulns={() => { setSelectedAsset(asset); setSelectedType('vulnerabilityreports')}} onRescan={() => rescanAsset(asset)} onAudit={() => { setSelectedAsset(asset); setSelectedType('configauditreports')}} view='list'/>
                                    </Grid>
                                )
                            })}
                        </Grid>
                    } 
                </Box>
            </>}
            { anchorMenu && orderMenu }
            { selectedAsset!==undefined && showDetails(selectedAsset, selectedType) }
            { msgBox }
        </Box>
    )
}
export { TrivyTabContent }