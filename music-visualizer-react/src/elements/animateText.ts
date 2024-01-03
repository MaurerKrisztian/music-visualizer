const animateText = (
    ctx: CanvasRenderingContext2D,
    audioAnalyser: AnalyserNode,
    dataArray: Uint8Array,
    textInput: string,
    maxSizeMultiplier: number,
    borderColor: string,
    borderThickness: number,
    fontSize: number,
    fontColor: string,
    selectedFont: string
) => {
    audioAnalyser.getByteFrequencyData(dataArray);
    let average = dataArray.reduce((a, b) => a + b) / dataArray.length;

    let newFontSize = (fontSize + average * maxSizeMultiplier / 255).toFixed(2);
    ctx.font = `${newFontSize}px ${selectedFont}`;
    let textMetrics = ctx.measureText(textInput);

    let canvasCenterX = ctx.canvas.width / 2;
    let canvasCenterY = ctx.canvas.height / 2;
    let textWidth = textMetrics.width;
    let textHeight = newFontSize;
    let x = canvasCenterX - textWidth / 2;
    let y = canvasCenterY + textHeight / 4;

    // ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderThickness;
    ctx.strokeText(textInput, x, y);
    ctx.fillStyle = fontColor;
    ctx.fillText(textInput, x, y);
};

export default animateText;
