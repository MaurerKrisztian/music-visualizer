import {ITextSettings} from "../interfaces/settings.interface.ts";

const animateText = (
    ctx: CanvasRenderingContext2D,
    average: number,
    textSettings: ITextSettings
) => {
    const newFontSize = (textSettings.fontSize + average * textSettings.maxSizeMultiplier / 255).toFixed(2);
    ctx.font = `${newFontSize}px ${textSettings.selectedFont}`;
    const textMetrics = ctx.measureText(textSettings.textInput);

    // Calculate text dimensions
    const textWidth = textMetrics.width;
    const textHeight = parseInt(newFontSize);

    // Adjust X and Y to align the middle of the text
    const x = textSettings.x - textWidth / 2;
    const y = textSettings.y + textHeight / 2; // Adjust for baseline, considering font size as height

    ctx.strokeStyle = textSettings.borderColor;
    ctx.lineWidth = textSettings.borderThickness;
    ctx.strokeText(textSettings.textInput, x, y);
    ctx.fillStyle = textSettings.fontColor;
    ctx.fillText(textSettings.textInput, x, y);
};

export default animateText;
