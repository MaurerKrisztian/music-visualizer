import {ICircleSettings} from "./saveLoad.ts";

export const createCircle = (canvas, circleSize, circleSpeed, circleColor, random = false) => {
    // Create circle logic
    let circle = {
        x: random ? Math.random() * canvas.width : Math.random() * canvas.width,
        y: random ? Math.random() * canvas.height : canvas.height + Math.random() * 100, // Start below the canvas
        size: circleSize,
        xDelta: (Math.random() - 0.5) * 2,
        ySpeed: circleSpeed,
        color: circleColor
    };

    return circle;
};

export const initializeCircles = (canvas, circleAnimationRef: ICircleSettings) => {
    let circles = [];
    for (let i = 0; i < circleAnimationRef.numberOfCircles; i++) {
        circles.push(createCircle(canvas, circleAnimationRef.circleSize, circleAnimationRef.circleSpeed, circleAnimationRef.circleColor, true));
    }
    return circles;
};

export const animateCircles = (ctx, circles, analyzer, dataArray, circleAnimationSettings: ICircleSettings) => {
    let average = dataArray.reduce((a, b) => a + b) / dataArray.length;

    let speed = 4;
    if (circleAnimationSettings.zigzagSmoothness > 5) {
        speed += (average / 512) * circleAnimationSettings.beatSpeedUp;
    } else {
        speed += (average / 255) * circleAnimationSettings.beatSpeedUp;
    }

    circles.forEach(circle => {
        circle.y -= speed // Move circle up
        circle.x += circle.xDelta * circleAnimationSettings.zigzagSmoothness; // Adjusted zigzag movement

        // Draw circle
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circleAnimationSettings.circleSize, 0, Math.PI * 2);
        ctx.fillStyle = circleAnimationSettings.circleColor
        ctx.fill();

        // Change direction randomly
        if (Math.random() < 0.1) {
            circle.xDelta = -circle.xDelta;
        }

        // If the circle goes off the top, reinitialize it at the bottom
        if (circle.y + circle.size < 0) {
            Object.assign(circle, createCircle(ctx.canvas, circle.size, circle.ySpeed, circle.color, false));
        }
    });


};
