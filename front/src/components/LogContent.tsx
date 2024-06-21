import { Box } from "@mui/material";

interface IProps {
    messages:any[];
    filter:string;
    search:string;
    searchPos:number;
    searchLineRef: React.MutableRefObject<null>;
    lastLineRef: React.MutableRefObject<null>;
  }
  
const LogContent: React.FC<any> = (props:IProps) => {

    return (
        <Box sx={{ flex:1, overflowY: 'auto', ml:1 }}>
          <pre>
            {props.messages.map(m => {
              return m.includes(props.filter)? m : null;
            })
            .map((message, index) => {
              if (props.search!=='') {
                if (index===props.searchPos)
                  return <div key={index} ref={props.searchLineRef} dangerouslySetInnerHTML={{__html: message!.replaceAll(props.search,'<span style=\'background-color:#ee0000\'>'+props.search+'</span>')}}></div>;
                else
                  return <div key={index} ref={null} dangerouslySetInnerHTML={{__html: message!.replaceAll(props.search,'<span style=\'background-color:#bbbbbb\'>'+props.search+'</span>')}}></div>;
              }
              else {
                if (index===props.messages.length-1)
                  return <><div key={index} ref={props.lastLineRef} >{message}</div><div key={-1} >&nbsp;</div></>;
                else
                  return <div key={index}>{message}</div>;
              }
            })}
          </pre>
        </Box>);
  
}
export default LogContent;