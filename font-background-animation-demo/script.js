let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let currentFont = 'Arial'; // Default fonts

// Array of fonts: paths relative to your HTML file
const fonts = [
    { name: 'Custom Font1', url: 'fonts/test.ttf' },
    { name: 'Custom Font2', url: 'fonts/DaughterOfAGlitch-mMBv.ttf' },
    { name: 'Custom Font3', url: 'fonts/BROLEH.ttf' },
    // Add more fonts here
];

// Load and display fonts
fonts.forEach(font => {
    let fontFace = new FontFace(font.name, `url(${font.url})`);
    fontFace.load().then(function(loadedFont) {
        document.fonts.add(loadedFont);

        // Display fonts examples
        let fontExample = document.createElement('div');
        fontExample.innerText = 'Example Text - ' + font.name;
        fontExample.style.fontFamily = font.name;
        fontExample.style.cursor = 'pointer';
        fontExample.onclick = function() {
            currentFont = font.name;
            updateCanvas();
        };
        document.getElementById('fontSelector').appendChild(fontExample);
    });
});


let audioContext, analyzer, source, dataArray;

function setupAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;
    dataArray = new Uint8Array(analyzer.frequencyBinCount);
    // // Initialize circles and start the animation
    initializeCircles();
    animateBackground();
}



    let playAudioButton = document.getElementById('playAudioButton');

    console.log("addddddddddddd")
    if (playAudioButton) {
        console.log("addddddddddddd")
        playAudioButton.addEventListener('click', function() {
            playAudio();
        });
    }


function playAudio() {
    if (!audioContext) setupAudioContext();

    let audioInput = document.getElementById('audioInput');
    let file = audioInput.files[0];
    if (!file) return;

    let reader = new FileReader();
    reader.onload = function(e) {
        audioContext.decodeAudioData(e.target.result, function(buffer) {
            if (source) source.disconnect();
            source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(analyzer);
            analyzer.connect(audioContext.destination);
            source.start(0);
            animateText();
        });
    };
    reader.readAsArrayBuffer(file);
}
function animateText() {
    analyzer.getByteFrequencyData(dataArray);
    let average = dataArray.reduce((a, b) => a + b) / dataArray.length;

    // Controls for the animation
    let maxSizeMultiplier = parseFloat(document.getElementById('maxSizeMultiplier').value);
    let smoothness = parseInt(document.getElementById('smoothness').value);
    let borderColor = document.getElementById('borderColorInput').value;
    let borderThickness = parseInt(document.getElementById('borderThickness').value);

    // Calculate new font size based on the volume
    let baseFontSize = parseInt(document.getElementById('fontSizeInput').value) || 20;
    let fontSize = (baseFontSize + average * maxSizeMultiplier / 255).toFixed(2);

    // Update font size for measurement
    ctx.font = `${fontSize}px ${currentFont}`;

    // Measure text
    let text = document.getElementById('textInput').value;
    let textMetrics = ctx.measureText(text);

    // Calculate centered positions
    let canvasCenterX = canvas.width / 2;
    let canvasCenterY = canvas.height / 2;
    let textWidth = textMetrics.width;
    let textHeight = fontSize; // Approximation of text height

    // Adjust X and Y to center the text
    let x = canvasCenterX - textWidth / 2;
    let y = canvasCenterY + textHeight / 4; // Adjust for baseline positioning

    // Clear the canvas
    // ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw text border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderThickness;
    ctx.strokeText(text, x, y);

    // Draw text fill
    ctx.fillStyle = document.getElementById('fontColorInput').value;
    ctx.fillText(text, x, y);

    // Continue the animation
    setTimeout(animateText, smoothness);
}


// Array to hold circles
let circles = [];
function createCircle(random=false ) {

    // Create a new circle with random initial properties
    let circle = {
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 100, // Start below the canvas
        size: parseInt(document.getElementById('circleSize').value),
        xDelta: (Math.random() - 0.5) * 2, // Base zigzag movement
        ySpeed: parseFloat(document.getElementById('circleSpeed').value),
        color: document.getElementById('circleColor').value
    };

    if (random){
        circle.x = Math.random() * canvas.width
        circle.y = Math.random() * canvas.height
    }

    return circle;
}

function initializeCircles() {
    let numCircles = parseInt(document.getElementById('numberOfCircles').value);
    circles = [];
    for (let i = 0; i < numCircles; i++) {
        circles.push(createCircle(true));
    }
}
function animateBackground() {
    // Clear only the part of the canvas for background animation
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    // Adjust speed based on audio
    analyzer.getByteFrequencyData(dataArray);
    let average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    let beatSpeedUpMultiplier = parseFloat(document.getElementById('beatSpeedUp').value);
    let zigzagSmoothness = parseFloat(document.getElementById('zigzagSmoothness').value);
    let speed = parseFloat(document.getElementById('circleSpeed').value);

    // Reduce speed when zigzag is larger
    if (zigzagSmoothness > 5) {
        speed += (average / 512) * beatSpeedUpMultiplier;
    } else {
        speed += (average / 255) * beatSpeedUpMultiplier;
    }

    circles.forEach(circle => {
        circle.y -= speed; // Move circle up
        circle.x += circle.xDelta * zigzagSmoothness; // Adjusted zigzag movement

        // Draw circle
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.size, 0, Math.PI * 2);
        ctx.fillStyle = circle.color;
        ctx.fill();

        // Change direction randomly
        if (Math.random() < 0.1) {
            circle.xDelta = -circle.xDelta;
        }

        // If the circle goes off the top, reinitialize it at the bottom
        if (circle.y + circle.size < 0) {
            Object.assign(circle, createCircle());
        }
    });

    animateText();
    // Continue the animation
    requestAnimationFrame(animateBackground);
}


// Initial call to update canvas
updateCanvas();


function updateCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let fontSize = document.getElementById('fontSizeInput').value || 20;
    ctx.font = `${fontSize}px ${currentFont}`;
    ctx.fillStyle = document.getElementById('fontColorInput').value;
    let x = document.getElementById('xCoordinate').value;
    let y = document.getElementById('yCoordinate').value;
    ctx.fillText(document.getElementById('textInput').value, x, y);
}

updateCanvas(); // Initial canvas update








let background = {
    image: null,
    color: '#000000'
};

function updateBackground() {
    let fileInput = document.getElementById('backgroundImageInput');
    let colorInput = document.getElementById('backgroundColorInput');

    // If an image is selected, use it as the background
    if (fileInput.files && fileInput.files[0]) {
        let reader = new FileReader();
        reader.onload = function(e) {
            let img = new Image();
            img.onload = function() {
                background.image = img;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        // Otherwise, use the selected color
        background.color = colorInput.value;
        background.image = null;
    }
}

function drawBackground() {
    if (background.image) {
        // Draw the background image
        ctx.drawImage(background.image, 0, 0, canvas.width, canvas.height);
    } else {
        // Fill with the background color
        ctx.fillStyle = background.color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

