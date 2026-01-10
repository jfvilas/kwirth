import { LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'

const _ = require('lodash')

interface IDetailsItem {
    name: string
    text: string
    source: string[]
    format: 'string'|'stringlist'|'table'|'objectprops'|'objectlist'|'objectobject'|'boolean'|'booleankeyname'|'keylist'|'edit'|'bar'|'age'
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
    onLink: (kind:string, name:string) => void
}

function formatAgeCompact(duracion:{ days: number, hours: number, minutes: number }) {
    let partes = []

    // Días
    const days = Math.floor(duracion.days);
    if (days > 0) {
        partes.push(`${days}d`);
        duracion.days -= duracion.days
    }

    // Horas
    const hours = Math.floor(duracion.hours);
    if (hours > 0 || partes.length > 0) { // Incluir horas si hay días o si es la unidad principal
        partes.push(`${hours}h`);
        duracion.hours -= duracion.hours
    }

    // Minutos
    const minutes = Math.floor(duracion.minutes);
    if (minutes > 0 && partes.length < 2) { // Incluir minutos solo si no se han incluido ya 2 unidades (para formato compacto)
        partes.push(`${minutes}m`);
    }

    // Devolver la cadena (unir las dos primeras partes para mantener la compacidad)
    return partes.slice(0, 2).join('')
}    

const MagnifyObjectDetails: React.FC<IMagnifyObjectDetailsProps> = (props:IMagnifyObjectDetailsProps) => {

    const renderValue = (srcobj:any, src:string, format:string, style:string[], details?:IDetailsItem[], invoke?:(obj:any) => string[], itemx?:IDetailsItem) : JSX.Element => {
        if (src.startsWith('$')) return <Typography fontWeight={style.includes('bold')?'700':''}>{src.substring(1)}</Typography>
        let addLink = false
        if (src.startsWith('#')) {
            src=src.substring(1)
            addLink=true
        }

        let obj = JSON.parse(JSON.stringify(srcobj))
        if (src.includes('|') && src.includes(':')) {  
            // xxx|yyyy:clave 
            // merge los items de xxx y los de yyy que tengan el mismo valor de clave y deja el resultado en xxx
            let key = src.split(':')[1]
            let parts = src.split(':')[0].split('|')
            let keys = _.get(obj,parts[0]).map((o:any) => o[key])
            let result= []
            for (let kvalue of keys) {
                let a = _.get(obj,parts[0]).filter((x:any) => x[key]===kvalue)
                let b = _.get(obj,parts[1]).filter((x:any) => x[key]===kvalue)
                if (a.length===1 && b.length===1) {
                    let merge={ ...a[0], ...b[0]}
                    result.push(merge)
                }
            }
            _.set(obj, parts[0], result)
            //se cambia el src a xxx que es donde estan los datos mergeados
            src=parts[0]
        }

        let header = style && style.includes('header') && itemx?itemx.text+':\u00a0':''

        switch(format) {
            case 'age':
                let ts = Date.parse(_.get(obj,src))
                const ahora = new Date();
                let diffMs = ahora.getTime() - ts

                const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
                diffMs -= dias * (1000 * 60 * 60 * 24)

                const horas = Math.floor(diffMs / (1000 * 60 * 60))
                diffMs -= horas * (1000 * 60 * 60)

                const minutos = Math.floor(diffMs / (1000 * 60))

                const duracion = { days: dias, hours: horas, minutes: minutos }
                return <>{formatAgeCompact(duracion)}</>

            case 'boolean':
                let bvalue = false
                if (src==='#' && invoke)
                    bvalue = Boolean(invoke(obj)[0])
                else 
                    bvalue = _.get(obj,src)
                if (bvalue)
                    return <Typography sx={{color:'green'}}>OK</Typography>
                else
                    return <Typography sx={{color:'red'}}>ko</Typography>

            case 'string':
                let value = ''
                if (src==='#' && invoke)
                    value = invoke(obj)[0]
                else 
                    value = _.get(obj,src)

                if (style && style.includes('edit')) {
                    return <>{header}{renderValue(srcobj, src, 'edit', style, [], undefined)}</>
                }
                else {
                    let v = value
                    let fontWeightStyle = ''
                    let valueStyle:string[] = []
                    let jsxValue = <>{v}</>
                    if (style) {
                        let charLimit = style.find(s => s.startsWith('char:'))
                        if (charLimit) {
                            let limit = +charLimit.substring(5)
                            if (v.length>limit) jsxValue = <>{v.substring(0,limit)+'...'}</>
                        }

                        if (style.includes('bold')) fontWeightStyle = '700'

                        valueStyle = style.filter(s => s.startsWith(value+':'))

                        let linkStyle= style.find(s => s.startsWith('link:'))
                        if (linkStyle && addLink) {
                            let linkParts=linkStyle.split(':')
                            for (let i=1;i<=2;i++) {
                                if (!linkParts[i].startsWith('$')) 
                                    linkParts[i] = _.get(obj,linkParts[i])
                                else
                                    linkParts[i] = linkParts[i].substring(1)
                            }
                            jsxValue=<a href={`#/${linkParts[1]}/${v}`} onClick={() => props.onLink(linkParts[1],v)}>{v}</a>
                        }
                    }
                    if (valueStyle.length>0)
                        return <Typography color={valueStyle[0].split(':')[1]} fontWeight={fontWeightStyle}>{header}{jsxValue}</Typography>
                    else if (style) {
                        let propertyStyle = style.filter(s => s.startsWith('property:'))
                        if (propertyStyle.length>0) {
                            for (let ps of propertyStyle) {
                                let propertyParts = ps.split(':')
                                let propertyValue = _.get(obj,propertyParts[1])
                                if (propertyValue === propertyParts[2]) return <Typography color={propertyParts[3]} fontWeight={fontWeightStyle}>{header}{jsxValue}</Typography>
                            }
                        }
                    }
                    return <Typography fontWeight={fontWeightStyle}>{header}{jsxValue}</Typography>
                }

            case 'edit':
                return <TextField maxRows={5} name={src} defaultValue={_.get(obj,src)} fullWidth sx={{width:'100%', mt:1, mb:1}} multiline onChange={(e) => props.onChangeData(src,e.target.value)} size='small' variant={style.includes('edit')?'standard':'outlined'}/>

            case 'booleankey':
                if (_.get(obj,src)===true) return <>{src}</>
                return <></>

            case 'keylist':
                let keys = Object.keys(_.get(obj,src))
                return <>{renderValue({keys}, 'keys', 'stringlist',style,[], undefined)}</>

            case 'stringlist':
                let result2:string[]=[]
                if (src==='#' && invoke) {
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
                        return <Typography color={st2[0].split(':')[1]}>{header}{val}</Typography>
                    else
                        return <>{header}{val}</>
                }
                    

            case 'objectlist':
                let items:any[]=[]
                if (src==='#' && invoke) {
                    items = invoke(obj)
                }
                else {
                    items = _.get(obj,src)
                }
                if (!items) return <></>

                if (style.includes('table') && details) {
                    return <TableContainer component={Paper} elevation={0} sx={{border: '1px solid #e0e0e0', mt:1, mb:1}}>
                        <Table size='small' sx={{width:'100%'}}>
                            <TableHead>
                                <TableRow>
                                    {details.map((c:IDetailsItem) => <TableCell>{c.text}</TableCell>)}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                { items.map((row:any) => {
                                    return <TableRow>
                                        {details.map((key:IDetailsItem) => {
                                            let subcontent = details.find((c:IDetailsItem) => c.name===key.name)
                                            if (!subcontent || !details) return <></>
                                            return <TableCell> {
                                                typeof _.get(row,key.source[0]) === 'object'?
                                                    (Array.isArray(_.get(row,key.source[0]))? 
                                                        <>{renderValue(row,key.source[0],subcontent.format,key.style||[], subcontent.content, undefined)}</>
                                                        :
                                                        <>{renderValue(row,key.source[0],details.find((kx:IDetailsItem) => kx.source[0]===key.source[0])!.format, details.find((kx:IDetailsItem) => kx.source[0]===key.source[0])!.style||[],[subcontent], undefined)}</>
                                                    )
                                                    :
                                                    // <>{renderValue(row,key.source[0],subcontent.format,subcontent.style||[],[], undefined)}</>
                                                    <>{renderValues(row,key)}</>
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
                        if (!details) return <></>

                        return (
                            <Stack direction={style.includes('column')?'column':'row'}>
                                { style.includes('column')?
                                    details.map((c:IDetailsItem) => {
                                        return <>{renderValues(row, c)}</>
                                    })
                                    :
                                    details.map((c:IDetailsItem) => {
                                        return <>{renderValues(row, c)} <>{rowIndex<items.length-1?',\u00a0':''}</> </>
                                    }) 
                                }
                            </Stack>
                        )
                    })}</>
                }

            case 'objectobject':
                if (style.includes('table')) {
                    return <TableContainer component={Paper} elevation={0} sx={{border: '1px solid #e0e0e0', mt:1, mb:1}}>
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
                        if (!details) return <></>
                        return <>{details.map((c:IDetailsItem) => <>{renderItem(row, c, 25)}</>)}</>
                    })}</>
                }

            case 'objectprops':
                if (!_.get(obj,src)) return <></>
                if (style && style.includes('table')) {
                    return <TableContainer component={Paper} elevation={0} sx={{border: '1px solid #e0e0e0', mt:1, mb:1}}>
                        <Table size='small'>
                            <TableHead>
                                <TableRow>
                                    { Object.keys(_.get(obj,src)).map(k => <TableCell>{k}</TableCell>) }
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                { Object.keys(_.get(obj,src)).map(key => <TableCell>{_.get(obj,src+'.[\''+key+'\']')}</TableCell>) }
                            </TableBody>
                        </Table>
                    </TableContainer>
                }
                else {
                    if (details) {
                        // selected object properties
                        return <>{details.map( (c:IDetailsItem) => {
                            return <Stack direction={c.style && c.style.includes('column')?'column':'row'}>
                                <Typography fontWeight={style && style.includes('keybold')?'700':''}>{c.text}:&nbsp;</Typography>
                                {renderValues(obj,c)}
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
                if (!details) return <></>
                let result= _.get(obj,src) && <TableContainer component={Paper} elevation={0} sx={{border: '1px solid #e0e0e0', mt:1, mb:1}}>
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
                    {item.source.map(source => {
                        return renderValue(obj, source, item.format, item.style||[], item.content, item.invoke, item)
                    })}
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
