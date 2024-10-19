import { Box } from "@mui/material";
//import { Message } from "../model/Message";
import { LogObject } from "../model/LogObject";
import { MetricsMessage, StreamMessage } from "@jfvilas/kwirth-common";

interface IProps {
  // messages:Message[];
  filter:string;
  //search:string;
  //searchPos:number;
  //searchLineRef: React.MutableRefObject<null>;
  lastLineRef: React.MutableRefObject<null>;
  log:LogObject;
  metrics:MetricsMessage[]
}
  
const LogContent: React.FC<any> = (props:IProps) => {

    // const formatMessage = (message:Message|null, index:number, color:number=0, ) => {
    //     if (!message) return null;

    //     if (message.type==='log') {
    //         var txt=message.text;
    //         if (props.log.view==='cluster') {
    //             var fill=message.namespace!.length+1+message.resource!.length+1;
    //             var f=' '.repeat(fill);
    //             txt=txt.replaceAll('\n','\n'+f).trimEnd();
    //         }
    //         else if (props.log.view==='namespace'){
    //             var fill=message.resource!.length+1;
    //             var f=' '.repeat(fill);
    //             txt=txt.replaceAll('\n','\n'+f).trimEnd();
    //         }

    //         // var t:JSX.Element;
    //         // t=<>{txt}</>;

    //         // if (color===0) {
    //         //     t=<span >{txt}</span>
    //         // }
    //         // else {
    //         //     // var i=txt.indexOf(props.search);
    //         //     // if (i>=0) {
    //         //     //     t=<>{txt.substring(0,i)}<span style={{background:index===props.searchPos?'#ee0000':'#bbbbbb'}}>{props.search}</span>{txt.substring(i+props.search.length)}</>;
    //         //     // }
    //         //     // else {
    //         //         t=<>{txt}</>;
    //         //     // }
    //         // }

    //         if (props.log.view==='cluster') {
    //             return <><span style={{color:"red"}}>{message.namespace}</span><span style={{color:"blue"}}>{' '+message.resource+' '}</span>{txt}</>;
    //         }
    //         else if (props.log.view==='namespace') {
    //             return <><span style={{color:"blue"}}>{message.resource+' '}</span>{txt}</>;
    //         }
    //         else
    //             return txt;
    //     }
    //     else if (message.type==='info') {
    //         return <span style={{color:"blue"}}><b>{"***** "+message.text+" *****"}</b></span>
    //     }
    //     else if (message.type==='error') {
    //         return <span style={{color:"red"}}><b>{"***** "+message.text+" *****"}</b></span>
    //     }
    //     else if (message.type==='metrics') {
    //         return <span style={{color:"green"}}><b>{JSON.stringify(message,null,0)}</b></span>
    //     }
    //     else  {
    //         return <span>{message.text}</span>
    //     }
    // }

    const formatMessage = (message:StreamMessage|null, index:number, color:number=0, ) => {
        if (!message) return null;

        if (message.type==='log') {
            var txt=message.text;
            if (props.log.view==='cluster') {
                var fill=message.namespace!.length+1+message.podName!.length+1;
                var f=' '.repeat(fill);
                txt=txt.replaceAll('\n','\n'+f).trimEnd();
            }
            else if (props.log.view==='namespace'){
                var fill=message.podName!.length+1;
                var f=' '.repeat(fill);
                txt=txt.replaceAll('\n','\n'+f).trimEnd();
            }

            if (props.log.view==='cluster') {
                return <><span style={{color:"red"}}>{message.namespace}</span><span style={{color:"blue"}}>{' '+message.podName+' '}</span>{txt}</>;
            }
            else if (props.log.view==='namespace') {
                return <><span style={{color:"blue"}}>{message.podName+' '}</span>{txt}</>;
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
        else if (message.type==='metrics') {
            return <span style={{color:"green"}}><b>{JSON.stringify(message,null,0)}</b></span>
        }
        else  {
            return <span>{message.text}</span>
        }
    }

    return (
        <>
        <Box sx={{ flex:1, overflowY: 'auto', ml:1 }}>
            { props.metrics.map ( m => {
                var res=''
                m.metrics.map( (mname,i) => res+=mname+': '+m.value[i]+'\n')
                return <div><b>{`${m.namespace}/${m.podName}`}</b><br/><pre>{res}</pre></div>
            })}
            <pre>
                {props.log && props.log.messages.map(m => {
                    return m.text.includes(props.filter)? m : null}).map((message, index) => {
                        if (index===props.log.messages.length-1)
                            return <><div key={index} ref={props.lastLineRef} >{formatMessage(message, index, 0)}</div><div key={-1} >&nbsp;</div></>
                        else 
                            return <div key={index}>{formatMessage(message, index, 0)}</div>
                })}
            </pre>
        </Box>
        </>
    );
}
export default LogContent