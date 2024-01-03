

export interface ISaveOptions {
    text: ITextSettings
    circle: ICircleSettings
    background: IBackgroundSettings
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
export async function save(saveOptions: ISaveOptions){
    const options = Object.assign({}, saveOptions);
    console.log("type: ", options.background.backgroundImage, typeof  options.background.backgroundImage, options.background.backgroundImage instanceof  Blob)
    if (options.background.backgroundImage !== "") {
        // Convert Blob to Base64
        const blob = await fetch(options.background.backgroundImage).then(res => res.blob());
        const base64 = await blobToBase64(blob);
        options.background.backgroundImage = base64;
    }

    const jsonOptions = JSON.stringify(options);
    localStorage.setItem("save", jsonOptions);
}

export function loadOptions(): ISaveOptions{
   const options = localStorage.getItem("save");
   const parsedOptions: ISaveOptions = JSON.parse(options || "{}");

    if (typeof parsedOptions.background.backgroundImage === 'string' && parsedOptions.background.backgroundImage !== "") {
        const blob = base64ToBlob(parsedOptions.background.backgroundImage);
        const blobUrl = URL.createObjectURL(blob);
        parsedOptions.background.backgroundImage = blobUrl;
    }

   return parsedOptions;
}



// Utility function to convert Blob to Base64 string
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}


// Utility function to convert Base64 string to Blob
function base64ToBlob(base64: string): Blob {
    const byteString = atob(base64.split(',')[1]);
    const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];

    const byteNumbers = new Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
        byteNumbers[i] = byteString.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], {type: mimeString});
}