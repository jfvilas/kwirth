import { Box } from "@mui/material";
import { Message } from "../model/Message";
import { LogObject } from "../model/LogObject";

interface IProps {
  // messages:Message[];
  filter:string;
  //search:string;
  //searchPos:number;
  //searchLineRef: React.MutableRefObject<null>;
  lastLineRef: React.MutableRefObject<null>;
  log:LogObject;
}
  
const LogContent: React.FC<any> = (props:IProps) => {

    const formatMessage = (message:Message|null, index:number, color:number=0, ) => {
        if (!message) return null;

        if (message.type==='log') {
            var txt=message.text;
            if (props.log.view==='cluster') {
                var fill=message.namespace!.length+1+message.resource!.length+1;
                var f=' '.repeat(fill);
                txt=txt.replaceAll('\n','\n'+f).trimEnd();
            }
            else if (props.log.view==='namespace'){
                var fill=message.resource!.length+1;
                var f=' '.repeat(fill);
                txt=txt.replaceAll('\n','\n'+f).trimEnd();
            }

            // var t:JSX.Element;
            // t=<>{txt}</>;

            // if (color===0) {
            //     t=<span >{txt}</span>
            // }
            // else {
            //     // var i=txt.indexOf(props.search);
            //     // if (i>=0) {
            //     //     t=<>{txt.substring(0,i)}<span style={{background:index===props.searchPos?'#ee0000':'#bbbbbb'}}>{props.search}</span>{txt.substring(i+props.search.length)}</>;
            //     // }
            //     // else {
            //         t=<>{txt}</>;
            //     // }
            // }

            if (props.log.view==='cluster') {
                return <><span style={{color:"red"}}>{message.namespace}</span><span style={{color:"blue"}}>{' '+message.resource+' '}</span>{txt}</>;
            }
            else if (props.log.view==='namespace') {
                return <><span style={{color:"blue"}}>{message.resource+' '}</span>{txt}</>;
            }
            else
                return txt;
        }
        else if (message.type==='info') {
            return <span style={{color:"blue"}}><b>{"***** "+message.text+" *****"}</b></span>
        }
        else if (message.type==='error') {
            return <span style={{color:"red"}}><b>{"***** "+message.text+" *****"}</b></span>
        }
        else  {
            return <span>{message.text}</span>
        }
    }

    return (
        <Box sx={{ flex:1, overflowY: 'auto', ml:1 }}>
            <pre>
                {props.log && props.log.messages.map(m => {
                    return m.text.includes(props.filter)? m : null}).map((message, index) => {
                        // if (props.search!=='') {
                        //     if (index===props.searchPos)
                        //         return <div key={index} ref={null} dangerouslySetInnerHTML={{__html: message!.text.replaceAll(props.search,'<span style=\'background-color:#ee0000\'>'+props.search+'</span>')}}></div>;
                        //         //return <div key={index} ref={props.searchLineRef}>{formatMessage(message, index, 2)}</div>;
                        //     else
                        //         return <div key={index} ref={null} dangerouslySetInnerHTML={{__html: message!.text.replaceAll(props.search,'<span style=\'background-color:#bbbbbb\'>'+props.search+'</span>')}}></div>;
                        //         //return <div key={index} ref={props.searchLineRef}>{formatMessage(message, index, 1)}</div>;
                        // }
                        // else {
                            if (index===props.log.messages.length-1)
                                return <><div key={index} ref={props.lastLineRef} >{formatMessage(message, index, 0)}</div><div key={-1} >&nbsp;</div></>;
                            else 
                                return <div key={index}>{formatMessage(message, index, 0)}</div>;
                        // }
                })}
            </pre>
        </Box>
    );
}
export default LogContent;