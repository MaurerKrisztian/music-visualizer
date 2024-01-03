// circleAnimation.js
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

export const initializeCircles = (canvas, numberOfCircles, circleSize, circleSpeed, circleColor) => {
    console.log("init ck, ", canvas)
    let circles = [];
    for (let i = 0; i < numberOfCircles; i++) {
        circles.push(createCircle(canvas, circleSize, circleSpeed, circleColor, true));
    }
    return circles;
};

export const animateCircles = (ctx, circles, analyzer, dataArray, beatSpeedUp, zigzagSmoothness, speed, circleSize, circleColor) => {
    let average = dataArray.reduce((a, b) => a + b) / dataArray.length;

    if (zigzagSmoothness > 5) {
        speed += (average / 512) * beatSpeedUp;
    } else {
        speed += (average / 255) * beatSpeedUp;
    }

    circles.forEach(circle => {
        circle.y -= speed; // Move circle up
        circle.x += circle.xDelta * zigzagSmoothness; // Adjusted zigzag movement

        // Draw circle
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circleSize, 0, Math.PI * 2);
        ctx.fillStyle = circleColor
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
