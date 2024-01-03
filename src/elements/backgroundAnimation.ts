import {IBackgroundSettings} from "./saveLoad.ts";
export let background = new Image();
export let isBackgroundLoaded = false;

export const setBackgroundImage = (imageUrl) => {
    background.src = imageUrl;
    background.onload = () => {
        isBackgroundLoaded = true;
    };
};
export const drawBackground = (ctx, canvas, imageUrl, shakeIntensity, analyzer, dataArray) => {
    if (!isBackgroundLoaded) return;
    shakeIntensity = 1

    analyzer.getByteFrequencyData(dataArray);
    let average = dataArray.reduce((a, b) => a + b) / dataArray.length;

    let scale = 1 + average / 512 * shakeIntensity;
    let angle = Math.min((average / 512) * (shakeIntensity / 10), Math.PI / 4); // Limit the angle

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.drawImage(background, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
    ctx.restore();
};


export const animateBackground = (ctx, canvas, analyzer, dataArray, backgroundSettings: IBackgroundSettings) => {
    const {shakeIntensity, backgroundImage, backgroundColor } = backgroundSettings;
    // ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get audio data
    analyzer.getByteFrequencyData(dataArray);
    let average = dataArray.reduce((a, b) => a + b) / dataArray.length;

    // Adjust shake intensity based on the beat
    let currentShakeIntensity = shakeIntensity * (average / 255);

    drawBackground(ctx, canvas, backgroundImage, currentShakeIntensity, analyzer, dataArray);

};
