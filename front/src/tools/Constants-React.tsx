import SvgIconGke from'../icons/general/gke.svg'
import SvgIconRk2e from'../icons/general/rk2e.svg'
import SvgIconK3d from'../icons/general/k3d.svg'
import SvgIconK3s from'../icons/general/k3s.svg'
import SvgIconOcp from'../icons/general/ocp.svg'

// official icons
import SvgIconConfigMap from '../kubernetes-icons-official/svg/resources/labeled/cm.svg'
import SvgIconSecret from '../kubernetes-icons-official/svg/resources/labeled/secret.svg'
import SvgIconService from '../kubernetes-icons-official/svg/resources/labeled/svc.svg'
import SvgIconEndpoints from '../kubernetes-icons-official/svg/resources/labeled/ep.svg'
import SvgIconIngress from '../kubernetes-icons-official/svg/resources/labeled/ing.svg'
import SvgIconPersistentVolume from '../kubernetes-icons-official/svg/resources/labeled/pv.svg'
import SvgIconPersistentVolumeClaim from '../kubernetes-icons-official/svg/resources/labeled/pvc.svg'
import SvgIconClusterRole from '../kubernetes-icons-official/svg/resources/labeled/c-role.svg'
import SvgIconClusterRoleBinding from '../kubernetes-icons-official/svg/resources/labeled/crb.svg'
import SvgIconRole from '../kubernetes-icons-official/svg/resources/labeled/role.svg'
import SvgIconRoleBinding from '../kubernetes-icons-official/svg/resources/labeled/rb.svg'
import SvgIconDocker from'../icons/svg/docker-mark-blue.svg'

export const IconConfigMap = (props: {height?:number}) => <img src={SvgIconConfigMap} alt='cm' height={`${props.height||16}||16px`}/>
export const IconSecret = (props: {height?:number}) => <img src={SvgIconSecret} alt='secret' height={`${props.height||16}||16px`}/>
export const IconService = (props: {height?:number}) => <img src={SvgIconService} alt='service' height={`${props.height||16}||16px`}/>
export const IconEndpoints = (props: {height?:number}) => <img src={SvgIconEndpoints} alt='ep' height={`${props.height||16}||16px`}/>
export const IconIngress = (props: {height?:number}) => <img src={SvgIconIngress} alt='ingress' height={`${props.height||16}||16px`}/>
export const IconPersistentVolume = (props: {height?:number}) => <img src={SvgIconPersistentVolume} alt='secret' height={`${props.height||16}||16px`}/>
export const IconPersistentVolumeClaim = (props: {height?:number}) => <img src={SvgIconPersistentVolumeClaim} alt='secret' height={`${props.height||16}||16px`}/>
export const IconRole = (props: {height?:number}) => <img src={SvgIconRole} alt='role' height={`${props.height||16}||16px`}/>
export const IconRoleBinding = (props: {height?:number}) => <img src={SvgIconRoleBinding} alt='rb' height={`${props.height||16}||16px`}/>
export const IconClusterRole = (props: {height?:number}) => <img src={SvgIconClusterRole} alt='cr' height={`${props.height||16}||16px`}/>
export const IconClusterRoleBinding = (props: {height?:number}) => <img src={SvgIconClusterRoleBinding} alt='crb' height={`${props.height||16}||16px`}/>
export const IconDocker = (props: {height?:number}) => <img src={SvgIconDocker} alt='docker' height={`${props.height||16}px`}/>

export const IconGke = (props: {height?:number}) => { return <img src={SvgIconGke} alt='ns' height={`${props.height||16}px`}/> }
export const IconRk2e = (props: {height?:number}) => { return <img src={SvgIconRk2e} alt='ns' height={`${props.height||16}px`}/> }
export const IconK3d = (props: {height?:number}) => { return <img src={SvgIconK3d} alt='ns' height={`${props.height||16}px`}/> }
export const IconK3s = (props: {height?:number}) => { return <img src={SvgIconK3s} alt='ns' height={`${props.height||16}px`}/> }
export const IconOcp = (props: {height?:number}) => { return <img src={SvgIconOcp} alt='ns' height={`${props.height||16}px`}/> }

type IconProps = { size: number }

export const IconNamespace = (props:IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    id="svg13826"
    width={props.size}
    height={props.size}
    version="1.1"
    viewBox="0 0 18.035 17.5"
  >
    <g id="layer1" fillOpacity="1" transform="translate(-.993 -1.174)">
      <g
        id="g70"
        stroke="none"
        strokeDasharray="none"
        strokeMiterlimit="4"
        strokeWidth="0"
        transform="matrix(1.01489 0 0 1.01489 16.902 -2.699)"
      >
        <path
          id="path3055"
          fill="#326ce5"
          strokeOpacity="1"
          d="M-6.85 4.272a1.12 1.11 0 0 0-.428.109l-5.852 2.796a1.12 1.11 0 0 0-.606.753l-1.444 6.282a1.12 1.11 0 0 0 .152.85 1.12 1.11 0 0 0 .064.089l4.05 5.037a1.12 1.11 0 0 0 .876.417l6.496-.001a1.12 1.11 0 0 0 .875-.417l4.049-5.038a1.12 1.11 0 0 0 .216-.939L.152 7.93a1.12 1.11 0 0 0-.605-.753L-6.307 4.38a1.12 1.11 0 0 0-.542-.109"
        ></path>
        <path
          id="path3054-2-9"
          fill="#fff"
          fillRule="nonzero"
          d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
          baselineShift="baseline"
          color="#000"
          direction="ltr"
          display="inline"
          fontFamily="Sans"
          fontSize="medium"
          fontStretch="normal"
          fontStyle="normal"
          fontVariant="normal"
          fontWeight="normal"
          letterSpacing="normal"
          overflow="visible"
          style={{
            lineHeight: "normal",
            textIndent: "0",
            textAlign: "start",
            textDecorationLine: "none",
            textTransform: "none",
            marker: "none",
          }}
          textAnchor="start"
          textDecoration="none"
          visibility="visible"
          wordSpacing="normal"
          writingMode="lr-tb"
        ></path>
      </g>
      <text
        xmlSpace="preserve"
        id="text2066"
        x="9.972"
        y="16.812"
        fill="#fff"
        stroke="none"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        strokeOpacity="1"
        strokeWidth="0.265"
        fontFamily="Sans"
        fontSize="10.583"
        fontStyle="normal"
        fontWeight="normal"
        letterSpacing="0"
        style={{ lineHeight: "6.61458349px" }}
        wordSpacing="0"
      >
        <tspan
         style={{fontStyle:'normal',fontVariant:'normal',fontWeight:'normal',fontStretch:'normal',fontSize:'2.82222223px',fontFamily:'Arial',textAlign:'center',fill:'#ffffff',fillOpacity:1,strokeWidth:'0.26458332px'}}
         textAnchor="middle"
         y="16.811775"
         x="9.9717083"
         id="tspan2064">ns</tspan>
      </text>
      <path
        id="rect8790"
        fill="none"
        fillRule="nonzero"
        stroke="#fff"
        strokeDasharray="0.80000001, 0.4"
        strokeDashoffset="3.44"
        strokeLinecap="butt"
        strokeLinejoin="round"
        strokeMiterlimit="10"
        strokeOpacity="1"
        strokeWidth="0.4"
        d="M6.173 6.369h7.674v6.69H6.173z"
        opacity="1"
      ></path>
    </g>
  </svg>
)

export const IconReplicaSet = (props:IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18.035 17.5" width={props.size} height={props.size}>
    <g
      id="g70"
      fillOpacity="1"
      stroke="none"
      strokeDasharray="none"
      strokeMiterlimit="4"
      strokeWidth="0"
      transform="matrix(1.01489 0 0 1.01489 15.91 -3.873)"
    >
      <path
        id="path3055"
        fill="#326ce5"
        strokeOpacity="1"
        d="M-6.85 4.272a1.12 1.11 0 0 0-.428.109l-5.852 2.796a1.12 1.11 0 0 0-.606.753l-1.444 6.282a1.12 1.11 0 0 0 .152.85 1.12 1.11 0 0 0 .064.089l4.05 5.037a1.12 1.11 0 0 0 .876.417l6.496-.001a1.12 1.11 0 0 0 .875-.417l4.049-5.038a1.12 1.11 0 0 0 .216-.939L.152 7.93a1.12 1.11 0 0 0-.605-.753L-6.307 4.38a1.12 1.11 0 0 0-.542-.109"
      ></path>
      <path
        id="path3054-2-9"
        fill="#fff"
        fillRule="nonzero"
        d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
        baselineShift="baseline"
        color="#000"
        direction="ltr"
        display="inline"
        fontFamily="Sans"
        fontSize="medium"
        fontStretch="normal"
        fontStyle="normal"
        fontVariant="normal"
        fontWeight="normal"
        letterSpacing="normal"
        overflow="visible"
        style={{
          lineHeight: "normal",
          //InkscapeFontSpecification: "Sans",
          textIndent: "0",
          textAlign: "start",
          textDecorationLine: "none",
          textTransform: "none",
          marker: "none",
        }}
        textAnchor="start"
        textDecoration="none"
        visibility="visible"
        wordSpacing="normal"
        writingMode="lr-tb"
      ></path>
    </g>
    <text
      x="3.382"
      y="12.092"
      fill="#FFEFEF"
      fontFamily="Arial, sans-serif"
      fontSize="8"
      style={{ whiteSpace: "pre" }}
      transform="matrix(1.16478 0 0 1.25539 -1.388 -2.748)"
    >
      RS
    </text>
  </svg>
)

export const IconBlank = (props:IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18.035 17.5" width={props.size} height={props.size}>
    <path
      fill="#326ce5"
      d="M8.958.463a1.137 1.127 0 0 0-.434.11l-5.94 2.838a1.137 1.127 0 0 0-.615.764L.504 10.551a1.137 1.127 0 0 0 .154.862 1.137 1.127 0 0 0 .065.09l4.11 5.113a1.137 1.127 0 0 0 .89.423l6.592-.001a1.137 1.127 0 0 0 .888-.423l4.11-5.113a1.137 1.127 0 0 0 .219-.953l-1.468-6.374a1.137 1.127 0 0 0-.614-.764L9.51.572a1.137 1.127 0 0 0-.551-.11"
    ></path>
    <path
      fill="#fff"
      d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
      color="#000"
      fontFamily="Sans"
      fontWeight="400"
      overflow="visible"
      style={{
        lineHeight: "normal",
        textIndent: "0",
        textAlign: "start",
        textDecorationLine: "none",
        textTransform: "none",
        marker: "none",
      }}
      transform="translate(15.91 -3.873)scale(1.01489)"
    ></path>
  </svg>
)

export const IconContainer = (props:IconProps) => (
<svg
    xmlns="http://www.w3.org/2000/svg"
    data-name="Layer 1"
    viewBox="0 0 756.26 596.9"
    width={props.size} height={props.size}
  >
    <path
      fill="#1d63ed"
      d="M743.96 245.25c-18.54-12.48-67.26-17.81-102.68-8.27-1.91-35.28-20.1-65.01-53.38-90.95l-12.32-8.27-8.21 12.4c-16.14 24.5-22.94 57.14-20.53 86.81 1.9 18.28 8.26 38.83 20.53 53.74-46.1 26.74-88.59 20.67-276.77 20.67H.06c-.85 42.49 5.98 124.23 57.96 190.77 5.74 7.35 12.04 14.46 18.87 21.31 42.26 42.32 106.11 73.35 201.59 73.44 145.66.13 270.46-78.6 346.37-268.97 24.98.41 90.92 4.48 123.19-57.88.79-1.05 8.21-16.54 8.21-16.54l-12.3-8.27Zm-554.29-38.86h-81.7v81.7h81.7zm105.55 0h-81.7v81.7h81.7zm105.55 0h-81.7v81.7h81.7zm105.55 0h-81.7v81.7h81.7zm-422.2 0H2.42v81.7h81.7zM189.67 103.2h-81.7v81.7h81.7zm105.55 0h-81.7v81.7h81.7zm105.55 0h-81.7v81.7h81.7zm0-103.2h-81.7v81.7h81.7z"
    ></path>
  </svg>
)

export const IconController = (props:IconProps) => (
<svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size}
    height={props.size}
    viewBox="0 0 18.035 17.5"
  >
    <path
      fill="#326ce5"
      d="M8.986.463a1.2 1.2 0 0 0-.435.11L2.612 3.411c-.312.149-.538.43-.615.764L.532 10.551a1.11 1.11 0 0 0 .219.953l4.11 5.112c.216.267.543.423.889.423l6.593-.001c.345 0 .672-.156.888-.423l4.109-5.113c.216-.268.296-.619.219-.953l-1.467-6.374a1.13 1.13 0 0 0-.614-.764L9.537.572a1.14 1.14 0 0 0-.55-.11"
    ></path>
    <path
      fill="#fff"
      d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
      color="#000"
      fontFamily="Sans"
      fontWeight="400"
      overflow="visible"
      style={{
        lineHeight: "normal",
        textIndent: "0",
        textAlign: "start",
        textDecorationLine: "none",
        textTransform: "none",
        marker: "none",
      }}
      transform="translate(15.91 -3.873)scale(1.01489)"
    ></path>
    <path
      fill="none"
      stroke="#fff"
      strokeDasharray="1.58743756,1.58743756"
      strokeDashoffset="3.667"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeMiterlimit="10"
      strokeWidth="0.529"
      d="M7.341 4.655h6.525v4.583H7.341z"
    ></path>
    <path
      fill="#326ce5"
      fillRule="evenodd"
      stroke="#fff"
      strokeDasharray="1.58743756,1.58743756"
      strokeDashoffset="3.879"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeMiterlimit="10"
      strokeWidth="0.529"
      d="M5.802 6.066h6.525v4.584H5.802z"
    ></path>
    <path
      fill="none"
      stroke="#fff"
      strokeLinejoin="round"
      strokeMiterlimit="10"
      strokeWidth="0.529"
      d="M4.264 7.478h6.525v4.583H4.264z"
    ></path>
    <path
      fill="#fff"
      fillRule="evenodd"
      d="M4.219 7.495h6.525v4.583H4.219z"
    ></path>
    <text
      x="8.911"
      y="15.494"
      fill="#fff"
      strokeWidth="0.265"
      fontFamily="Sans"
      fontSize="10.583"
      fontWeight="400"
      letterSpacing="0"
      style={{ lineHeight: "6.61458px", whiteSpace: "pre" }}
      wordSpacing="0"
    >
      <tspan
        x="8.911"
        y="15.494"
        fontFamily="Arial"
        fontSize="2.8"
        style={{ textAlign: "center" }}
        textAnchor="middle"
      >
        group
      </tspan>
    </text>
  </svg>
)

export const IconPod = (props:IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size}
    height={props.size}
    viewBox="0 0 18.035 17.5"
  >
    <path
      fill="#326ce5"
      d="M8.958.463a1.137 1.127 0 0 0-.434.11l-5.94 2.838a1.137 1.127 0 0 0-.615.764L.504 10.551a1.137 1.127 0 0 0 .154.862 1.137 1.127 0 0 0 .065.09l4.11 5.113a1.137 1.127 0 0 0 .89.423l6.592-.001a1.137 1.127 0 0 0 .888-.423l4.11-5.113a1.137 1.127 0 0 0 .219-.953l-1.468-6.374a1.137 1.127 0 0 0-.614-.764L9.51.572a1.137 1.127 0 0 0-.551-.11Z"
    ></path>
    <path
      fill="#fff"
      d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115Zm.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
      color="#000"
      fontFamily="Sans"
      fontWeight="400"
      overflow="visible"
      style={{
        lineHeight: "normal",
        textIndent: "0",
        textAlign: "start",
        textDecorationLine: "none",
        textTransform: "none",
        marker: "none",
      }}
      transform="translate(15.91 -3.873)scale(1.01489)"
    ></path>
    <text
      xmlSpace="preserve"
      x="10.017"
      y="16.812"
      fill="#fff"
      strokeWidth="0.265"
      fontFamily="Sans"
      fontSize="10.583"
      fontWeight="400"
      letterSpacing="0"
      style={{ lineHeight: "6.61458349px" }}
      transform="translate(-.993 -1.174)"
      wordSpacing="0"
    >
      <tspan x="10.017" y="16.812" style={{fontStyle:'normal',fontVariant:'normal',fontWeight:400, fontStretch:'normal',fontSize:'2.82222223px',fontFamily:'Arial',textAlign:'center',fill:'#fff',fillOpacity:1,strokeWidth:'.26458332px'}} textAnchor="middle">pod</tspan>
    </text>    
    <path
      fill="#fff"
      fillRule="evenodd"
      d="m5.397 5.862 3.62-1.05 3.621 1.05-3.62 1.05Zm0 .402v3.853l3.373 1.869.017-4.713zm7.241 0v3.853l-3.373 1.869-.017-4.713z"
    ></path>
  </svg>
)

export const IconVolume = (props:IconProps) => (
 <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size}
    height={props.size}
    viewBox="0 0 18.035 17.5"
  >
    <path
      fill="#326ce5"
      d="M8.958.463a1.137 1.127 0 0 0-.434.11l-5.94 2.838a1.137 1.127 0 0 0-.615.764L.504 10.551a1.137 1.127 0 0 0 .154.862 1.137 1.127 0 0 0 .065.09l4.11 5.113a1.137 1.127 0 0 0 .89.423l6.592-.001a1.137 1.127 0 0 0 .888-.423l4.11-5.113a1.137 1.127 0 0 0 .219-.953l-1.468-6.374a1.137 1.127 0 0 0-.614-.764L9.51.572a1.137 1.127 0 0 0-.551-.11"
    ></path>
    <path
      fill="#fff"
      d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
      color="#000"
      fontFamily="Sans"
      fontWeight="400"
      overflow="visible"
      style={{
        lineHeight: "normal",
        textIndent: "0",
        textAlign: "start",
        textDecorationLine: "none",
        textTransform: "none",
        marker: "none",
      }}
      transform="translate(15.91 -3.873)scale(1.01489)"
    ></path>
    <text
      xmlSpace="preserve"
      x="10.092"
      y="16.812"
      fill="#fff"
      strokeWidth="0.265"
      fontFamily="Sans"
      fontSize="10.583"
      fontWeight="400"
      letterSpacing="0"
      style={{ lineHeight: "6.61458349px" }}
      transform="translate(-.993 -1.174)"
      wordSpacing="0"
    >
      
        <tspan
          x="10.017"
          y="16.812"
          style={{
            fontStyle: 'normal',
            fontVariant: 'normal',
            fontWeight: 400,
            fontStretch: 'normal',
            fontSize: '2.82222223px',
            fontFamily: 'Arial, Helvetica, sans-serif',
            textAlign: 'center',
            fill: '#fff',
            fillOpacity: 1,
            strokeWidth: '.26458332px',
            textTransform: 'lowercase',
            textRendering: 'geometricPrecision' 
          }}
          textAnchor="middle"
        >
          volume</tspan>
      
    </text>
    <path
      fill="#fff"
      fillRule="evenodd"
      d="M4.389 7.019c0 .62 2.073 1.124 4.63 1.124s4.628-.503 4.628-1.124v3.042c0 .621-2.072 1.125-4.629 1.125s-4.629-.504-4.629-1.125z"
    ></path>
    <path
      fill="#fff"
      fillRule="evenodd"
      d="M4.389 7.019c0-.621 2.073-1.125 4.63-1.125s4.628.504 4.628 1.125c0 .62-2.072 1.124-4.629 1.124S4.389 7.64 4.389 7.019"
    ></path>
    <path
      fill="none"
      stroke="#326ce5"
      strokeLinejoin="round"
      strokeMiterlimit="10"
      strokeWidth="0.265"
      d="M13.648 7.019c0 .62-2.073 1.124-4.63 1.124S4.389 7.64 4.389 7.019s2.073-1.125 4.63-1.125 4.628.504 4.628 1.125v3.042c0 .621-2.072 1.125-4.629 1.125s-4.629-.504-4.629-1.125V7.019"
    ></path>
  </svg>
)

export const IconK8sElectron = (props:IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg"
    width={props.size}
    height={props.size}
    viewBox="0 0 18.035 17.5"
  >
    <g
      id="g70"
      fillOpacity="1"
      stroke="none"
      strokeDasharray="none"
      strokeMiterlimit="4"
      strokeWidth="0"
      transform="matrix(1.01489 0 0 1.01489 15.91 -3.873)"
    >
      <path
        id="path3055"
        fill="#326ce5"
        strokeOpacity="1"
        d="M-6.85 4.272a1.12 1.11 0 0 0-.428.109l-5.852 2.796a1.12 1.11 0 0 0-.606.753l-1.444 6.282a1.12 1.11 0 0 0 .152.85 1.12 1.11 0 0 0 .064.089l4.05 5.037a1.12 1.11 0 0 0 .876.417l6.496-.001a1.12 1.11 0 0 0 .875-.417l4.049-5.038a1.12 1.11 0 0 0 .216-.939L.152 7.93a1.12 1.11 0 0 0-.605-.753L-6.307 4.38a1.12 1.11 0 0 0-.542-.109"
      ></path>
      <path
        id="path3054-2-9"
        fill="#fff"
        fillRule="nonzero"
        d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
        baselineShift="baseline"
        color="#000"
        direction="ltr"
        display="inline"
        fontFamily="Sans"
        fontSize="medium"
        fontStretch="normal"
        fontStyle="normal"
        fontVariant="normal"
        fontWeight="normal"
        letterSpacing="normal"
        overflow="visible"
        style={{
          lineHeight: "normal",
          textIndent: "0",
          textAlign: "start",
          textDecorationLine: "none",
          textTransform: "none",
          marker: "none",
        }}
        textAnchor="start"
        textDecoration="none"
        visibility="visible"
        wordSpacing="normal"
        writingMode="lr-tb"
      ></path>
    </g>
    <path
      fill="#FFF"
      d="M8.875 2.502c-.665-.001-1.084.652-.752 1.175.333.524 1.167.525 1.501.003l.019-.033c1.25.645 2.164 2.787 2.164 5.278 0 1.055-.162 2.066-.464 2.938-.03.086.024.178.119.205.096.027.197-.021.227-.107.312-.905.48-1.949.48-3.036 0-2.646-.996-4.934-2.43-5.605l.002-.034c0-.433-.388-.784-.866-.784m0 .328c.389 0 .631.38.437.684a.52.52 0 0 1-.437.228c-.387 0-.629-.38-.436-.685a.52.52 0 0 1 .436-.227M5.791 5.022c-1.163.004-2.051.339-2.468.993-.415.651-.297 1.513.286 2.436.07.109.244.11.314 0a.145.145 0 0 0 .001-.163c-.525-.831-.628-1.575-.288-2.11.461-.724 1.706-.995 3.336-.726.138.017.245-.108.192-.225a.18.18 0 0 0-.127-.098 8 8 0 0 0-1.246-.107m6.215.01c-.139.004-.22.145-.145.251.03.044.082.072.14.076 1.032.012 1.775.304 2.109.828.461.723.101 1.831-.967 2.974a.153.153 0 0 0 .022.23c.077.059.19.05.255-.019 1.155-1.235 1.558-2.478 1.003-3.348-.407-.641-1.271-.979-2.417-.992m-1.518.148-.036.004c-1.044.203-2.156.599-3.223 1.157-2.57 1.344-4.27 3.308-4.139 4.774-.582.292-.598 1.046-.028 1.357.135.073.29.112.447.112.667-.022 1.057-.689.703-1.2a.89.89 0 0 0-.703-.367q-.031 0-.063.002C3.39 9.716 4.989 7.891 7.409 6.625c1.036-.542 2.113-.925 3.119-1.121.136-.028.188-.178.092-.271a.18.18 0 0 0-.132-.053M8.869 8.357a1 1 0 0 0-.125.013c-.472.092-.657.612-.332.936.323.323.912.208 1.06-.208.131-.368-.175-.744-.603-.741m-4.199.94a.2.2 0 0 0-.131.042.153.153 0 0 0-.011.232c.712.709 1.639 1.375 2.695 1.928 2.484 1.299 5.121 1.673 6.502.938a.93.93 0 0 0 .504.147c.667.001 1.084-.652.752-1.175-.333-.524-1.166-.525-1.499-.003a.72.72 0 0 0-.006.781c-1.262.618-3.728.254-6.071-.972-1.025-.535-1.922-1.181-2.609-1.864a.2.2 0 0 0-.126-.054m-1.161 2.046c.389 0 .631.38.437.685a.52.52 0 0 1-.437.228c-.387 0-.63-.38-.435-.684a.51.51 0 0 1 .435-.229m10.72 0c.389 0 .63.38.437.685a.52.52 0 0 1-.437.228.54.54 0 0 1-.33-.112l-.004-.005a.2.2 0 0 0-.053-.047c-.248-.27-.08-.683.302-.742a1 1 0 0 1 .085-.007m-7.876.697c-.128-.006-.223.11-.18.219.604 1.528 1.592 2.468 2.702 2.468.81 0 1.56-.5 2.144-1.381a.155.155 0 0 0-.061-.224.19.19 0 0 0-.249.056c-.525.79-1.17 1.222-1.834 1.222-.923 0-1.803-.84-2.361-2.251a.18.18 0 0 0-.161-.109"
    ></path>
  </svg>
)

export const IconK8s = (props:IconProps) => (
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18.035 17.5" width={props.size} height={props.size}>
    <g
      id="g70"
      fillOpacity="1"
      stroke="none"
      strokeDasharray="none"
      strokeMiterlimit="4"
      strokeWidth="0"
      transform="matrix(1.01489 0 0 1.01489 15.91 -3.873)"
    >
      <path
        id="path3055"
        fill="#326ce5"
        strokeOpacity="1"
        d="M-6.85 4.272a1.12 1.11 0 0 0-.428.109l-5.852 2.796a1.12 1.11 0 0 0-.606.753l-1.444 6.282a1.12 1.11 0 0 0 .152.85 1.12 1.11 0 0 0 .064.089l4.05 5.037a1.12 1.11 0 0 0 .876.417l6.496-.001a1.12 1.11 0 0 0 .875-.417l4.049-5.038a1.12 1.11 0 0 0 .216-.939L.152 7.93a1.12 1.11 0 0 0-.605-.753L-6.307 4.38a1.12 1.11 0 0 0-.542-.109"
      ></path>
      <path
        id="path3054-2-9"
        fill="#fff"
        fillRule="nonzero"
        d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
        baselineShift="baseline"
        color="#000"
        direction="ltr"
        display="inline"
        fontFamily="Sans"
        fontSize="medium"
        fontStretch="normal"
        fontStyle="normal"
        fontVariant="normal"
        fontWeight="normal"
        letterSpacing="normal"
        overflow="visible"
        style={{
          lineHeight: "normal",
          textIndent: "0",
          textAlign: "start",
          textDecorationLine: "none",
          textTransform: "none",
          marker: "none",
        }}
        textAnchor="start"
        textDecoration="none"
        visibility="visible"
        wordSpacing="normal"
        writingMode="lr-tb"
      ></path>
    </g>
    <path
      fill="#FFF"
      d="M9.008 2.247c-.204 0-.368.189-.368.42v.01c0 .033-.002.069 0 .098.004.134.033.236.05.359.031.264.056.481.041.684a.4.4 0 0 1-.12.196l-.009.16a4.72 4.72 0 0 0-3.078 1.515l-.133-.097c-.066.009-.132.03-.219-.022-.166-.114-.316-.27-.498-.46-.083-.091-.144-.177-.243-.263a1 1 0 0 0-.082-.068.42.42 0 0 0-.256-.099.36.36 0 0 0-.295.133c-.126.163-.085.413.09.556l.007.006.076.062c.105.08.201.12.305.182.222.14.405.257.55.396.056.062.066.17.074.218l.118.108a4.98 4.98 0 0 0-.753 3.407l-.155.047c-.04.054-.097.138-.158.163-.19.062-.403.084-.662.111-.12.011-.225.005-.353.03-.029.004-.069.015-.099.023l-.004.001-.004.002c-.218.053-.358.257-.313.459s.258.325.477.277h.005l.007-.005c.031-.005.069-.014.095-.02.127-.035.218-.086.331-.131.244-.089.446-.164.643-.193.084-.008.169.052.212.077l.162-.028a4.9 4.9 0 0 0 2.128 2.72l-.067.163c.024.064.05.151.033.214-.072.191-.195.391-.335.614-.068.104-.137.184-.197.302-.015.029-.033.072-.048.102-.094.208-.025.448.158.537.182.091.41-.005.508-.213l.002-.001v-.001c.014-.029.034-.067.045-.096.052-.122.07-.228.106-.346.098-.25.152-.514.286-.679.037-.045.097-.061.159-.079l.084-.154a4.66 4.66 0 0 0 3.405.008l.079.146c.062.02.132.031.188.116.101.177.169.384.254.636.036.119.055.224.106.346l.046.098c.098.208.327.303.51.213.183-.091.252-.33.158-.537l-.049-.101c-.061-.119-.131-.198-.198-.301-.139-.224-.256-.411-.327-.6-.03-.099.005-.16.028-.224-.014-.016-.044-.108-.061-.151a4.9 4.9 0 0 0 2.127-2.74l.158.028c.055-.038.106-.086.206-.078.197.028.399.103.643.194.114.043.205.095.331.13.028.008.065.014.096.022l.008.002.005.001c.219.048.431-.075.476-.276.045-.202-.095-.408-.312-.461-.032-.006-.077-.019-.108-.026-.129-.025-.232-.018-.354-.028-.258-.027-.471-.051-.66-.111-.078-.032-.133-.126-.16-.164l-.149-.045a5 5 0 0 0-.077-1.764 5 5 0 0 0-.691-1.635c.037-.036.109-.101.13-.121.006-.067 0-.139.07-.214.145-.139.327-.254.548-.394.104-.063.201-.104.307-.183.024-.017.056-.048.081-.067.177-.145.218-.395.091-.557-.127-.164-.373-.179-.55-.034-.026.02-.06.047-.083.067-.099.087-.16.174-.244.264-.181.189-.332.347-.497.461-.071.042-.177.027-.224.025l-.141.102a4.8 4.8 0 0 0-3.061-1.515l-.009-.167c-.049-.048-.107-.088-.121-.191-.017-.203.01-.42.042-.684.016-.123.045-.225.05-.359.001-.031-.001-.075-.001-.108 0-.231-.165-.42-.369-.42m-.462 2.93-.11 1.981-.007.004a.33.33 0 0 1-.325.32.32.32 0 0 1-.192-.064l-.003.001-1.587-1.152a3.8 3.8 0 0 1 2.224-1.09m.924 0c.84.106 1.616.494 2.212 1.091l-1.577 1.144-.006-.002a.32.32 0 0 1-.446-.062.34.34 0 0 1-.072-.191l-.001-.001zm-3.723 1.83 1.448 1.327-.001.009a.336.336 0 0 1-.127.572l-.002.007-1.858.549a3.97 3.97 0 0 1 .54-2.464m6.513.001a4.02 4.02 0 0 1 .556 2.455l-1.867-.55-.002-.008a.33.33 0 0 1-.231-.395.33.33 0 0 1 .103-.177l-.001-.005zM8.711 8.436h.594l.369.474-.133.588-.533.263-.534-.263-.132-.589zm1.904 1.617a.3.3 0 0 1 .074.006l.004-.005 1.921.333a3.9 3.9 0 0 1-1.539 1.978l-.746-1.843.003-.005a.335.335 0 0 1 .157-.431.3.3 0 0 1 .126-.033m-3.228.008a.326.326 0 0 1 .313.258.34.34 0 0 1-.019.206l.006.006-.738 1.827a3.9 3.9 0 0 1-1.534-1.965l1.906-.331.002.004a.4.4 0 0 1 .064-.005m1.609.8a.33.33 0 0 1 .299.175h.006l.94 1.736q-.187.064-.376.108a3.74 3.74 0 0 1-2.083-.11l.938-1.733h.001a.32.32 0 0 1 .275-.176"
      color="#000"
      fontFamily="Sans"
      fontWeight="400"
      overflow="visible"
      style={{
        lineHeight: "normal",
        textIndent: "0",
        textAlign: "start",
        textTransform: "none",
        marker: "none",
      }}
    ></path>
  </svg>
)

export const IconK8sBlank = (props:IconProps) => (
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18.035 17.5"  width={props.size}    height={props.size}>
    <path
      fill="#326ce5"
      d="M8.958.463a1.137 1.127 0 0 0-.434.11l-5.94 2.838a1.137 1.127 0 0 0-.615.764L.504 10.551a1.137 1.127 0 0 0 .154.862 1.137 1.127 0 0 0 .065.09l4.11 5.113a1.137 1.127 0 0 0 .89.423l6.592-.001a1.137 1.127 0 0 0 .888-.423l4.11-5.113a1.137 1.127 0 0 0 .219-.953l-1.468-6.374a1.137 1.127 0 0 0-.614-.764L9.51.572a1.137 1.127 0 0 0-.551-.11"
    ></path>
    <path
      fill="#fff"
      d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
      color="#000"
      fontFamily="Sans"
      fontWeight="400"
      overflow="visible"
      style={{
        lineHeight: "normal",
        textIndent: "0",
        textAlign: "start",
        textDecorationLine: "none",
        textTransform: "none",
        marker: "none",
      }}
      transform="translate(15.91 -3.873)scale(1.01489)"
    ></path>
  </svg>
)

export const IconK8sUnknown = (props:IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18.035 17.5"  width={props.size}    height={props.size}>
    <g
      id="g70"
      fillOpacity="1"
      stroke="none"
      strokeDasharray="none"
      strokeMiterlimit="4"
      strokeWidth="0"
      transform="matrix(1.01489 0 0 1.01489 15.91 -3.873)"
    >
      <path
        id="path3055"
        fill="#326ce5"
        strokeOpacity="1"
        d="M-6.85 4.272a1.12 1.11 0 0 0-.428.109l-5.852 2.796a1.12 1.11 0 0 0-.606.753l-1.444 6.282a1.12 1.11 0 0 0 .152.85 1.12 1.11 0 0 0 .064.089l4.05 5.037a1.12 1.11 0 0 0 .876.417l6.496-.001a1.12 1.11 0 0 0 .875-.417l4.049-5.038a1.12 1.11 0 0 0 .216-.939L.152 7.93a1.12 1.11 0 0 0-.605-.753L-6.307 4.38a1.12 1.11 0 0 0-.542-.109"
      ></path>
      <path
        id="path3054-2-9"
        fill="#fff"
        fillRule="nonzero"
        d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
        baselineShift="baseline"
        color="#000"
        direction="ltr"
        display="inline"
        fontFamily="Sans"
        fontSize="medium"
        fontStretch="normal"
        fontStyle="normal"
        fontVariant="normal"
        fontWeight="normal"
        letterSpacing="normal"
        overflow="visible"
        style={{
          lineHeight: "normal",
          textIndent: "0",
          textAlign: "start",
          textDecorationLine: "none",
          textTransform: "none",
          marker: "none",
        }}
        textAnchor="start"
        textDecoration="none"
        visibility="visible"
        wordSpacing="normal"
        writingMode="lr-tb"
      ></path>
    </g>
    <text
      x="2.463"
      y="19.68"
      fill="#FFF"
      fontFamily="Arial, sans-serif"
      fontSize="28"
      fontWeight="700"
      style={{ whiteSpace: "pre" }}
      transform="matrix(.44875 0 0 .41027 4.014 5.045)"
    >
      ?
    </text>
  </svg>
)

export const IconDeployment = (props:IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18.035 17.5"  width={props.size}    height={props.size}>
    <g
      id="g70"
      fillOpacity="1"
      stroke="none"
      strokeDasharray="none"
      strokeMiterlimit="4"
      strokeWidth="0"
      transform="matrix(1.01489 0 0 1.01489 15.91 -3.873)"
    >
      <path
        id="path3055"
        fill="#326ce5"
        strokeOpacity="1"
        d="M-6.85 4.272a1.12 1.11 0 0 0-.428.109l-5.852 2.796a1.12 1.11 0 0 0-.606.753l-1.444 6.282a1.12 1.11 0 0 0 .152.85 1.12 1.11 0 0 0 .064.089l4.05 5.037a1.12 1.11 0 0 0 .876.417l6.496-.001a1.12 1.11 0 0 0 .875-.417l4.049-5.038a1.12 1.11 0 0 0 .216-.939L.152 7.93a1.12 1.11 0 0 0-.605-.753L-6.307 4.38a1.12 1.11 0 0 0-.542-.109"
      ></path>
      <path
        id="path3054-2-9"
        fill="#fff"
        fillRule="nonzero"
        d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
        baselineShift="baseline"
        color="#000"
        direction="ltr"
        display="inline"
        fontFamily="Sans"
        fontSize="medium"
        fontStretch="normal"
        fontStyle="normal"
        fontVariant="normal"
        fontWeight="normal"
        letterSpacing="normal"
        overflow="visible"
        style={{
          lineHeight: "normal",
          textIndent: "0",
          textAlign: "start",
          textDecorationLine: "none",
          textTransform: "none",
          marker: "none",
        }}
        textAnchor="start"
        textDecoration="none"
        visibility="visible"
        wordSpacing="normal"
        writingMode="lr-tb"
      ></path>
    </g>
    <text
      x="3.382"
      y="12.092"
      fill="#FFEFEF"
      fontFamily="Arial, sans-serif"
      fontSize="8"
      style={{ whiteSpace: "pre" }}
      transform="matrix(1.16478 0 0 1.25539 -.766 -3.069)"
    >
      Dp
    </text>
  </svg>
)

export const IconJob = (props:IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18.035 17.5"  width={props.size}    height={props.size}>
    <path
      fill="#326ce5"
      d="M8.958.463a1.137 1.127 0 0 0-.434.11l-5.94 2.838a1.137 1.127 0 0 0-.615.764L.504 10.551a1.137 1.127 0 0 0 .154.862 1.137 1.127 0 0 0 .065.09l4.11 5.113a1.137 1.127 0 0 0 .89.423l6.592-.001a1.137 1.127 0 0 0 .888-.423l4.11-5.113a1.137 1.127 0 0 0 .219-.953l-1.468-6.374a1.137 1.127 0 0 0-.614-.764L9.51.572a1.137 1.127 0 0 0-.551-.11"
    ></path>
    <path
      fill="#fff"
      d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
      color="#000"
      fontFamily="Sans"
      fontWeight="400"
      overflow="visible"
      style={{
        lineHeight: "normal",
        textIndent: "0",
        textAlign: "start",
        textDecorationLine: "none",
        textTransform: "none",
        marker: "none",
      }}
      transform="translate(15.91 -3.873)scale(1.01489)"
    ></path>
    <text
      x="3.382"
      y="12.092"
      fill="#ffefef"
      fontFamily="Arial,sans-serif"
      fontSize="7.169"
      style={{ whiteSpace: "pre" }}
      transform="matrix(1.16478 0 0 1.25539 -1.912 -2.889)"
    >
      Job
    </text>
  </svg>
)

export const IconStatefulSet = (props:IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18.035 17.5"  width={props.size}    height={props.size}>
    <path
      fill="#326ce5"
      d="M8.958.463a1.137 1.127 0 0 0-.434.11l-5.94 2.838a1.137 1.127 0 0 0-.615.764L.504 10.551a1.137 1.127 0 0 0 .154.862 1.137 1.127 0 0 0 .065.09l4.11 5.113a1.137 1.127 0 0 0 .89.423l6.592-.001a1.137 1.127 0 0 0 .888-.423l4.11-5.113a1.137 1.127 0 0 0 .219-.953l-1.468-6.374a1.137 1.127 0 0 0-.614-.764L9.51.572a1.137 1.127 0 0 0-.551-.11"
    ></path>
    <path
      fill="#fff"
      d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
      color="#000"
      fontFamily="Sans"
      fontWeight="400"
      overflow="visible"
      style={{
        lineHeight: "normal",
        textIndent: "0",
        textAlign: "start",
        textDecorationLine: "none",
        textTransform: "none",
        marker: "none",
      }}
      transform="translate(15.91 -3.873)scale(1.01489)"
    ></path>
    <text
      x="3.382"
      y="12.092"
      fill="#ffefef"
      fontFamily="Arial,sans-serif"
      fontSize="8"
      style={{ whiteSpace: "pre" }}
      transform="matrix(1.16478 0 0 1.25539 -1.388 -2.748)"
    >
      SS
    </text>
  </svg>  
)

export const IconDaemonSet = (props:IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18.035 17.5"  width={props.size}    height={props.size}>
    <path
      fill="#326ce5"
      d="M8.958.463a1.137 1.127 0 0 0-.434.11l-5.94 2.838a1.137 1.127 0 0 0-.615.764L.504 10.551a1.137 1.127 0 0 0 .154.862 1.137 1.127 0 0 0 .065.09l4.11 5.113a1.137 1.127 0 0 0 .89.423l6.592-.001a1.137 1.127 0 0 0 .888-.423l4.11-5.113a1.137 1.127 0 0 0 .219-.953l-1.468-6.374a1.137 1.127 0 0 0-.614-.764L9.51.572a1.137 1.127 0 0 0-.551-.11"
    ></path>
    <path
      fill="#fff"
      d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
      color="#000"
      fontFamily="Sans"
      fontWeight="400"
      overflow="visible"
      style={{
        lineHeight: "normal",
       textIndent: "0",
        textAlign: "start",
        textDecorationLine: "none",
        textTransform: "none",
        marker: "none",
      }}
      transform="translate(15.91 -3.873)scale(1.01489)"
    ></path>
    <text
      x="3.382"
      y="12.092"
      fill="#ffefef"
      fontFamily="Arial,sans-serif"
      fontSize="8"
      style={{ whiteSpace: "pre" }}
      transform="matrix(1.16478 0 0 1.25539 -1.388 -2.748)"
    >
      DS
    </text>
  </svg>  
)

export const IconReplicationController = (props:IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18.035 17.5"  width={props.size}    height={props.size}>
    <path
      fill="#326ce5"
      d="M8.958.463a1.137 1.127 0 0 0-.434.11l-5.94 2.838a1.137 1.127 0 0 0-.615.764L.504 10.551a1.137 1.127 0 0 0 .154.862 1.137 1.127 0 0 0 .065.09l4.11 5.113a1.137 1.127 0 0 0 .89.423l6.592-.001a1.137 1.127 0 0 0 .888-.423l4.11-5.113a1.137 1.127 0 0 0 .219-.953l-1.468-6.374a1.137 1.127 0 0 0-.614-.764L9.51.572a1.137 1.127 0 0 0-.551-.11"
    ></path>
    <path
      fill="#fff"
      d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
      color="#000"
      fontFamily="Sans"
      fontWeight="400"
      overflow="visible"
      style={{
        lineHeight: "normal",
       textIndent: "0",
        textAlign: "start",
        textDecorationLine: "none",
        textTransform: "none",
        marker: "none",
      }}
      transform="translate(15.91 -3.873)scale(1.01489)"
    ></path>
    <text
      x="3.382"
      y="12.092"
      fill="#ffefef"
      fontFamily="Arial,sans-serif"
      fontSize="8"
      style={{ whiteSpace: "pre" }}
      transform="matrix(1.16478 0 0 1.25539 -1.388 -2.748)"
    >
      DS
    </text>
  </svg>  
)

export const IconCronJob = (props:IconProps) => (
<svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size}
    height={props.size}
    viewBox="0 0 18.035 17.5"
  >
    <path
      fill="#326ce5"
      d="M8.958.463a1.137 1.127 0 0 0-.434.11l-5.94 2.838a1.137 1.127 0 0 0-.615.764L.504 10.551a1.137 1.127 0 0 0 .154.862 1.137 1.127 0 0 0 .065.09l4.11 5.113a1.137 1.127 0 0 0 .89.423l6.592-.001a1.137 1.127 0 0 0 .888-.423l4.11-5.113a1.137 1.127 0 0 0 .219-.953l-1.468-6.374a1.137 1.127 0 0 0-.614-.764L9.51.572a1.137 1.127 0 0 0-.551-.11"
    ></path>
    <path
      fill="#fff"
      d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
      color="#000"
      fontFamily="Sans"
      fontWeight="400"
      overflow="visible"
      style={{
        lineHeight: "normal",
        textIndent: "0",
        textAlign: "start",
        textDecorationLine: "none",
        textTransform: "none",
        marker: "none",
      }}
      transform="translate(15.91 -3.873)scale(1.01489)"
    ></path>
    <text
      xmlSpace="preserve"
      x="10.011"
      y="16.812"
      fill="#fff"
      strokeWidth="0.265"
      fontFamily="Sans"
      fontSize="10.583"
      fontWeight="400"
      letterSpacing="0"
      style={{ lineHeight: "6.61458349px" }}
      transform="translate(-.993 -1.174)"
      wordSpacing="0"
    >
      <tspan x="10.011" y="16.812" style={{fontStyle:'normal',fontVariant:'normal',fontWeight:400,fontStretch:'normal',fontSize:'2.82222223px',fontFamily:'Arial',textAlign:'center',fill:'#fff',fillOpacity:1,strokeWidth:'.26458332px'}} text-anchor="middle">cronjob</tspan>
    </text>
    <path
      fill="#fff"
      d="M10.103 2.786v2.143h2.202V2.786zm0 3.084v.546c.258-.06.526-.097.803-.097.497 0 .97.106 1.4.295V5.87zm-6.284.033v2.143h2.203V5.903zm3.142 0v2.143h.928c.31-.52.75-.955 1.275-1.258v-.885zM3.798 9.02v2.143h2.203V9.02zm3.152 0v2.143h.707a3.5 3.5 0 0 1-.265-1.33c0-.28.037-.551.1-.813zM11.038 6.766a3.21 3.21 0 0 0-3.2 3.2c0 1.76 1.44 3.2 3.2 3.2s3.2-1.44 3.2-3.2-1.44-3.2-3.2-3.2m1.344 4.543-1.664-1.024V8.366h.48v1.664l1.44.864z"
    ></path>
  </svg>
)

export const IconAPIResource = (props:IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    id="svg11531"
    width={props.size}
    height={props.size}
    version="1.1"
    viewBox="0 0 18.035 17.5"
  >
    <g id="layer1" fillOpacity="1" transform="translate(-.993 -1.174)">
      <g
        id="g70"
        stroke="none"
        strokeDasharray="none"
        strokeMiterlimit="4"
        strokeWidth="0"
        transform="matrix(1.01489 0 0 1.01489 16.902 -2.699)"
      >
        <path
          id="path3055"
          fill="#326ce5"
          strokeOpacity="1"
          d="M-6.85 4.272a1.12 1.11 0 0 0-.428.109l-5.852 2.796a1.12 1.11 0 0 0-.606.753l-1.444 6.282a1.12 1.11 0 0 0 .152.85 1.12 1.11 0 0 0 .064.089l4.05 5.037a1.12 1.11 0 0 0 .876.417l6.496-.001a1.12 1.11 0 0 0 .875-.417l4.049-5.038a1.12 1.11 0 0 0 .216-.939L.152 7.93a1.12 1.11 0 0 0-.605-.753L-6.307 4.38a1.12 1.11 0 0 0-.542-.109"
        ></path>
        <path
          id="path3054-2-9"
          fill="#fff"
          fillRule="nonzero"
          d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
          baselineShift="baseline"
          color="#000"
          direction="ltr"
          display="inline"
          fontFamily="Sans"
          fontSize="medium"
          fontStretch="normal"
          fontStyle="normal"
          fontVariant="normal"
          fontWeight="normal"
          letterSpacing="normal"
          overflow="visible"
          style={{
            lineHeight: "normal",
            textIndent: "0",
            textAlign: "start",
            textDecorationLine: "none",
            textTransform: "none",
            marker: "none",
          }}
          textAnchor="start"
          textDecoration="none"
          visibility="visible"
          wordSpacing="normal"
          writingMode="lr-tb"
        ></path>
      </g>
      <text
        xmlSpace="preserve"
        id="text2066"
        x="10.056"
        y="16.812"
        fill="#fff"
        stroke="none"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        strokeOpacity="1"
        strokeWidth="0.265"
        fontFamily="Sans"
        fontSize="10.583"
        fontStyle="normal"
        fontWeight="normal"
        letterSpacing="0"
        style={{ lineHeight: "6.61458349px" }}
        wordSpacing="0"
      >
<tspan
         style={{fontStyle:'normal',fontVariant:'normal',fontWeight:'normal',fontStretch:'normal',fontSize:'2.82222223px',fontFamily:'Arial',textAlign:'center',fill:'#ffffff',fillOpacity:1,strokeWidth:'0.26458332px'}}
         text-anchor="middle"
         y="16.811775"
         x="10.055769"
         id="tspan2064">api</tspan>
      </text>
      <path
        id="path1984"
        fill="#fff"
        stroke="#eee"
        strokeDasharray="none"
        strokeDashoffset="11.236"
        strokeMiterlimit="10"
        strokeOpacity="1"
        strokeWidth="0"
        d="M9.992 4.447c-.138-.004-3.995 1.892-4.045 1.989-.122.234-1 4.281-.948 4.369.03.05.662.852 1.405 1.78l1.35 1.688 2.221.001 2.222.001 1.413-1.765 1.413-1.766-.494-2.168c-.272-1.193-.516-2.189-.54-2.213-.07-.067-3.922-1.913-3.997-1.916Zm.236 1.983c.187.008.206.291.606.321.521.04.465-.446.864-.108.4.338-.089.362.035.87.124.509.569.306.37.79s-.372.027-.817.302-.114.635-.636.596-.14-.346-.54-.684c-.398-.338-.64.087-.764-.42-.124-.509.286-.242.485-.726.198-.484-.282-.58.163-.856a.7.7 0 0 1 .142-.07.3.3 0 0 1 .092-.015zm.522.572a.758.758 0 0 0-.73.976.757.757 0 1 0 .73-.976ZM7.757 8.304q.06 0 .149.027c.48.147-.008.4.334.767s.628-.101.741.388c.112.49-.35.193-.497.673s.401.494.034.836-.342-.206-.831-.094c-.49.113-.227.595-.707.448s.008-.4-.334-.767-.629.1-.741-.389c-.113-.489.35-.193.497-.672S6 9.027 6.367 8.685c.368-.342.342.206.832.094.428-.099.28-.48.558-.475zm3.567.524q.068 0 .17.04c.554.214-.175.545.254.955.43.41.728-.332.967.21.24.544-.51.263-.497.856.013.594.75.28.535.832-.215.554-.546-.175-.956.254-.41.43.332.727-.211.967-.543.239-.261-.51-.855-.497-.593.013-.279.749-.832.534-.554-.214.175-.546-.254-.956s-.727.333-.966-.21c-.24-.543.51-.262.496-.855-.013-.594-.75-.28-.535-.833s.547.176.957-.253-.333-.728.21-.967c.543-.24.262.51.855.497.52-.012.344-.577.662-.574zm-3.88.255a.757.757 0 1 0-.002 1.514.757.757 0 0 0 .001-1.514Zm3.253.725a1.115 1.115 0 1 0 0 2.231 1.115 1.115 0 0 0 0-2.23z"
        opacity="1"
      ></path>
    </g>
  </svg>
)

export const IconAks = (props:IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18"  width={props.size}    height={props.size}>
    <defs>
      <linearGradient
        id="a"
        x1="2.94"
        x2="8.67"
        y1="3.74"
        y2="3.74"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#b77af4"></stop>
        <stop offset="1" stopColor="#773adc"></stop>
      </linearGradient>
      <linearGradient
        id="b"
        x1="9.13"
        x2="14.85"
        y1="3.79"
        y2="3.79"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#b77af4"></stop>
        <stop offset="1" stopColor="#773adc"></stop>
      </linearGradient>
      <linearGradient
        id="c"
        x1="0.01"
        x2="5.73"
        y1="9.12"
        y2="9.12"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#b77af4"></stop>
        <stop offset="1" stopColor="#773adc"></stop>
      </linearGradient>
      <linearGradient
        id="d"
        x1="6.18"
        x2="11.9"
        y1="9.08"
        y2="9.08"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#b77af4"></stop>
        <stop offset="1" stopColor="#773adc"></stop>
      </linearGradient>
      <linearGradient
        id="e"
        x1="12.35"
        x2="18.08"
        y1="9.13"
        y2="9.13"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#b77af4"></stop>
        <stop offset="1" stopColor="#773adc"></stop>
      </linearGradient>
      <linearGradient
        id="f"
        x1="2.87"
        x2="8.6"
        y1="14.56"
        y2="14.56"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#b77af4"></stop>
        <stop offset="1" stopColor="#773adc"></stop>
      </linearGradient>
      <linearGradient
        id="g"
        x1="9.05"
        x2="14.78"
        y1="14.6"
        y2="14.6"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#b77af4"></stop>
        <stop offset="1" stopColor="#773adc"></stop>
      </linearGradient>
    </defs>
    <path
      fill="url(#a)"
      d="m5.8 1.22-2.86.53v3.9l2.86.61 2.87-1.15V2.2z"
    ></path>
    <path
      fill="none"
      d="m5.91 6.2 2.62-1.06A.2.2 0 0 0 8.65 5V2.36a.21.21 0 0 0-.13-.18l-2.65-.9h-.12l-2.6.48a.2.2 0 0 0-.15.18v3.53a.19.19 0 0 0 .15.19l2.63.55a.3.3 0 0 0 .13-.01"
    ></path>
    <path
      fill="#341a6e"
      d="M2.94 1.75v3.9l2.89.61v-5Zm1.22 3.6-.81-.16v-3l.81-.13Zm1.26.23-.93-.15V2l.93-.16Z"
    ></path>
    <path
      fill="url(#b)"
      d="m11.99 1.27-2.86.53v3.9l2.86.61 2.86-1.16v-2.9z"
    ></path>
    <path
      fill="#341a6e"
      d="M9.13 1.8v3.9l2.87.61v-5Zm1.21 3.6-.81-.16v-3l.81-.13Zm1.26.23-.93-.15V2.05l.93-.17Z"
    ></path>
    <path
      fill="url(#c)"
      d="m2.87 6.6-2.86.53v3.9l2.86.61 2.87-1.15V7.58z"
    ></path>
    <path
      fill="#341a6e"
      d="M0 7.13V11l2.89.61v-5Zm1.21 3.61-.81-.17v-3l.81-.14Zm1.27.26-.93-.15V7.38l.93-.16Z"
    ></path>
    <path
      fill="url(#d)"
      d="m9.04 6.56-2.86.53v3.9l2.86.62 2.86-1.16V7.54z"
    ></path>
    <path
      fill="#341a6e"
      d="M6.18 7.09V11l2.88.61v-5Zm1.21 3.61-.81-.17v-3l.81-.14Zm1.26.22-.93-.15V7.34l.93-.16Z"
    ></path>
    <path
      fill="url(#e)"
      d="m15.21 6.61-2.86.53v3.9l2.86.61 2.87-1.15V7.59z"
    ></path>
    <path
      fill="#341a6e"
      d="M12.35 7.14V11l2.89.61v-5Zm1.22 3.61-.81-.17v-3l.81-.14Zm1.26.22-.93-.15V7.39l.93-.16Z"
    ></path>
    <path
      fill="url(#f)"
      d="m5.73 12.04-2.86.52v3.9l2.86.62 2.87-1.16v-2.9z"
    ></path>
    <path
      fill="none"
      d="m5.84 17 2.61-1a.18.18 0 0 0 .12-.18v-2.6a.2.2 0 0 0-.13-.22l-2.64-.9a.17.17 0 0 0-.12 0l-2.6.47a.19.19 0 0 0-.16.19v3.54a.19.19 0 0 0 .15.19L5.7 17a.23.23 0 0 0 .14 0"
    ></path>
    <path
      fill="#341a6e"
      d="M2.87 12.56v3.9l2.89.62V12Zm1.22 3.61L3.28 16v-3l.81-.14Zm1.26.23-.93-.15v-3.44l.93-.16Z"
    ></path>
    <path
      fill="url(#g)"
      d="m11.91 12.08-2.86.53v3.9l2.86.61 2.87-1.15v-2.91z"
    ></path>
    <path
      fill="#341a6e"
      d="M9.05 12.61v3.9l2.89.61v-5Zm1.22 3.61-.81-.17v-3l.81-.14Zm1.26.22-.93-.15v-3.43l.93-.16Z"
    ></path>
  </svg>
)

export const IconNode = (props:IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    id="svg13826"
    width={props.size}
    height={props.size}
    version="1.1"
    viewBox="0 0 18.035 17.5"
  >
    <g id="layer1" fillOpacity="1" transform="translate(-.993 -1.174)">
      <g
        id="g70"
        stroke="none"
        strokeDasharray="none"
        strokeMiterlimit="4"
        strokeWidth="0"
        transform="matrix(1.01489 0 0 1.01489 16.902 -2.699)"
      >
        <path
          id="path3055"
          fill="#326ce5"
          strokeOpacity="1"
          d="M-6.85 4.272a1.12 1.11 0 0 0-.428.109l-5.852 2.796a1.12 1.11 0 0 0-.606.753l-1.444 6.282a1.12 1.11 0 0 0 .152.85 1.12 1.11 0 0 0 .064.089l4.05 5.037a1.12 1.11 0 0 0 .876.417l6.496-.001a1.12 1.11 0 0 0 .875-.417l4.049-5.038a1.12 1.11 0 0 0 .216-.939L.152 7.93a1.12 1.11 0 0 0-.605-.753L-6.307 4.38a1.12 1.11 0 0 0-.542-.109"
        ></path>
        <path
          id="path3054-2-9"
          fill="#fff"
          fillRule="nonzero"
          d="M-6.852 3.818a1.181 1.172 0 0 0-.452.115l-6.18 2.951a1.181 1.172 0 0 0-.638.795l-1.524 6.63a1.181 1.172 0 0 0 .16.9 1.181 1.172 0 0 0 .067.093l4.276 5.317a1.181 1.172 0 0 0 .924.44h6.858a1.181 1.172 0 0 0 .923-.44L1.837 15.3a1.181 1.172 0 0 0 .228-.99L.54 7.677a1.181 1.172 0 0 0-.64-.795l-6.178-2.95a1.181 1.172 0 0 0-.573-.115m.003.455a1.12 1.11 0 0 1 .542.108l5.853 2.795a1.12 1.11 0 0 1 .606.753l1.446 6.281a1.12 1.11 0 0 1-.216.94l-4.05 5.037a1.12 1.11 0 0 1-.875.417l-6.496.001a1.12 1.11 0 0 1-.875-.417l-4.05-5.037a1.12 1.11 0 0 1-.064-.088 1.12 1.11 0 0 1-.152-.851l1.444-6.281a1.12 1.11 0 0 1 .605-.753l5.853-2.797a1.12 1.11 0 0 1 .429-.108"
          baselineShift="baseline"
          color="#000"
          direction="ltr"
          display="inline"
          fontFamily="Sans"
          fontSize="medium"
          fontStretch="normal"
          fontStyle="normal"
          fontVariant="normal"
          fontWeight="normal"
          letterSpacing="normal"
          overflow="visible"
          style={{
            lineHeight: "normal",
            textIndent: "0",
            textAlign: "start",
            textDecorationLine: "none",
            textTransform: "none",
            marker: "none",
          }}
          textAnchor="start"
          textDecoration="none"
          visibility="visible"
          wordSpacing="normal"
          writingMode="lr-tb"
        ></path>
      </g>
      <text>
        <tspan
          x="10.017"
          y="16.812"
          style={{
            fontStyle: 'normal',
            fontVariant: 'normal',
            fontWeight: 400,
            fontStretch: 'normal',
            fontSize: '2.82222223px',
            fontFamily: 'Arial, Helvetica, sans-serif',
            textAlign: 'center',
            fill: '#fff',
            fillOpacity: 1,
            strokeWidth: '.26458332px',
            textTransform: 'lowercase',
            textRendering: 'geometricPrecision' 
          }}
          textAnchor="middle"
        >
          node
        </tspan>
      </text>
      <path
        id="path1994"
        fill="#fff"
        stroke="#eee"
        strokeDasharray="none"
        strokeDashoffset="11.236"
        strokeMiterlimit="10"
        strokeOpacity="1"
        strokeWidth="0"
        d="M9.992 4.094c-.138-.004-3.995 1.892-4.045 1.99-.122.233-1 4.281-.948 4.368.03.051.663.852 1.405 1.78l1.35 1.689h2.22l2.223.002 1.413-1.766 1.413-1.765-.494-2.169c-.273-1.193-.516-2.188-.54-2.212-.07-.067-3.922-1.914-3.997-1.917zm.196.948.91.264-.91.263-.909-.263zm-.909.365.852.253-.004 1.183-.847-.47zm1.818 0v.967l-.847.469-.004-1.183zM8.9 7.02l.909.264-.91.263-.908-.263Zm2.208 0 .91.264-.91.263-.908-.263zm-3.117.365.851.253-.004 1.183-.847-.47zm1.818 0v.967l-.847.469-.004-1.183zm.39 0 .852.253-.004 1.183-.847-.47zm1.818 0v.967l-.846.469-.004-1.183zM8.567 8.9c.271.01.062.282.37.428.327.155.395-.236.6.063.206.299-.183.223-.154.585.03.362.402.225.246.553-.156.327-.285-.048-.584.158s.006.46-.356.49c-.361.028-.101-.271-.429-.427s-.395.235-.601-.064.184-.223.155-.584c-.03-.362-.402-.225-.246-.553s.285.048.583-.158c.3-.206-.006-.46.356-.49zm2.337.363c.483.013.014.467.456.664.441.198.467-.454.799-.102.332.351-.32.34-.147.792.172.452.651.01.638.493s-.468.014-.665.456c-.198.441.454.467.102.8-.351.331-.34-.32-.792-.148-.451.172-.009.651-.492.638-.484-.014-.015-.468-.456-.665-.442-.198-.468.454-.8.102-.332-.351.32-.34.148-.792-.173-.451-.652-.009-.638-.492.013-.484.467-.015.664-.457.198-.441-.454-.467-.102-.799.351-.332.34.32.792.148s.01-.652.493-.638zm-2.315.253a.532.532 0 1 0 0 1.063.532.532 0 0 0 0-1.063zm2.264.48a1.062 1.062 0 1 0 0 2.125 1.062 1.062 0 0 0 0-2.124z"
        opacity="1"
      ></path>
    </g>
  </svg>
)

export const IconEks = (props:IconProps) => (

  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size}
    height={props.size}
    viewBox="0 0 80 80"
  >
    <defs>
      <linearGradient id="a" x1="0%" x2="100%" y1="100%" y2="0%">
        <stop offset="0%" stopColor="#c8511b"></stop>
        <stop offset="100%" stopColor="#f90"></stop>
      </linearGradient>
    </defs>
    <g fill="none" fillRule="evenodd">
      <path fill="url(#a)" d="M0 0h80v80H0z"></path>
      <path
        fill="#fff"
        d="m61.239 61.377-21.502-.022c-2.604-.003-4.831-1.939-5.07-4.406a7 7 0 0 1-.031-.644c0-3.376 2.332-4.507 3.755-4.883a1 1 0 0 0 .788-1.122 8 8 0 0 1-.051-.904c0-2.783 1.918-5.775 4.366-6.812 4.251-1.798 7.26.567 8.358 1.669.899.901 1.601 2.056 2.086 3.431a1.001 1.001 0 0 0 1.748.261c.636-.86 1.666-1.237 2.621-.957 1.17.342 1.946 1.553 2.086 3.25a1 1 0 0 0 .825 1.082c1.369.236 4.551 1.197 4.551 5.036 0 4.483-4.143 4.982-4.53 5.021m-23.795 4.485L14 53.398V26.57l20-11.818v9.699l-10.537 6.705A1 1 0 0 0 23 32v16c0 .373.208.714.538.887l9.363 4.871.139.077a7.7 7.7 0 0 0-.404 2.47q.001.433.041.835c.335 3.481 3.436 6.211 7.058 6.215l2.247.001zm15.06-34.726L41 24.425v-9.673L61 26.57v19.897a4.4 4.4 0 0 0-2.132-1.399 4.31 4.31 0 0 0-3.623.569 10.5 10.5 0 0 0-1.977-2.796c-.086-.086-.18-.152-.268-.235V32a1 1 0 0 0-.496-.864M63 49.726V26a1 1 0 0 0-.491-.861l-22-13A1 1 0 0 0 39 13v12c0 .355.188.684.496.863L51 32.574v8.544c-2.517-1.404-5.463-1.57-8.285-.376-.99.419-1.888 1.086-2.678 1.887l-3.026-3.509 6.831-7.921H41.18L35 38v-7h-2v17h2v-8l3.682 4.311c-.968 1.53-1.554 3.322-1.554 5.085q0 .164.005.327c-1.348.493-2.421 1.304-3.187 2.35L25 47.393V32.548l10.537-6.705A1 1 0 0 0 36 25V13c0-.359-.193-.691-.504-.869a1 1 0 0 0-1.005.008l-22 13A1 1 0 0 0 12 26v28a1 1 0 0 0 .53.882l24.453 13a1 1 0 0 0 .953-.007l8.178-4.515 15.205.014c2.232-.182 6.45-1.882 6.45-7.018 0-3.678-2.264-5.753-4.769-6.63"
      ></path>
    </g>
  </svg>  
)


export const getIconFromKind = (kind:string, size:number) => {
    switch (kind) {
        case 'Namespace': return <IconNamespace size={size}/>
        case 'Job': return <IconJob size={size}/>
        case 'CronJob': return <IconCronJob size={size}/>
        case 'Pod': return <IconPod size={size}/>
        case 'Deployment': return <IconDeployment size={size}/>
        case 'ReplicaSet': return <IconReplicaSet size={size}/>
        case 'DaemonSet': return <IconDaemonSet size={size}/>
        case 'StatefulSet': return <IconStatefulSet size={size}/>
        case 'ReplicationController': return <IconReplicationController size={size}/>
        case 'ConfigMap': return <IconConfigMap height={size}/>
        case 'Secret': return <IconSecret height={size}/>
        case 'Service': return <IconService height={size}/>
        case 'Endpoints': return <IconEndpoints height={size}/>
        case 'Ingress': return <IconIngress height={size}/>
        case 'PersistentVolume': return <IconPersistentVolume height={size}/>
        case 'PersistentVolumeClaim': return <IconPersistentVolumeClaim height={size}/>
        case 'Role': return <IconRole height={size}/>
        case 'RoleBinding': return <IconRoleBinding height={size}/>
        case 'ClusterRole': return <IconClusterRole height={size}/>
        case 'ClusterRoleBinding': return <IconClusterRoleBinding height={size}/>
        case 'V1APIResource': return <IconAPIResource size={size}/>
        
        default: return <IconBlank size={size}/>
    }
}