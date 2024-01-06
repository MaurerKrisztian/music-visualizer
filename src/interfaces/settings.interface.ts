export interface IEnableVisuals {
    simpleBar: boolean,
    circleBar: false,
    backgroundCircles: boolean,
    text: boolean,
}

export interface ICircleSettings {
    circleSize: number,
    circleSpeed: number,
    circleColor: string,
    numberOfCircles: number,
    beatSpeedUp: number,
    zigzagSmoothness: number
}

export interface ITextSettings {
    maxSizeMultiplier: number,
    smoothness: number,
    borderColor: string,
    borderThickness: number,
    fontSize: number,
    fontColor: string,
    textInput: string,
    selectedFont: string,
    x: number;
    y: number;

    fontFile?: Blob;
}

export interface IBackgroundSettings {
    backgroundColor: string,
    backgroundImage: string,
    shakeIntensity: number
}

export interface IRenderingSettings {
    bitRateInMb: number
}