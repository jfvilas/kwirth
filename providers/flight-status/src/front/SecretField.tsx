import React, { useState } from 'react'
import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'

interface ISecretFieldProps {
    label: string
    value: string
    onChange: (value: string) => void
    helperText?: string
}

// Credential field: hidden by default, with an eye to reveal it. What is typed here ends up in a Secret,
// not in the ConfigMap (the back splits both halves on save). The browser must never fill it in.
const SecretField: React.FC<ISecretFieldProps> = ({ label, value, onChange, helperText }) => {
    const [visible, setVisible] = useState(false)

    return <TextField size='small' label={label} value={value ?? ''} fullWidth helperText={helperText}
        type={visible ? 'text' : 'password'}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        slotProps={{
            // 'new-password', not 'off': browsers ignore 'off' on password fields and would fill in the
            // saved Kwirth login, which the dialog would then store as this credential.
            htmlInput: { autoComplete: 'new-password' },
            input: {
                endAdornment: (
                    <InputAdornment position='end'>
                        <Tooltip title={visible ? 'Hide' : 'Show'}>
                            <IconButton size='small' edge='end' onClick={() => setVisible(!visible)}>
                                {visible ? <VisibilityOff fontSize='small' /> : <Visibility fontSize='small' />}
                            </IconButton>
                        </Tooltip>
                    </InputAdornment>
                )
            }
        }} />
}

export default SecretField
