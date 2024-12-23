enum AlarmType {
    TIMED,
    PERMANENT,
    BLOCKING
  }
  
enum AlarmSeverity {
    DEFAULT='default',
    INFO='info',
    SUCCESS='success',
    WARNING='warning',
    ERROR='error'
}

class Alarm {
    public id:string='';
    public expression:string='';
    public severity:AlarmSeverity=AlarmSeverity.DEFAULT;
    public message:string='';
    public type:AlarmType=AlarmType.TIMED;
    //+++ implement sound-sets and sound configuration
    public beep:boolean=false;
}

export { AlarmType, Alarm, AlarmSeverity }