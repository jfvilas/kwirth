// import React, { useState, ChangeEvent } from 'react'
// import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Stack, TextField } from '@mui/material'

// interface IProps {
//     onClose:(regexInfo:string[], regexWarning:string[], regexError:string[]) => {}
//     regexInfo: string[]
//     regexWarning: string[]
//     regexError: string[]
// }

// const AlarmSetup: React.FC<any> = (props:IProps) => {
//     const [info, setInfo] = useState('')
//     const [warning, setWarning] = useState('')
//     const [error, setError] = useState('')
//     const [regexInfo, setRegexInfo] = useState(props.regexInfo)
//     const [regexWarning, setRegexWarning] = useState(props.regexWarning)
//     const [regexError, setRegexError] = useState(props.regexError)

//     const onChangeRegexInfo = (event:ChangeEvent<HTMLInputElement>) => {
//         setInfo(event.target.value)
//     }
//     const addInfo = () => {
//         if (info!=='') {
//             setRegexInfo([...regexInfo,info])
//             setInfo('')
//         }
//     }
//     const deleteChipInfo = (e:string) => {
//         setRegexInfo(regexInfo.filter(ri => ri!==e))
//     }

//     const onChangeRegexWarning = (event:ChangeEvent<HTMLInputElement>) => {
//         setWarning(event.target.value)
//     }
//     const addWarning = () => {
//         if (warning!=='') {
//             setRegexWarning([...regexWarning,warning])
//             setWarning('')
//         }
//     }
//     const deleteChipWarning = (e:string) => {
//         setRegexWarning(regexWarning.filter(ri => ri!==e))
//     }

//     const onChangeRegexError = (event:ChangeEvent<HTMLInputElement>) => {
//         setError(event.target.value)
//     }
//     const addError = () => {
//         if (error!=='') {
//             setRegexError([...regexError,error])
//             setError('')
//         }
//     }
//     const deleteChipError = (e:string) => {
//         setRegexError(regexError.filter(ri => ri!==e))
//     }

//     return (<>
//         <Dialog open={true} >
//             <DialogTitle>Create alarm</DialogTitle>
//             <DialogContent>
//                 <Stack direction={'row'} spacing={3}>
//                     <Stack direction={'column'}>
//                         <Stack direction={'row'}>
//                             <TextField value={info} onChange={onChangeRegexInfo} label='Info' variant='standard'></TextField>
//                             <Button onClick={addInfo} size='small'>Add</Button>
//                         </Stack>
//                         <Grid>
//                             {
//                                 regexInfo.map (ri => { return <Grid item><Chip label={ri} variant='outlined' onDelete={() => deleteChipInfo(ri)}/></Grid>})
//                             }
//                         </Grid>
//                     </Stack>
//                     <Stack direction={'column'}>
//                         <Stack direction={'row'}>
//                             <TextField value={warning} onChange={onChangeRegexWarning} label='Warning' variant='standard'></TextField>
//                             <Button onClick={addWarning} size='small'>Add</Button>
//                         </Stack>
//                         <Grid>
//                             {
//                                 regexWarning.map (ri => { return <Grid item><Chip label={ri} variant='outlined' onDelete={() => deleteChipWarning(ri)}/></Grid>})
//                             }
//                         </Grid>
//                     </Stack>
//                     <Stack direction={'column'}>
//                         <Stack direction={'row'}>
//                             <TextField value={error} onChange={onChangeRegexError} variant='standard' label='Error'></TextField>
//                             <Button onClick={addError} size='small'>Add</Button>
//                         </Stack>
//                         <Grid>
//                             {
//                                 regexError.map (ri => { return <Grid item><Chip label={ri} variant='outlined' onDelete={() => deleteChipError(ri)}/></Grid>})
//                             }
//                         </Grid>
//                     </Stack>
//                 </Stack>
//             </DialogContent>
//             <DialogActions>
//                 <Button onClick={() => props.onClose(regexInfo,regexWarning,regexError)} disabled={regexInfo.length===0 && regexWarning.length===0 && regexError.length===0}>OK</Button>
//                 <Button onClick={() => props.onClose([],[],[])}>CANCEL</Button>
//             </DialogActions>
//         </Dialog>
//     </>)
// }
export {}
// export { AlarmSetup }