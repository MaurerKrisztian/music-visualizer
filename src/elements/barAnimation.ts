export interface ISimpleBarSettings {
    barLength: number;       // No longer used, will be calculated based on overallWidth and numBars
    barWidth: number;
    spacing: number;
    beatMultiplier: number;
    barColor: string;        // New setting for bar color
    numBars?: number;         // New setting for the number of bars
    useFullWidth: boolean;
    xPos: number;            // X position for the center of the visualization
    yPos: number;            // Y position for the center of the visualization
    barStyle: "top" | "bottom" | "both";  // Style of bar rendering

}

// The drawBarVisualization function
export const drawBarVisualization = (
    ctx: CanvasRenderingContext2D,
    bufferLength: number,
    dataArray: Uint8Array,
    settings: ISimpleBarSettings
) => {
    // Use the length of dataArray if numBars is undefined
    const numBars = settings.numBars ?? dataArray.length;

    // Calculate barWidth based on whether to use full canvas width
    if (settings.useFullWidth) {
        // Adjust barWidth to fill the canvas width with spacing on both sides and between bars
        settings.barWidth = (ctx.canvas.width - (settings.spacing * (numBars + 1))) / numBars;
    }

    // Convert xPos and yPos from percentages to pixel values
    const xPosInPixels = settings.xPos !== undefined ? ctx.canvas.width * (settings.xPos / 100) : settings.spacing;
    const yPosInPixels = settings.yPos !== undefined ? ctx.canvas.height * (settings.yPos / 100) : ctx.canvas.height;

    // Calculate the starting x position for centered alignment
    const totalWidth = numBars * settings.barWidth + (numBars - 1) * settings.spacing;
    const startX = xPosInPixels - totalWidth / 2;

    for (let i = 0; i < numBars; i++) {
        // Calculate the height of each bar based on the data and the beat multiplier
        const barHeight = settings.beatMultiplier * (settings.numBars ? dataArray[i * Math.floor(bufferLength / numBars)] : dataArray[i]);


        ctx.globalAlpha = 1; // todo: add an option for opacity
        // Set the color for each bar
        ctx.fillStyle = settings.barColor;


        // Calculate the x position for each bar
        const x = startX + i * (settings.barWidth + settings.spacing);

        // Draw the bar based on the specified barStyle
        switch (settings.barStyle) {
            case "top":
                ctx.fillRect(x, yPosInPixels - barHeight, settings.barWidth, barHeight);
                break;
            case "bottom":
                ctx.fillRect(x, yPosInPixels, settings.barWidth, barHeight);
                break;
            case "both":
            default:
                ctx.fillRect(x, yPosInPixels - barHeight / 2, settings.barWidth, barHeight);
                break;
        }


        ctx.globalAlpha = 1;
    }
};
