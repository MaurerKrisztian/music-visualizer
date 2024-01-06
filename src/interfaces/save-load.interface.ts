import {ISimpleBarSettings} from "../elements/barAnimation"
import {
    IBackgroundSettings,
    ICircleSettings,
    IEnableVisuals,
    IRenderingSettings,
    ITextSettings
} from "./settings.interface"


export interface ISaveOptions {
    text: ITextSettings
    circle: ICircleSettings
    background: IBackgroundSettings
    rendering: IRenderingSettings
    enableVisuals: IEnableVisuals
    simpleBars: ISimpleBarSettings
}
