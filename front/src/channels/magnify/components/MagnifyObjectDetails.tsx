import { Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
const _ = require('lodash')

interface IDetailsItem {
    name: string
    text: string
    source: string[]
    format: 'string'|'stringlist'|'table'|'objectprops'|'objectlist'|'objectobject'|'booleankeyname'|'keylist'|'edit'
    style?: string[]
    content?: IDetailsItem[]
}

interface IDetailsSection {
    name: string
    text: string
    items: IDetailsItem[]
}

interface IMagnifyObjectDetailsProps {
    sections: IDetailsSection[]
    object: any
    onChangeData: (src:string,data:any) => void
}

const MagnifyObjectDetails: React.FC<IMagnifyObjectDetailsProps> = (props:IMagnifyObjectDetailsProps) => {

    const renderValue = (srcobj:any, src:string, format:string, style:string[], content:any) : JSX.Element => {
        if (src.startsWith('$')) return <Typography fontWeight={style.includes('bold')?'700':''}>{src.substring(1)}</Typography>

        let obj = JSON.parse(JSON.stringify(srcobj))
        if (src.includes('|') && src.includes(':')) {  
            // xxx|yyyy:clave 
            // merge los items de xxx y los de yyy que tengana e mismo cvalor de clave y deja el resultado en xxx
            let key = src.split(':')[1]
            let parts = src.split(':')[0].split('|')
            let keys = _.get(obj,parts[0]).map((o:any) => o[key])
            let result= []
            for (let kvalue of keys) {
                let a= _.get(obj,parts[0]).filter((x:any) => x[key]===kvalue)
                let b= _.get(obj,parts[1]).filter((x:any) => x[key]===kvalue)
                if (a.length===1 && b.length===1) {
                    let merge={ ...a[0], ...b[0]}
                    result.push(merge)
                }
            }
            _.set(obj, parts[0], result)
            //se cambia el src a xxx que es donde estan los datos mergeados
            src=parts[0]
        }

        switch(format) {
            case 'string':
                let value = _.get(obj,src)
                if (style.includes('edit')) {
                    return <>{renderValue(srcobj, src, 'edit', style, [])}</>
                }
                else {
                    let st = style.filter(s => s.startsWith(value+':'))
                    if (st.length>0)
                        return <Typography color={st[0].split(':')[1]} fontWeight={style.includes('bold')?'700':''}>{ value }</Typography>
                    else
                        return <>{ value }</>
                }

            case 'edit':
                return <TextField maxRows={5} name={src} defaultValue={_.get(obj,src)} fullWidth sx={{width:'100%'}} multiline onChange={(e) => props.onChangeData(src,e.target.value)} size='small' variant={style.includes('editline')?'standard':'outlined'}/>

            case 'booleankey':
                if (_.get(obj,src)===true) return <>{src}</>
                return <></>

            case 'keylist':
                let keys = Object.keys(_.get(obj,src))
                return <>{renderValue({keys}, 'keys', 'stringlist',style,[])}</>

            case 'stringlist':
                if (!_.get(obj,src)) return <></>
                if (style.includes('column')) {
                    return <Stack direction={'column'}>
                        { _.get(obj,src).map((item:any, index:number) => <Typography>{renderValue(obj, src+'['+index+']', 'string', style, undefined)}</Typography>) }
                    </Stack>
                }
                else {
                    let val = _.get(obj,src).join(',')
                    let st2 = style.filter(s => s.startsWith(val+':'))
                    if (st2.length>0)
                        return <Typography color={st2[0].split(':')[1]}>{ val }</Typography>
                    else
                        return <>{ val }</>
                }
                    

            case 'objectlist':
                if (!_.get(obj,src)) return <></>
                console.log('_.get(obj,src)', src)
                console.log(_.get(obj,src))
                return  <>{_.get(obj,src).map((row:any) => {
                    return <Stack direction={'row'}>{content.map((c:IDetailsItem) => <>{renderValues(row, c)}<>{style.includes('column')?'':',\u00a0'}</></>)}</Stack>
                })}</>

            case 'objectobject':
                if (style.includes('table')) {
                    console.log('src,obj')
                    console.log(src,obj)
                    return <TableContainer component={Paper} elevation={0} sx={{border: '1px solid #e0e0e0'}}>
                        <Table size='small'>
                            <TableHead>
                                <TableRow>
                                    {Object.keys(_.get(obj,src)[0]).map(k => <TableCell>{k}</TableCell>)}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                            { _.get(obj,src).map((row:any) => {
                                console.log('***********************************************')
                                console.log(row)
                                console.log(src)
                                console.log(content)
                                return <TableRow>
                                    {Object.keys(_.get(obj,src)[0]).map(key => <TableCell>{renderValue(row,src,'string',[],[])}</TableCell>)}
                                </TableRow>
                            })}

                            </TableBody>
                        </Table>
                    </TableContainer>
                }
                else {
                    return  <>{_.get(obj,src).map((row:any) => {
                        return <>{content.map((c:IDetailsItem) => <>{renderItem(row, c, 25)}</>)}</>
                    })}</>
                }
            case 'objectprops':
                if (!_.get(obj,src)) return <></>
                if (style.includes('table')) {
                    return <TableContainer component={Paper} elevation={0} sx={{border: '1px solid #e0e0e0'}}>
                        <Table size='small'>
                            <TableHead>
                                <TableRow>
                                    {Object.keys(_.get(obj,src)).map(k => <TableCell>{k}</TableCell>)}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                { 
                                    Object.keys(_.get(obj,src)).map(key => <TableCell>{_.get(obj,src+'.[\''+key+'\']')}</TableCell>)
                                }
                            </TableBody>
                        </Table>
                    </TableContainer>
                }
                else {
                    return <>{Object.keys(_.get(obj,src)).map(key => {
                        return <Stack direction={'row'}><Typography fontWeight={style.includes('keybold')?'700':''}>{key}:</Typography>{renderValue(obj,src+'.[\''+key+'\']',style.includes('edit')?'edit':'string',style,[])}</Stack>
                    })}</>
                }

            case 'table':
                let result= _.get(obj,src) && <TableContainer component={Paper} elevation={0} sx={{border: '1px solid #e0e0e0'}}>
                    <Table size='small'>
                        <TableHead>
                            <TableRow>
                                {content.map ((c:IDetailsItem) => <TableCell>{c.text}</TableCell>)}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            { _.get(obj,src).map((row:any) => {
                                return <TableRow>
                                    {content.map((c:IDetailsItem) => <TableCell>{renderValues(row, c)}</TableCell>)}
                                </TableRow>
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
                return result

            default:
                return <></>
        }
    }

    const renderValues = (obj:any, item:IDetailsItem) => {
        return (
            <Stack direction={item.style?.includes('column')?'column':'row'}>
                {item.source.map(source => renderValue(obj, source, item.format, item.style||[], item.content))}
            </Stack>
        )
    }

    const renderItem = (obj:any, item:IDetailsItem, width:number) => {
        return <>
            <Stack direction={'row'} >
                {item.text==='' && <>
                    <Typography width={`${width}%`} sx={{fontWeight:item.style?.includes('bold')?'700':''}}>{renderValues(obj, item)}</Typography>
                </>}
                {item.text!=='' && <>
                    <Typography width={`${width}%`}>{item.text}</Typography>
                    <Typography width={'100%'}>{renderValues(obj, item)}</Typography>
                </>}
            </Stack>
        </>
    }

    const renderSection = (obj:any, section:IDetailsSection) => {
        return <>
            <Typography fontSize={18} sx={{mt:2, mb:1}}><b>{section.text}</b></Typography>
            {section.items.map(item => renderItem(obj, item, 15))}
        </>
    }


    return <>{
        props.sections.map((section:IDetailsSection, index) => renderSection(props.object.data.origin, section))
    }</>
}

export type { IMagnifyObjectDetailsProps, IDetailsSection, IDetailsItem }
export { MagnifyObjectDetails }
