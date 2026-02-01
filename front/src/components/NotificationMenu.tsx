
import React from 'react'
import { Popover, List, ListItem, ListItemText, IconButton, Typography, Box, Divider, Chip, Button, Stack } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff'
import { ENotifyLevel } from '../tools/Global'
import { DeleteSweep } from '@mui/icons-material'
import { IChannel } from '../channels/IChannel'
import { IconKubernetes } from '../tools/Constants-React'

export interface NotificationMessage {
    channel: IChannel|undefined
    message: string
    level: ENotifyLevel
    timestamp: Date
}

interface NotificationMenuProps {
    anchorEl: HTMLElement | null
    open: boolean
    onClose: () => void
    messages: NotificationMessage[]
    onDelete: (index: number) => void
    onClear: () => void
}

const NotificationMenu: React.FC<NotificationMenuProps> = ({ anchorEl, open, onClose, onClear, messages, onDelete }) => {

    const getSeverityColor = (level: ENotifyLevel) => {
    const colors = {
		[ENotifyLevel.ERROR]: 'error.main',
		[ENotifyLevel.WARNING]: 'warning.main',
		[ENotifyLevel.SUCCESS]: 'success.main',
		[ENotifyLevel.INFO]: 'info.main',
    }
    return colors[level]
  }

return (
    <Popover
		anchorEl={anchorEl}
		open={open}
		onClose={onClose}
		anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
		transformOrigin={{ vertical: 'top', horizontal: 'right' }}
		PaperProps={{ sx: { width: 400, maxHeight: 500 } }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
			<Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1 }}>Notifications</Typography>
			{
				messages.length > 0 && <Button size="small" color="error" startIcon={<DeleteSweep />} onClick={onClear} sx={{ fontSize: '0.75rem' }}>Clear</Button>
			}
			<Chip label={messages.length} size="small" />
      </Box>
	  
      <Divider />
      
      <List sx={{ p: 0 }}>
        {messages.length > 0 ? (
			messages.map((msg, index) => (
				<ListItem 
					key={index}
					divider
					secondaryAction={
						<IconButton edge="end" size="small" onClick={() => onDelete(index)}>
						<CloseIcon fontSize="small" />
						</IconButton>
					}
				>
					<Stack direction={'row'} alignItems={'start'}>
						<span style={{marginTop:2}}>
							{msg.channel?.getChannelIcon() || <IconKubernetes/>}
						</span>  
						<ListItemText 
							primary={msg.message}
							primaryTypographyProps={{ variant: 'body2', sx: { pr: 2, pl:1 } }}
							secondary={
								<Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
									<Typography variant="caption" sx={{ color: getSeverityColor(msg.level), fontWeight: 'bold', pl:1 }}>{msg.level}</Typography>
									<Typography variant="caption" color="text.secondary">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography>
								</Box>
							}
						/>
					</Stack>
				</ListItem>
				
			))
        )
		:
		(
			<Box sx={{ p: 4, textAlign: 'center' }}>
				<NotificationsOffIcon sx={{ opacity: 0.2, fontSize: 40, mb: 1 }} />
				<Typography variant="body2" color="text.secondary">No new notifications.</Typography>
			</Box>
        )}
      </List>
    </Popover>
  )
}

export { NotificationMenu}