import {IBackgroundSettings} from "./saveLoad.ts";

export const drawBackground = (ctx, canvas, imageUrl, shakeIntensity, analyzer, dataArray) => {
    if (imageUrl) {
        shakeIntensity = 1
        // Draw the image as background
        const background = new Image();
        background.src = imageUrl;
        background.onload = () => {
            // ctx.drawImage(background, 0, 0, canvas.width, canvas.height);


            // Get the average volume from the audio data
            analyzer.getByteFrequencyData(dataArray);
            let average = dataArray.reduce((a, b) => a + b) / dataArray.length;

            // Calculate scale and rotation angle based on the beat and shake intensity
            let scale = 1 + average / 512 * shakeIntensity;
            let angle =  (average / 512) * (shakeIntensity / 10); // Minor rotation

            // Save the current context state
            ctx.save();

            // Move to the center of the canvas, rotate and scale the image
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(angle);
            ctx.scale(scale, scale);
            ctx.drawImage(background, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);

            // Restore the context to its original state
            ctx.restore();
        };



    } else {
        // Draw a solid color background
        ctx.fillStyle = 'lightblue'; // Default color, can be changed
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
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

    // requestAnimationFrame(() => animateBackground(ctx, canvas, analyzer, dataArray, imageUrl, shakeIntensity));
};
