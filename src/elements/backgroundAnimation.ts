import {IBackgroundSettings} from "../interfaces/settings.interface.ts";

export const background = new Image();
export let isBackgroundLoaded = false;

export const setBackgroundImage = (imageUrl: string) => {
    background.src = imageUrl;
    background.onload = () => {
        isBackgroundLoaded = true;
    };
};
export const drawBackground = (ctx: CanvasRenderingContext2D, canvas, imageUrl, shakeIntensity, analyzer, dataArray) => {
    if (!isBackgroundLoaded) return;

    analyzer.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a: number, b: number) => a + b) / dataArray.length;

    const scale = 1 + average / 512 * shakeIntensity;
    const angle = Math.min((average / 512) * (shakeIntensity / 10), Math.PI / 4); // Limit the angle

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.drawImage(background, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);

    if (false) {
        manipulateImage(ctx, canvas, average)
    }

    ctx.restore();
};

export function manipulateImage(ctx: CanvasRenderingContext2D, canvas, average) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Manipulate the image data
    for (let i = 0; i < data.length; i += 4) {
        // data[i]     - red
        // data[i + 1] - green
        // data[i + 2] - blue
        // data[i + 3] - alpha
        data[i] = data[i] + average / 1.5;
        // data[i] = data[i+ 1] + average / 1.5;
        // data[i] = data[i+ 2] + average / 1.5;
        // Ensure the value stays within the 0-255 range
        if (data[i] > 255) {
            data[i] = 255;
        }
    }

    // Put the manipulated data back on the canvas
    ctx.putImageData(imageData, 0, 0);
}


export const animateBackground = (ctx: CanvasRenderingContext2D, canvas, analyzer, dataArray, backgroundSettings: IBackgroundSettings) => {
    const {shakeIntensity, backgroundImage} = backgroundSettings;

    // Get audio data
    analyzer.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a: number, b: number) => a + b) / dataArray.length;

    // Adjust shake intensity based on the beat
    const currentShakeIntensity = shakeIntensity * (average / 255);

    drawBackground(ctx, canvas, backgroundImage, currentShakeIntensity, analyzer, dataArray);

};
