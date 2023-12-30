window.onload = function() {
    const settings = {
        circle: {
            baseRadius: 22,
            growthFactor: 222,
            color: '#006400',
            image: null
        },
        bars: {
            widthMultiplier: 55,
            lengthMultiplier: 1,
            color: function(i) {
                return `rgb(${i * 2}, ${200 - i * 2}, ${50 + i * 2})`;
            }
        }
    };

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const fileInput = document.getElementById('audioFile');
    const imageInput = document.getElementById('imageFile');
    const baseRadiusInput = document.getElementById('baseRadius');
    const growthFactorInput = document.getElementById('growthFactor');
    const circleColorInput = document.getElementById('circleColor');
    const barWidthMultiplierInput = document.getElementById('barWidthMultiplier');
    const barLengthMultiplierInput = document.getElementById('barLengthMultiplier');

    // Update settings from UI
    baseRadiusInput.oninput = () => settings.circle.baseRadius = parseInt(baseRadiusInput.value);
    growthFactorInput.oninput = () => settings.circle.growthFactor = parseInt(growthFactorInput.value);
    circleColorInput.oninput = () => settings.circle.color = circleColorInput.value;
    barWidthMultiplierInput.oninput = () => settings.bars.widthMultiplier = parseInt(barWidthMultiplierInput.value);
    barLengthMultiplierInput.oninput = () => settings.bars.lengthMultiplier = parseInt(barLengthMultiplierInput.value);

    imageInput.onchange = function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    settings.circle.image = img;
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(this.files[0]);
        }
    };

    const playButton = document.getElementById('playButton');
    const pauseButton = document.getElementById('pauseButton');
    const seekBar = document.getElementById('seekBar');

    let audio;
    let animationId;

    // Initialize audio controls
    function setupAudioControls() {
        playButton.onclick = () => audio.play();
        pauseButton.onclick = () => audio.pause();

        seekBar.oninput = function() {
            const seekTime = audio.duration * (seekBar.value / 100);
            audio.currentTime = seekTime;
        };

        audio.ontimeupdate = function() {
            const progress = (audio.currentTime / audio.duration) * 100;
            seekBar.value = progress;
        };
    }

    fileInput.onchange = function() {
        const files = this.files;
        if (files.length === 0) return;

        if (audio) {
            audio.pause();
            cancelAnimationFrame(animationId);
        }

        // Audio setup
        const audioContext = new AudioContext();
        audio = new Audio(URL.createObjectURL(files[0]));
        setupAudioControls();
        audio.crossOrigin = "anonymous";
        audio.load();

        const source = audioContext.createMediaElementSource(audio);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        analyser.fftSize = 256;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        function draw() {
            requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            let radius = settings.circle.baseRadius;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i]
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
    }

    draw();
}
}
