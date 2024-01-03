import React, { useState, useEffect, useRef } from 'react';
import animateText from "./elements/animateText.ts";
import {animateCircles, initializeCircles} from "./elements/circleAnimation.ts";
import {animateBackground} from "./elements/backgroundAnimation.ts";

const App: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const maxSizeMultiplierRef = useRef<number>(55);
    const smoothnessRef = useRef<number>(100);
    const borderColorRef = useRef<string>('#000000');
    const borderThicknessRef = useRef<number>(1);
    const fontSizeRef = useRef<number>(20);
    const fontColorRef = useRef<string>('#000000');
    const textInputRef = useRef<string>('Sample Text');
    // Ref for the selected font
    const selectedFontRef = useRef<string>('Arial');



    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioRef = useRef<HTMLAudioElement>(new Audio());
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);

    const animationFrameRef = useRef<number | null>(null);

    const predefinedFonts = ['Arial', 'Verdana', 'Times New Roman', 'Georgia', 'Courier New'];


    // const backgroundTypeRef = useRef('color'); // 'color' or 'image'
    const [backgroundType, setBackgroundType] = useState("color"); // Initial state is set to "color"
    const handleChange = (e) => {
        setBackgroundType(e.target.value); // Update the state when the select value changes
    };


    const backgroundColorRef = useRef('#f59292');
    const backgroundImageRef = useRef('');
    const shakeIntensityRef = useRef(0);

    // Refs for circle animation settings
    const circleSizeRef = useRef(10);
    const circleSpeedRef = useRef(1);
    const circleColorRef = useRef('#d3d3d3');
    const numberOfCirclesRef = useRef(5);
    const beatSpeedUpRef = useRef(1);
    const zigzagSmoothnessRef = useRef(1);




    const [showTextSettings, setShowTextSettings] = useState(false);
    const [showFontSettings, setShowFontSettings] = useState(false);
    const [showCuircleSettings, setShowCuircleSettings] = useState(false);
    const [showBackgroundSettings, setBackgroundSettings] = useState(false);

    const toggleTextSettings = () => setShowTextSettings(prev => !prev);
    const toggleFontSettings = () => setShowFontSettings(prev => !prev);
    const toggleBackgroundSettings = () => setBackgroundSettings(prev => !prev);
    const toggleCircleSettings = () => setShowCuircleSettings(prev => !prev);


    const handleFontFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files[0]) {
            const font = new FontFace('CustomFont', `url(${URL.createObjectURL(files[0])})`);
            font.load().then((loadedFont) => {
                document.fonts.add(loadedFont);
                selectedFontRef.current = 'CustomFont'; // Update ref with the custom font name
            }).catch(error => console.error('Error loading font:', error));
        }
    };

    const handleFontChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        selectedFontRef.current = event.target.value;
    };


    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            const audioURL = URL.createObjectURL(files[0]);
            audioRef.current.src = audioURL;
            setFile(files[0]);
        }
    };

    const handlePlay = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
            const track = audioContextRef.current.createMediaElementSource(audioRef.current);
            analyserRef.current = audioContextRef.current.createAnalyser();
            track.connect(analyserRef.current);
            analyserRef.current.connect(audioContextRef.current.destination);
        }

        audioRef.current.play()
            .then(() => {
                setIsPlaying(true);
                if (analyserRef.current) {
                    analyserRef.current.fftSize = 256;
                    const bufferLength = analyserRef.current.frequencyBinCount;
                    dataArrayRef.current = new Uint8Array(bufferLength);
                    startAnimation();
                }
            })
            .catch(error => console.error('Error playing audio:', error));
    };

    let circles = []

    if (canvasRef.current){
        circles = initializeCircles(canvasRef.current, numberOfCirclesRef.current, circleSizeRef.current, circleSpeedRef.current, circleColorRef.current);
    }


    const startAnimation = () => {
        if (!canvasRef.current){
            return;
        }
        if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return;

        const ctx = canvasRef.current.getContext('2d');

        if (!ctx) return;

        const animate = () => {
            if (backgroundType === 'image') {
                animateBackground(ctx, canvasRef.current, analyserRef.current, dataArrayRef.current, backgroundImageRef.current, shakeIntensityRef.current);
            } else {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                ctx.fillStyle = backgroundColorRef.current;
                ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }


            animateText(
                ctx,
                analyserRef.current,
                dataArrayRef.current,
                textInputRef.current,
                maxSizeMultiplierRef.current,
                borderColorRef.current,
                borderThicknessRef.current,
                fontSizeRef.current,
                fontColorRef.current,
                selectedFontRef.current
            );



            animateCircles(ctx, circles, analyserRef.current, dataArrayRef.current, beatSpeedUpRef.current, zigzagSmoothnessRef.current, circleSpeedRef.current, circleSizeRef.current, circleColorRef.current);

            animationFrameRef.current = requestAnimationFrame(animate);
        };



        animate();
    };

    // Handle file change for background image
    const handleBackgroundImageChange = (event) => {
        const file = event.target.files[0];
        const imageUrl = URL.createObjectURL(file);
        backgroundImageRef.current = imageUrl;
    };

    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);


    return (
        <div className="container">
            <div className="control-group">
                <input type="file" onChange={handleFileChange} accept="audio/*"/>
                {/*{file && !isPlaying && <button onClick={handlePlay}>Play</button>}*/}
                <button onClick={handlePlay}>Play</button>
            </div>

            <div className="group-header" onClick={toggleTextSettings}>
                Text Settings
            </div>
            {showTextSettings && (
                <div className="settings-group">
                    <label>
                        Text:
                        <input type="text" defaultValue="Sample Text"
                               onChange={e => textInputRef.current = e.target.value}/>
                    </label>
                    <label>
                        Max Size Multiplier:
                        <input type="number" defaultValue="55"
                               onChange={e => maxSizeMultiplierRef.current = parseFloat(e.target.value)}/>
                    </label>
                    <label>
                        Border Color:
                        <input type="color" defaultValue="#000000"
                               onChange={e => borderColorRef.current = e.target.value}/>
                    </label>
                    <label>
                        Border Thickness:
                        <input type="number" defaultValue="1"
                               onChange={e => borderThicknessRef.current = parseInt(e.target.value)}/>
                    </label>
                    <label>
                        Font Size:
                        <input type="number" defaultValue="20"
                               onChange={e => fontSizeRef.current = parseInt(e.target.value)}/>
                    </label>
                    <label>
                        Font Color:
                        <input type="color" defaultValue="#000000"
                               onChange={e => fontColorRef.current = e.target.value}/>
                    </label>
                    <div className="group-header" onClick={toggleFontSettings}>
                        Font Settings
                    </div>
                    {showFontSettings && (
                        <div className="settings-group">
                            <label>
                                Font:
                                <select onChange={handleFontChange}>
                                    {['Arial', 'Verdana', 'Times New Roman', 'Georgia', 'Courier New'].map(font => (
                                        <option key={font} value={font}>{font}</option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                or upload a font file:
                                <input type="file" onChange={handleFontFileUpload} accept=".ttf, .otf"/>
                            </label>
                        </div>
                    )}
                </div>
            )}

            <div className="group-header" onClick={toggleCircleSettings}>
                Circle Settings
            </div>
            {showCuircleSettings && (
                <div className="settings-group">
                    <label>
                        Number of Circles:
                        <input type="number" defaultValue="11"
                               onChange={(e) => {
                                   numberOfCirclesRef.current = parseInt(e.target.value);
                                   console.log(numberOfCirclesRef.current)
                               }}/>
                    </label>
                    <label>
                        Circle Size:
                        <input type="number" defaultValue="12"
                               onChange={e => circleSizeRef.current = parseFloat(e.target.value)}/>
                    </label>
                    <label>
                        Circle Speed:
                        <input type="number" defaultValue="11" onChange={e => circleSpeedRef.current = e.target.value}/>
                    </label>
                    <label>
                        Circle Color:
                        <input type="color" defaultValue="Red" onChange={e => circleColorRef.current = e.target.value}/>
                    </label>
                </div>
            )}


            <div className="group-header" onClick={toggleBackgroundSettings}>
                Background settings
            </div>
            {showBackgroundSettings && (
                <div className="settings-group">
                    <label>
                        Type:
                        <select value={backgroundType} onChange={handleChange}>
                            <option value="color">Color</option>
                            <option value="image">Image</option>
                        </select>
                    </label>

                    {backgroundType === 'color' && (
                        <label>
                            Color:
                            <input type="color" value={backgroundColorRef.current}
                                   onChange={e => backgroundColorRef.current = e.target.value}/>
                        </label>
                    )}

                    {backgroundType === 'image' && (
                        <label>
                            Image:
                            <input type="file" onChange={handleBackgroundImageChange} accept="image/*"/>
                        </label>
                    )}

                </div>
            )}


            {/* Repeat for other groups as needed */}

            <canvas ref={canvasRef} width="800" height="600"></canvas>
            <audio ref={audioRef} crossOrigin="anonymous"/>
        </div>
    );


};


export default App;
