import { Button, DialogActions, Menu, MenuItem, Select, Stack, Switch, TextField, Typography } from '@mui/material';
import React, { useRef, useState, useEffect } from 'react';
import { objectClone } from '../Tools';

interface IFormSimpleProps {
    onApply: (values: any) => void;
    onClose: () => void;
    anchorParent: Element | null;
    model: any;
}

const FormSimple: React.FC<IFormSimpleProps> = (props: IFormSimpleProps) => {
    // Estado para forzar re-render cuando cambian valores en el useRef
    const [, setRefresh] = useState(0);
    // Clonamos el modelo para trabajar sobre una copia local
    const data = useRef<any>(objectClone(props.model));
    // Estado para almacenar los resultados de las funciones asíncronas
    const [asyncResults, setAsyncResults] = useState<{ [key: string]: any }>({});

    // Disparamos las acciones asíncronas solo una vez al cargar el componente
    useEffect(() => {
        Object.keys(data.current).forEach(key => {
            const item = data.current[key];
            // Si el ítem tiene una propiedad 'text' y el modelo original tiene una función 'action'
            if (item && typeof item === 'object' && item.text && typeof props.model[key]?.asyncAction) {
                props.model[key].asyncAction().then((result: any) => {
                    setAsyncResults(prev => ({ ...prev, [key]: result }));
                });
            }
        });
    }, []); // Array vacío para que solo se ejecute al montar

    const handleRefresh = () => setRefresh(prev => prev + 1);

    const apply = () => {
        props.onApply(objectClone(data.current));
    };

    return (
        <Menu 
            open={Boolean(props.anchorParent)} 
            anchorEl={props.anchorParent} 
            onClose={props.onClose}
        >
            <Stack direction={'column'} width={'320px'} p={2} spacing={1.5}>
                {Object.keys(data.current).map((key, index) => {
                    const value = data.current[key];

                    return (
                        <Stack key={index} direction={'row'} alignItems={'center'} justifyContent={'space-between'} spacing={2}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                                {key}:
                            </Typography>

                            {/* CASO: BOOLEAN -> SWITCH */}
                            {typeof value === 'boolean' && (
                                <Switch 
                                    checked={value} 
                                    onChange={(e) => { data.current[key] = e.target.checked; handleRefresh(); }} 
                                />
                            )}

                            {/* CASO: NUMBER -> TEXTFIELD */}
                            {typeof value === 'number' && (
                                <TextField 
                                    type="number"
                                    variant="standard"
                                    value={value}
                                    onChange={(e) => { data.current[key] = Number(e.target.value); handleRefresh(); }}
                                    slotProps={{ htmlInput: { style: { textAlign: 'right', width: '80px' } } }}
                                />
                            )}

                            {/* CASO: SELECT (Objeto con options y value) */}
                            {value && typeof value === 'object' && value.options && value.value !== undefined && (
                                <Select 
                                    variant="standard"
                                    value={value.value}
                                    onChange={(e) => { data.current[key].value = e.target.value; handleRefresh(); }}
                                    sx={{ minWidth: '100px' }}
                                >
                                    {value.options.map((opt: string, i: number) => (
                                        <MenuItem key={i} value={opt}>{opt}</MenuItem>
                                    ))}
                                </Select>
                            )}

                            {/* CASO: BOTÓN ACCIÓN */}
                            {value && typeof value === 'object' && value.button && (
                                <Button 
                                    variant="outlined" 
                                    size="small"
                                    onClick={() => props.model[key].action()}
                                >
                                    {value.button}
                                </Button>
                            )}

                            {/* CASO: TEXTO ASÍNCRONO (Muestra el resultado del useEffect) */}
                            {value && typeof value === 'object' && value.text && (
                                <Typography variant="body2" color="text.secondary">
                                    {asyncResults[key] !== undefined ? asyncResults[key] : '...'}
                                </Typography>
                            )}
                        </Stack>
                    );
                })}
            </Stack>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={props.onClose} color="inherit">Cancel</Button>
                <Button onClick={apply} variant="contained" color="primary">Apply</Button>
            </DialogActions>
        </Menu>
    );
};

export { FormSimple };







// import { Button, DialogActions, Menu, MenuItem, Select, Stack, Switch, TextField, Typography } from '@mui/material'
// import React, { useRef, useState } from 'react'
// import { objectClone } from '../Tools'

// interface IFormSimpleProps {
//     onApply: (values:any) => void
//     onClose: () => void
//     anchorParent: Element
//     model: any
// }

// const FormSimple: React.FC<IFormSimpleProps> = (props:IFormSimpleProps) => {
//     const [ , setRefresh ] = useState(0)
//     const data = useRef<any>(objectClone(props.model))

//     const apply = () => {
//         props.onApply(objectClone(data.current))
//     }

//     const AsyncText = ({ action }: { action: () => Promise<any> }) => {
//         const [value, setValue] = useState('...'); // Estado inicial mientras carga

//         React.useEffect(() => {
//             action().then(setValue);
//         }, [action]);

//         return <>{value}</>;
//     }

//     return (
//         <Menu open={true} anchorEl={props.anchorParent} onClose={props.onClose}>
//             <Stack direction={'column'} width={'300px'} p={2}>
//             {
//                 Object.keys(data.current).map( (key, index) => {
//                     return <Stack key={index} direction={'row'} alignItems={'center'} justifyContent={'space-between'}>
//                         <Typography>{key}</Typography>
//                         {
//                             ((typeof data.current[key]==='boolean') && 
//                                 <Switch onClick={() => { data.current[key] = !data.current[key]; setRefresh(Math.random())}} checked={data.current[key]}/>
//                             ) ||

//                             ((typeof data.current[key]==='number') && 
//                                 <TextField onChange={(event) => {data.current[key]=+event.target.value; setRefresh(Math.random())}} value={data.current[key].toString()} variant='standard' type={'number'} slotProps={{htmlInput: {style:{width:'120px', textAlign:'right'}}}} />
//                             ) ||

//                             ((typeof data.current[key]==='object' && (data.current[key] as any).options && (data.current[key] as any).value) && 
//                                 <Select value={(data.current[key] as any).value} onChange={(event) => {data.current[key].value=event.target.value; setRefresh(Math.random())}} variant='standard'>
//                                     { (data.current[key] as any).options.map((o: string, index:number) => <MenuItem key={index} value={o}>{o}</MenuItem>) }
//                                 </Select>
//                             ) ||

//                             ((typeof data.current[key]==='object' && data.current[key].button) && 
//                                 <Button onClick={() => props.model[key].action()}>
//                                     {data.current[key].button}
//                                 </Button>
//                             ) ||

//                             ((typeof data.current[key]==='object' && data.current[key].text && props.model[key].asyncAction) && 
//                                 <Typography>
//                                     <AsyncText action={() => props.model[key].asyncAction()} />
//                                 </Typography>
//                             )
//                         }
//                     </Stack>
//                 })
//             }
//             </Stack>
//             <DialogActions>
//                 <Button onClick={apply}>Apply</Button>
//                 <Button onClick={props.onClose}>Cancel</Button>
//             </DialogActions>
//         </Menu>
//     )
// }

// export { FormSimple }