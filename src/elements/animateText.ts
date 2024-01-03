import {ITextSettings} from "./saveLoad.ts";

const animateText = (
    ctx: CanvasRenderingContext2D,
    audioAnalyser: AnalyserNode,
    dataArray: Uint8Array,
    textSettings: ITextSettings
) => {
    audioAnalyser.getByteFrequencyData(dataArray);
    let average = dataArray.reduce((a, b) => a + b) / dataArray.length;

    let newFontSize = (textSettings.fontSize + average * textSettings.maxSizeMultiplier / 255).toFixed(2);
    ctx.font = `${newFontSize}px ${textSettings.selectedFont}`;
    let textMetrics = ctx.measureText(textSettings.textInput);

    // Calculate text dimensions
    let textWidth = textMetrics.width;
    let textHeight = parseInt(newFontSize);

    console.log(textSettings.x, textSettings.y)
    // Adjust X and Y to align the middle of the text
    let x = textSettings.x - textWidth / 2;
    let y = textSettings.y + textHeight / 2; // Adjust for baseline, considering font size as height

    // ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.strokeStyle = textSettings.borderColor;
    ctx.lineWidth = textSettings.borderThickness;
    ctx.strokeText(textSettings.textInput, x, y);
    ctx.fillStyle = textSettings.fontColor;
    ctx.fillText(textSettings.textInput, x, y);
};

export default animateText;
