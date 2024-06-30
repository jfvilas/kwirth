import { Box } from "@mui/material";
import { Message } from "../model/Message";
import { LogObject } from "../model/LogObject";

interface IProps {
  // messages:Message[];
  filter:string;
  search:string;
  searchPos:number;
  searchLineRef: React.MutableRefObject<null>;
  lastLineRef: React.MutableRefObject<null>;
  log:LogObject;
}
  
const LogContent: React.FC<any> = (props:IProps) => {

  const formatMessage = (message:Message|null, index:number) => {
    if (props.log.scope==='cluster') {
      return <div key={index}><span style={{color:"red"}}>{message!.namespace}</span>&nbsp;<span style={{color:"blue"}}>{message!.resource}</span>&nbsp;{message!.text}</div>;
    }
    else if (props.log.scope==='namespace') {
      return <div key={index}><span style={{color:"blue"}}>{message!.resource}</span>&nbsp;{message!.text}</div>;
    }
    else
      return <div key={index}>{message!.text}</div>;
  }

  return (
    <Box sx={{ flex:1, overflowY: 'auto', ml:1 }}>
      <pre>
        {props.log && props.log.messages.map(m => {
          return m.text.includes(props.filter)? m : null;
        })
        .map((message, index) => {
          if (props.search!=='') {
            if (index===props.searchPos)
              return <div key={index} ref={props.searchLineRef} dangerouslySetInnerHTML={{__html: message!.text.replaceAll(props.search,'<span style=\'background-color:#ee0000\'>'+props.search+'</span>')}}></div>;
            else
              return <div key={index} ref={null} dangerouslySetInnerHTML={{__html: message!.text.replaceAll(props.search,'<span style=\'background-color:#bbbbbb\'>'+props.search+'</span>')}}></div>;
          }
          else {
            if (index===props.log.messages.length-1)
              return <><div key={index} ref={props.lastLineRef} >{formatMessage(message, index)}</div><div key={-1} >&nbsp;</div></>;
            else 
              return <div key={index}>{formatMessage(message, index)}</div>;
          }
        })}
      </pre>
    </Box>
  );  
}
export default LogContent;