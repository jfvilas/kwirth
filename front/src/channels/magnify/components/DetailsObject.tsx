import { LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
const _ = require('lodash')

interface IDetailsItem {
    name: string
    text: string
    source: string[]
    format: 'string'|'stringlist'|'table'|'objectprops'|'objectlist'|'objectobject'|'booleankeyname'|'keylist'|'edit'|'bar'
    invoke?: (a:any) => any
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

    const renderValue = (srcobj:any, src:string, format:string, style:string[], details:any, invoke:any) : JSX.Element => {
        if (src.startsWith('$')) return <Typography fontWeight={style.includes('bold')?'700':''}>{src.substring(1)}</Typography>

        let obj = JSON.parse(JSON.stringify(srcobj))
        if (src.includes('|') && src.includes(':')) {  
            // xxx|yyyy:clave 
            // merge los items de xxx y los de yyy que tengan el mismo valor de clave y deja el resultado en xxx
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
                let value = ''
                if (src==='#')
                    value = invoke(obj)
                else 
                    value = _.get(obj,src)

                if (style.includes('edit')) {
                    return renderValue(srcobj, src, 'edit', style, [], undefined)
                }
                else {
                    let v = value
                    let charLimit = style.find(s => s.startsWith('char'))
                    if (charLimit) {
                        let limit = +charLimit.substring(4)
                        if (v.length>limit) v = v.substring(0,limit)+'...'
                    }
                    let st = style.filter(s => s.startsWith(value+':'))
                    if (st.length>0)
                        return <Typography color={st[0].split(':')[1]} fontWeight={style.includes('bold')?'700':''}>{ v }</Typography>
                    else
                        return <>{ v }</>
                }

            case 'edit':
                return <TextField maxRows={5} name={src} defaultValue={_.get(obj,src)} fullWidth sx={{width:'100%'}} multiline onChange={(e) => props.onChangeData(src,e.target.value)} size='small' variant={style.includes('edit')?'standard':'outlined'}/>

            case 'booleankey':
                if (_.get(obj,src)===true) return <>{src}</>
                return <></>

            case 'keylist':
                let keys = Object.keys(_.get(obj,src))
                return <>{renderValue({keys}, 'keys', 'stringlist',style,[], undefined)}</>

            case 'stringlist':
                let result2:string[]=[]
                if (src==='#') {
                    result2 = invoke(obj)
                }
                else
                    result2=_.get(obj,src)
                if (!result2) return <></>
                if (style.includes('column')) {
                    return <Stack direction={'column'}>
                        { result2.map((item:any, index:number) => <Typography>{renderValue(result2, '['+index+']', 'string', style, undefined, undefined)}</Typography>) }
                    </Stack>
                }
                else {
                    let val = result2.join(',')
                    let st2 = style.filter(s => s.startsWith(val+':'))
                    if (st2.length>0)
                        return <Typography color={st2[0].split(':')[1]}>{ val }</Typography>
                    else
                        return <>{ val }</>
                }
                    

            case 'objectlist':
                let items:any[]=[]
                if (src==='#') {
                    items = invoke(obj)
                }
                else {
                    items = _.get(obj,src)
                }
                if (!items) return <></>
                console.log('itemssrc')
                console.log(items)
                console.log(src)

                if (style.includes('table')) {
                    return <TableContainer component={Paper} elevation={0} sx={{border: '1px solid #e0e0e0', mt:1}}>
                        <Table size='small' sx={{width:'100%'}}>
                            <TableHead>
                                <TableRow>
                                    {details.map((c:any) => <TableCell>{c.name}</TableCell>)}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                { items.map((row:any) => {
                                    return <TableRow>
                                        {details.map((key:any) => {
                                            let subcontent = details.find((c:any) => c.name===key.name)
                                            console.log('rowkeyname')
                                            console.log(row)
                                            console.log(key.name)
                                            return <TableCell> {
                                                typeof _.get(row,key.source[0]) === 'object'?
                                                    (Array.isArray(_.get(row,key.source[0]))? 
                                                        <>{renderValue(row,key.source[0],'stringlist',key.style||[], [], undefined)}</>
                                                        :
                                                        renderValue(row,key.source[0],details.find((kx:any) => kx.source[0]===key.source[0]).format,[],subcontent, undefined)
                                                    )
                                                    :
                                                    <>{renderValue(row,key.source[0],'string',[],[], undefined)}</>
                                            }</TableCell>})
                                        }
                                    </TableRow>
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                }
                else {
                    return  <>{items.map((row:any, rowIndex:number) => {
                        return (
                            <Stack direction={'row'}>
                                { style.includes('column')?
                                    details.map((c:IDetailsItem) => <>{renderValues(row, c)}</>)
                                    :
                                    details.map((c:IDetailsItem) => <>{renderValues(row, c)} <>{rowIndex<items.length-1?',\u00a0':''}</> </>) 
                                }
                            </Stack>
                        )
                    })}</>
                }

            case 'objectobject':
                if (style.includes('table')) {
                    return <TableContainer component={Paper} elevation={0} sx={{border: '1px solid #e0e0e0', mt:1}}>
                        <Table size='small'>
                            <TableHead>
                                <TableRow>
                                    {Object.keys(_.get(obj,src)[0]).map(k => <TableCell>{k}</TableCell>)}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                            { _.get(obj,src).map((row:any) => {
                                return <TableRow>
                                    {Object.keys(_.get(obj,src)[0]).map(key => <TableCell>{renderValue(row,src,'string',[],[], undefined)}</TableCell>)}
                                </TableRow>
                            })}

                            </TableBody>
                        </Table>
                    </TableContainer>
                }
                else {
                    return  <>{_.get(obj,src).map((row:any) => {
                        return <>{details.map((c:IDetailsItem) => <>{renderItem(row, c, 25)}</>)}</>
                    })}</>
                }
            case 'objectprops':
                if (!_.get(obj,src)) return <></>
                if (style.includes('table')) {
                    console.log('table')
                    return <TableContainer component={Paper} elevation={0} sx={{border: '1px solid #e0e0e0', mt:1}}>
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
                    // return <>{Object.keys(_.get(obj,src)).map(key => {
                    //     return <Stack direction={'row'}>
                    //         <Typography fontWeight={style.includes('keybold')?'700':''}>{key}:&nbsp;</Typography>
                    //         {renderValue(obj, src+'.[\''+key+'\']', style.includes('edit')?'edit':'string', style, [], undefined)}
                    //     </Stack>
                    // })}</>
                    if (details && details.content) {
                        console.log('details')
                        console.log(details)
                        // selected object properties
                        return <>{details.content.map( (c:IDetailsItem) => {
                            console.log('---------onecontent----------')
                            console.log(obj)
                            console.log(src+'.[\''+c.source[0]+'\']')
                            console.log(details.format)
                            let subcontent = details.content.find((cx:any) => cx.source[0]===c.source[0])
                            console.log(subcontent)
                            let newformat='string'
                            if (typeof _.get(obj, src+'.[\''+c.source[0]+'\']')==='object') newformat='objectprops'
                            console.log ('newformat', newformat)
                            console.log('**********onecontent********')
                            return <Stack direction={details.style && details.style.includes('column')?'column':'row'}>
                                <Typography fontWeight={style.includes('keybold')?'700':''}>{c.text}:&nbsp;</Typography>
                                {/* {renderValue(obj, src+'.[\''+c.name+'\']', style.includes('edit')?'edit':'string', style, [], undefined)} */}
                                {renderValue(obj, src+'.[\''+c.source[0]+'\']', style.includes('edit')?'edit':newformat, style, subcontent, undefined)}
                            </Stack>
                        })}</>
                    }
                    else {
                        // all object properties
                        return <>{Object.keys(_.get(obj,src)).map(key => {
                            return <Stack direction={'row'}>
                                <Typography fontWeight={style.includes('keybold')?'700':''}>{key}:&nbsp;</Typography>
                                {renderValue(obj, src+'.[\''+key+'\']', style.includes('edit')?'edit':'string', style, [], undefined)}
                            </Stack>
                        })}</>
                    }
                }

            case 'table':
                let result= _.get(obj,src) && <TableContainer component={Paper} elevation={0} sx={{border: '1px solid #e0e0e0', mt:1}}>
                    <Table size='small'>
                        <TableHead>
                            <TableRow>
                                {details.map ((c:IDetailsItem) => <TableCell>{c.text}</TableCell>)}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            { _.get(obj,src).map((row:any) => {
                                return <TableRow>
                                    {details.map((c:IDetailsItem) => <TableCell>{renderValues(row, c)}</TableCell>)}
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
        if (item.format==='bar') {
            let value = _.get(obj,item.source[0])
            let max = _.get(obj,item.source[1])
            if (!value || !max) return <></>

            let progreso=+value/+max*100
            return <Stack direction={'row'} width={'100%'} alignItems={'center'}>
                <LinearProgress variant="determinate" value={progreso > 100 ? 100 : progreso} sx={{width:'90%'}} />
                    &nbsp;
                <Typography>{value? value: 0}/{max? max:0}</Typography>
            </Stack>
        }
        else {
            return (
                <Stack direction={item.style?.includes('column')?'column':'row'} width={'100%'}>
                    {item.source.map(source => renderValue(obj, source, item.format, item.style||[], item.content, item.invoke))}
                </Stack>
            )
        }
    }

    const renderItem = (obj:any, item:IDetailsItem, width:number) => {
        if (item.style?.includes('ifpresent') && !_.get(obj,item.source[0])) return <></>

        return (
            <Stack direction={'row'} alignItems={'baseline'}>
                {item.text==='' && <>
                    <Typography width={`${100}%`} sx={{fontWeight:item.style?.includes('bold')?'700':''}}>
                        {renderValues(obj, item)}
                    </Typography>
                </>}
                {item.text!=='' && <>
                    <Typography width={`${width}%`}>{item.text}</Typography>
                    {renderValues(obj, item)}
                </>}
            </Stack>
        )
    }

    const renderSection = (obj:any, section:IDetailsSection) => {
        return <>
            <Typography fontSize={18} sx={{mt:2, mb:1}}><b>{section.text}</b></Typography>
            {section.items.map(item => renderItem(obj, item, 15))}
        </>
    }


    if (props.sections)
        return <>{ props.sections.map((section:IDetailsSection) => renderSection(props.object.data.origin, section)) }</>
    else
        return <><pre>{JSON.stringify(props.object.data.origin,undefined, 2)}</pre></>
}

export type { IMagnifyObjectDetailsProps, IDetailsSection, IDetailsItem }
export { MagnifyObjectDetails }
