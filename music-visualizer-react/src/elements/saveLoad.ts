

export interface ISaveOptions {
    text: {
        text: string;
        maxSizeMultiplier: number;
        borderColor: string;
        fontSize: number;
        fontColor: string;
        font: string;
    }
    circle: {
        numberOfCircles: number;
        circleSize: number;
        circleSpeed: number;
        circleColor: string;
    },
    background: {
        image: string;
        color: string;
    }
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
}

export interface IBackgroundSettings {
    backgroundColor: string,
    backgroundImage: string,
    shakeIntensity: number
}
export function save(options: ISaveOptions){
    const jsonOptions = JSON.stringify(options);
    localStorage.setItem("save", jsonOptions);
}

export function loadOptions(): ISaveOptions{
   const options = localStorage.getItem("save");
   return JSON.parse(options || "{}");
}