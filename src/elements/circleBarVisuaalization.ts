// VisualizationSettings.ts
export interface BarSettings {
    widthMultiplier: number;
    lengthMultiplier: number;
    color: (index: number) => string; // A function that returns a color string based on an index
}

export interface CircleSettings {
    baseRadius: number;
    growthFactor: number;
    color: string;
    image?: HTMLImageElement; // Optional, can be undefined or an HTMLImageElement
    imageX: number; // X coordinate for the image
    imageY: number; // Y coordinate for the image
}

export interface MusicVisualizationSettings {
    circle: CircleSettings;
    bars: BarSettings;
}

export const drawMusicVisualization = (ctx, bufferLength, dataArray, settings: MusicVisualizationSettings) => {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    // const centerX = canvasWidth / 2 + settings.circle.imageX; // Add X offset
    // const centerY = canvasHeight / 2 + settings.circle.imageY; // Add Y offset
    const centerX = settings.circle.imageX;
    const centerY = settings.circle.imageY;
    let radius = settings.circle.baseRadius;

    for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i];

        // Draw the circle
        if (settings.circle.image) {
            // Draw image if available
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(settings.circle.image, centerX - radius, centerY - radius, radius * 2, radius * 2);
            ctx.restore();
        } else {
            // Draw solid color circle
            ctx.fillStyle = settings.circle.color;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Drawing equalizer bars
        const barWidth = (Math.PI * 2) / bufferLength;
        const barLength = barHeight * settings.bars.lengthMultiplier;
        ctx.fillStyle = settings.bars.color(i);
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(i * barWidth);
        ctx.fillRect(0, radius, barWidth * settings.bars.widthMultiplier, barLength);
        ctx.restore();

        radius += barHeight / settings.circle.growthFactor;
    }
};
