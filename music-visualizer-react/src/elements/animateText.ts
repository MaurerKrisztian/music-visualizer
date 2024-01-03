import {ITextSettings} from "./saveLoad.ts";

const animateText = (
    ctx: CanvasRenderingContext2D,
    audioAnalyser: AnalyserNode,
    dataArray: Uint8Array,
    textSettingsRef: ITextSettings
) => {
    audioAnalyser.getByteFrequencyData(dataArray);
    let average = dataArray.reduce((a, b) => a + b) / dataArray.length;

    let newFontSize = (textSettingsRef.fontSize + average * textSettingsRef.maxSizeMultiplier / 255).toFixed(2);
    ctx.font = `${newFontSize}px ${textSettingsRef.selectedFont}`;
    let textMetrics = ctx.measureText(textSettingsRef.textInput);

    let canvasCenterX = ctx.canvas.width / 2;
    let canvasCenterY = ctx.canvas.height / 2;
    let textWidth = textMetrics.width;
    let textHeight = newFontSize;
    let x = canvasCenterX - textWidth / 2;
    let y = canvasCenterY + textHeight / 4;

    // ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.strokeStyle = textSettingsRef.borderColor;
    ctx.lineWidth = textSettingsRef.borderThickness;
    ctx.strokeText(textSettingsRef.textInput, x, y);
    ctx.fillStyle = textSettingsRef.fontColor;
    ctx.fillText(textSettingsRef.textInput, x, y);
};

export default animateText;
