window.onload = function() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let audioContext, analyser, source, audio;
    let backgroundImage = null;
    let circleImage = null;

    const resolutions = {
        'HD': { width: 1280, height: 720 },
        'FullHD': { width: 1920, height: 1080 }
    };

    const settings = {
        circle: {
            baseRadius: 22,
            growthFactor: 222,
            color: '#006400'
        },
        bars: {
            widthMultiplier: 55,
            lengthMultiplier: 1,
            color: function(i) {
                return `rgb(${i * 2}, ${200 - i * 2}, ${50 + i * 2})`;
            }
        },
        video: {
            bitrate: 2500000,
            resolution: 'HD',
            fps: 30
        }
    };

    document.getElementById('audioFile').onchange = handleAudioFile;
    document.getElementById('imageFile').onchange = handleImageFile;
    document.getElementById('backgroundImageFile').onchange = handleBackgroundImageFile;
    setupControlEventHandlers();

    document.getElementById('playButton').addEventListener('click', playAudioAndRender);
    document.getElementById('downloadButton').addEventListener('click', downloadVisualization);

    function setupControlEventHandlers() {
        document.getElementById('baseRadius').addEventListener('input', function() {
            settings.circle.baseRadius = parseInt(this.value);
        });
        document.getElementById('growthFactor').addEventListener('input', function() {
            settings.circle.growthFactor = parseInt(this.value);
        });
        document.getElementById('circleColor').addEventListener('input', function() {
            settings.circle.color = this.value;
        });
        document.getElementById('barWidthMultiplier').addEventListener('input', function() {
            settings.bars.widthMultiplier = parseInt(this.value);
        });
        document.getElementById('barLengthMultiplier').addEventListener('input', function() {
            settings.bars.lengthMultiplier = parseInt(this.value);
        });
        document.getElementById('bitrate').addEventListener('input', function() {
            settings.video.bitrate = parseInt(this.value);
        });
        document.getElementById('resolutionSelect').addEventListener('change', function() {
            settings.video.resolution = this.value;
        });
        document.getElementById('fps').addEventListener('input', function() {
            settings.video.fps = parseInt(this.value);
        });
    }

    function handleAudioFile() {
        if (this.files && this.files[0]) {
            if (audioContext) audioContext.close();
            audioContext = new AudioContext();
            audio = new Audio(URL.createObjectURL(this.files[0]));
            audio.crossOrigin = "anonymous";
            audio.load();
            source = audioContext.createMediaElementSource(audio);
            analyser = audioContext.createAnalyser();
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            analyser.fftSize = 256;
        }
    }

    function handleImageFile() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                circleImage = new Image();
                circleImage.src = e.target.result;
            };
            reader.readAsDataURL(this.files[0]);
        }
    }

    function handleBackgroundImageFile() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                backgroundImage = new Image();
                backgroundImage.src = e.target.result;
            };
            reader.readAsDataURL(this.files[0]);
        }
    }

    function playAudioAndRender() {
        if (!audio) {
            console.log("No audio file selected");
            return;
        }
        audio.play();
        startRendering();
    }

    function startRendering() {
        adjustCanvasSize(settings.video.resolution);
        renderVisuals(canvas, ctx, analyser, settings, backgroundImage, circleImage);
    }

    function adjustCanvasSize(resolutionKey) {
        const resolution = resolutions[resolutionKey];
        canvas.width = resolution.width;
        canvas.height = resolution.height;
    }

    function renderVisuals(canvas, ctx, analyser, settings, backgroundImage, circleImage) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        function draw() {
            requestAnimationFrame(draw);

            if (backgroundImage) {
                ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            analyser.getByteFrequencyData(dataArray);

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            let avg = dataArray.reduce((a, b) => a + b) / bufferLength; // Average frequency
            let radius = settings.circle.baseRadius + avg / settings.circle.growthFactor;

            // Draw the circle with image or color
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.closePath();

            if (circleImage) {
                ctx.save();
                ctx.clip();
                ctx.drawImage(circleImage, centerX - radius, centerY - radius, radius * 2, radius * 2);
                ctx.restore();
            } else {
                ctx.fillStyle = settings.circle.color;
                ctx.fill();
            }

            // Drawing equalizer bars
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i];
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(i * ((Math.PI * 2) / bufferLength));
                ctx.fillStyle = settings.bars.color(i);
                ctx.fillRect(0, radius, settings.bars.widthMultiplier, barHeight * settings.bars.lengthMultiplier);
                ctx.restore();
            }
        }

        draw();
    }


    function downloadVisualization() {
        if (!audio || !analyser) {
            console.log("No audio or analyser available");
            return;
        }
        setupAndDownloadVisualizations(settings.video.resolution, settings.video.bitrate, settings.video.fps);
    }

    function setupAndDownloadVisualizations(selectedResolution, bitrate, fps) {
        let offscreenCanvas = document.createElement('canvas');
        const resolution = resolutions[selectedResolution];
        offscreenCanvas.width = resolution.width;
        offscreenCanvas.height = resolution.height;

        let offscreenCtx = offscreenCanvas.getContext('2d');
        renderVisuals(offscreenCanvas, offscreenCtx, analyser, settings, backgroundImage, circleImage);

        recordVisualizations(offscreenCanvas, audio, audio.duration, bitrate, fps);
    }

    function recordVisualizations(canvas, audio, duration, bitrate, fps) {
        const stream = canvas.captureStream(fps);
        const audioTracks = audio.captureStream().getAudioTracks();

        if (audioTracks.length > 0) {
            stream.addTrack(audioTracks[0]);
        }

        const options = {
            mimeType: 'video/webm; codecs=vp9',
            videoBitsPerSecond: bitrate
        };

        const mediaRecorder = new MediaRecorder(stream);
        let chunks = [];

        mediaRecorder.ondataavailable = function(e) {
            chunks.push(e.data);
        };

        mediaRecorder.onstop = function() {
            const blob = new Blob(chunks, { 'type': 'video/webm' });
            chunks = [];

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            document.body.appendChild(a);
            a.style = 'display: none';
            a.href = url;
            a.download = 'visualization.webm';
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        };

        mediaRecorder.start();

        setTimeout(() => mediaRecorder.stop(), duration * 1000);
    }
};

