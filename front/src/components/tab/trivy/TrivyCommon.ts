import { green, red, yellow } from "@mui/material/colors"
import { TrivyObject } from "../../../model/TrivyObject"

const assetScore = (asset:any, trivyObject:TrivyObject) => {
    let maxScore = (trivyObject.maxCritical>=0? trivyObject.maxCritical*4:0) +
        (trivyObject.maxHigh>=0? trivyObject.maxHigh*4:0) +
        (trivyObject.maxMedium>=0? trivyObject.maxMedium*4:0) +
        (trivyObject.maxLow>=0? trivyObject.maxLow*4:0)

    let asssumm = asset.report.summary
    let score = (trivyObject.maxCritical>=0? asssumm.criticalCount*4 : 0) + (trivyObject.maxHigh>=0? asssumm.highCount*4 : 0) + (trivyObject.maxMedium>=0? asssumm.mediumCount*4 : 0) + (trivyObject.maxLow>=0? asssumm.lowCount*4 : 0)
    let value = (1.0 - (score / maxScore)) * 100.0
    return value
}

const assetScoreColor = (asset:any, trivyObject:TrivyObject) => {
    let score = assetScore(asset, trivyObject)
    if (score>=50) return green[400]
    if (score>=0) return yellow[700]
    return red[500]
}

export { assetScore, assetScoreColor }