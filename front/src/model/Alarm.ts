enum AlarmType {
    timed,
    permanent,
    blocking
  }
  
enum AlarmSeverity {
  default='default',
  info='info',
  success='success',
  warning='warning',
  error='error'
}

class Alarm {
  public expression:string='';
  public severity:AlarmSeverity=AlarmSeverity.default;
  public message:string='';
  public type:AlarmType=AlarmType.timed;
  //+++ implement sound-sets and sound configuration
  public beep:boolean=false;
}

export { AlarmType, Alarm, AlarmSeverity }