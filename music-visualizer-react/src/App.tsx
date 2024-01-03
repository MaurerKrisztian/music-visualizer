import React, { useState, useEffect, useRef } from 'react';
import animateText from "./elements/animateText.ts";
import {animateCircles, initializeCircles} from "./elements/circleAnimation.ts";
import {animateBackground, setBackgroundImage} from "./elements/backgroundAnimation.ts";
import {IBackgroundSettings, ICircleSettings, ITextSettings, loadOptions, save} from "./elements/saveLoad.ts";
import AudioControls from "./components/AudioControls.tsx";
import defaultAudio from './assets/music.mp3';
import Recorder from "./components/Recorder.tsx";
import {drawMusicVisualization, MusicVisualizationSettings} from "./elements/circleBarVisuaalization.ts"; // Adjust the path as necessary

const App: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);


    const textSettingsRef = useRef<ITextSettings>({
        maxSizeMultiplier: 55,
        smoothness: 100,
        borderColor: '#000000',
        borderThickness: 1,
        fontSize: 20,
        fontColor: '#000000',
        textInput: 'Sample Text',
        selectedFont: 'Arial',
    });


    const circleAnimationSettingsRef = useRef<ICircleSettings>({
        circleSize: 10,
        circleSpeed: 1,
        circleColor: '#d3d3d3',
        numberOfCircles: 5,
        beatSpeedUp: 12,
        zigzagSmoothness: 1
    });


    const backgroundSettingsRef = useRef<IBackgroundSettings>({
        backgroundColor: '#f59292',
        backgroundImage: '',
        shakeIntensity: 0
    });


    const musicVisSettingsRef = useRef({
        circle: {
            baseRadius: 22,
            growthFactor: 222,
            color: '#006400'
        },
        bars: {
            widthMultiplier: 155,
            lengthMultiplier: 2,
            color: (i) => `rgb(${i * 2}, ${200 - i * 2}, ${50 + i * 2})`
        }
    });


    const handleSettingChange = (e) => {
        const { name, value } = e.target;
        // Update the settings ref based on the name of the input
        // Assuming a naming convention like "circle.baseRadius"
        const [category, key] = name.split('.');
        musicVisSettingsRef.current[category][key] = isNaN(value) ? value : Number(value);
        // Trigger a re-render or update if necessary
    };


    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioRef = useRef<HTMLAudioElement>(new Audio());
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);

    const animationFrameRef = useRef<number | null>(null);


    const predefinedFonts = ['Arial', 'Verdana', 'Times New Roman', 'Georgia', 'Courier New'];


    const [backgroundType, setBackgroundType] = useState("color"); // Initial state is set to "color"
    const handleChange = (e) => {
        setBackgroundType(e.target.value); // Update the state when the select value changes
    };

    interface ISettingsVisibility {
        text: boolean;
        font: boolean;
        circle: boolean;
        background: boolean;
        render: boolean;
        musicVisualization: boolean;
    }

    const [settingsVisibility, setSettingsVisibility] = useState<ISettingsVisibility>({
        text: false,
        font: false,
        circle: false,
        background: false,
        render: false,
        musicVisualization: false,
    });
    const toggleSettings = (setting: keyof ISettingsVisibility) => {
        setSettingsVisibility(prevSettings => ({
            ...prevSettings,
            [setting]: !prevSettings[setting]
        }));
    };

    const handleFontFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files[0]) {
            const font = new FontFace('CustomFont', `url(${URL.createObjectURL(files[0])})`);
            font.load().then((loadedFont) => {
                document.fonts.add(loadedFont);
                textSettingsRef.current.selectedFont = 'CustomFont'; // Update ref with the custom font name
            }).catch(error => console.error('Error loading font:', error));
        }
    };

    const handleFontChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        textSettingsRef.current.selectedFont = event.target.value;
    };


    const fetchDefaultAudioFile = async () => {
        try {
            const response = await fetch(defaultAudio);
            const blob = await response.blob();
            const defaultFile = new File([blob], 'defaultMusic.mp3', { type: 'audio/mpeg' });
            return defaultFile;
        } catch (error) {
            console.error('Error fetching default audio file:', error);
            return null;
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            const audioURL = URL.createObjectURL(files[0]);
            audioRef.current.src = audioURL;
            setFile(files[0]);
        }else {
            console.log("set file")
            const defaultFile = await fetchDefaultAudioFile();
            audioRef.current.src = defaultAudio;
            setFile(null);
            setFile(defaultFile);
        }
    };


    const handleSave = ()=>{
        save({text: textSettingsRef.current, background: backgroundSettingsRef.current, circle: circleAnimationSettingsRef.current})
    }

    const handleLoad = () => {
        const options = loadOptions();
        circleAnimationSettingsRef.current = options.circle;
        backgroundSettingsRef.current = options.background;
        textSettingsRef.current = options.text;
    }

    const handlePlay = async () => {
        if (!file){
            console.log("set file")
            const defaultFile = await fetchDefaultAudioFile();
            audioRef.current.src = defaultAudio;
            setFile(null);
            setFile(defaultFile);
        }


        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
            const track = audioContextRef.current.createMediaElementSource(audioRef.current);
            analyserRef.current = audioContextRef.current.createAnalyser();
            track.connect(analyserRef.current);
            analyserRef.current.connect(audioContextRef.current.destination);
        }

        audioRef.current.playbackRate =  1
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
        circles = initializeCircles(canvasRef.current, circleAnimationSettingsRef.current);
    }


    const startAnimation = () => {
        if (!canvasRef.current){
            return;
        }
        if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return;

        const ctx = canvasRef.current.getContext('2d');

        if (!ctx) return;

        const animate = () => {
            if (backgroundSettingsRef.current.backgroundImage !== null && backgroundSettingsRef.current.backgroundImage !== "") {
                animateBackground(ctx, canvasRef.current, analyserRef.current, dataArrayRef.current, backgroundSettingsRef.current);
            } else {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                ctx.fillStyle = backgroundSettingsRef.current.backgroundColor;
                ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }


            animateText(
                ctx,
                analyserRef.current,
                dataArrayRef.current,
                textSettingsRef.current
            );



            animateCircles(ctx, circles, analyserRef.current, dataArrayRef.current, circleAnimationSettingsRef.current);


            // const canvas = canvasRef.current;
            // const ctx = canvas.getContext('2d');
            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = dataArrayRef.current //new Uint8Array(bufferLength);

            drawMusicVisualization(ctx, bufferLength, dataArray,  musicVisSettingsRef.current);

            animationFrameRef.current = requestAnimationFrame(animate);
        };



        animate();
    };

    // Handle file change for background image
    const handleBackgroundImageChange = (event) => {
        const file = event.target.files[0];
        const imageUrl = URL.createObjectURL(file);

        setBackgroundImage(imageUrl);

        backgroundSettingsRef.current.backgroundImage = imageUrl;
        console.log(backgroundSettingsRef.current.backgroundImage)
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


    const resolutions = {
        "420p": { width: 640, height: 420 },
        "HD": { width: 1280, height: 720 },
        "FullHD": { width: 1920, height: 1080 },
        "2K": { width: 2560, height: 1440 }
    };
    const [resolution, setResolution] = useState("FullHD");
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas && resolutions[resolution]) {
            const { width, height } = resolutions[resolution];
            canvas.width = width;
            canvas.height = height;
            // You may need to reinitialize or redraw your canvas content here
        }
    }, [resolution]);

    const handleResolutionChange = (event) => {
        setResolution(event.target.value);
    };

    return (
        <div className="container">
            <div style={{textAlign: 'right', margin: '10px'}}>

                <button onClick={handleSave}>Save</button>
                <button onClick={handleLoad} style={{margin: '5px'}}>Load</button>
            </div>



            <div className="group-header" onClick={() => toggleSettings("musicVisualization")}>
                Music Visualization Settings
            </div>
            {settingsVisibility.musicVisualization && (
                <div className="settings-group">
                    {/* Circle Settings */}
                    <label>
                        Circle Base Radius:
                        <input
                            type="number"
                            name="circle.baseRadius"
                            defaultValue={musicVisSettingsRef.current.circle.baseRadius}
                            onChange={handleSettingChange}
                        />
                    </label>
                    <label>
                        Circle Growth Factor:
                        <input
                            type="number"
                            name="circle.growthFactor"
                            defaultValue={musicVisSettingsRef.current.circle.growthFactor}
                            onChange={handleSettingChange}
                        />
                    </label>
                    <label>
                        Circle Color:
                        <input
                            type="color"
                            name="circle.color"
                            defaultValue={musicVisSettingsRef.current.circle.color}
                            onChange={handleSettingChange}
                        />
                    </label>


                    {/* Bar Settings */}
                    <label>
                        Bars Width Multiplier:
                        <input
                            type="number"
                            name="bars.widthMultiplier"
                            defaultValue={musicVisSettingsRef.current.bars.widthMultiplier}
                            onChange={handleSettingChange}
                        />
                    </label>
                    <label>
                        Bars Length Multiplier:
                        <input
                            type="number"
                            name="bars.lengthMultiplier"
                            defaultValue={musicVisSettingsRef.current.bars.lengthMultiplier}
                            onChange={handleSettingChange}
                        />
                    </label>
                </div>
            )}


            <div className="control-group">
                <input type="file" onChange={handleFileChange} accept="audio/*"/>
                <div className="container">
                    {/* ... other components and content */}
                    <AudioControls audioRef={audioRef}/>

                    {file && <Recorder key={file.name} audioRef={audioRef} canvasRef={canvasRef}/>}
                    {/* ... other components and content */}
                </div>
                {/*{file && !isPlaying && <button onClick={handlePlay}>Play</button>}*/}
                <button onClick={handlePlay}>Start visualize</button>
            </div>


            <div className="group-header" onClick={() => toggleSettings("render")}>
                Render Settings
            </div>
            {settingsVisibility.render && (
                <div className="settings-group">
                    <label>
                        Canvas Resolution:
                        <select value={resolution} onChange={handleResolutionChange}>
                            {Object.keys(resolutions).map(res => (
                                <option key={res} value={res}>{res}</option>
                            ))}
                        </select>
                    </label>
                </div>
            )}

            <div className="group-header" onClick={() => toggleSettings("text")}>
                Text Settings
            </div>
            {settingsVisibility.text && (
                <div className="settings-group">
                    <label>
                        Text:
                        <input type="text" defaultValue="Sample Text"
                               onChange={e => textSettingsRef.current.textInput = e.target.value}/>
                    </label>
                    <label>
                        Max Size Multiplier:
                        <input type="number" defaultValue="55"
                               onChange={e => textSettingsRef.current.maxSizeMultiplier = parseFloat(e.target.value)}/>
                    </label>
                    <label>
                        Border Color:
                        <input type="color" defaultValue="#000000"
                               onChange={e => textSettingsRef.current.borderColor = e.target.value}/>
                    </label>
                    <label>
                        Border Thickness:
                        <input type="number" defaultValue="1"
                               onChange={e => textSettingsRef.current.borderThickness = parseInt(e.target.value)}/>
                    </label>
                    <label>
                        Font Size:
                        <input type="number" defaultValue="20"
                               onChange={e => textSettingsRef.current.fontSize = parseInt(e.target.value)}/>
                    </label>
                    <label>
                        Font Color:
                        <input type="color" defaultValue="#000000"
                               onChange={e => textSettingsRef.current.fontColor = e.target.value}/>
                    </label>
                    <div className="group-header" onClick={() => toggleSettings("font")}>
                        Font Settings
                    </div>
                    {settingsVisibility.font && (
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

            <div className="group-header" onClick={() => toggleSettings("circle")}>
                Circle Settings
            </div>
            {settingsVisibility.circle && (
                <div className="settings-group">
                    <label>
                        Number of Circles:
                        <input type="number" defaultValue="11"
                               onChange={(e) => {
                                   circleAnimationSettingsRef.current.numberOfCircles = parseInt(e.target.value);
                               }}/>
                    </label>
                    <label>
                        Circle Size:
                        <input type="number" defaultValue="12"
                               onChange={e => circleAnimationSettingsRef.current.circleSize = parseFloat(e.target.value)}/>
                    </label>
                    <label>
                        beat speed up factor:
                        <input type="number" defaultValue="12"
                               onChange={e => circleAnimationSettingsRef.current.beatSpeedUp = parseFloat(e.target.value)}/>
                    </label>
                    <label>
                        Circle Speed:
                        <input type="number" defaultValue="11"
                               onChange={e => circleAnimationSettingsRef.current.circleSpeed = parseFloat(e.target.value)}/>
                    </label>
                    <label>
                        Circle Color:
                        <input type="color" defaultValue="Red"
                               onChange={e => circleAnimationSettingsRef.current.circleColor = e.target.value}/>
                    </label>
                </div>
            )}


            <div className="group-header" onClick={() => toggleSettings("background")}>
                Background settings
            </div>
            {settingsVisibility.background && (
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
                            <input type="color" value={backgroundSettingsRef.current.backgroundColor}
                                   onChange={e => backgroundSettingsRef.current.backgroundColor = e.target.value}/>
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

            <canvas ref={canvasRef} style={{width: "80%", height: "auto"}} width="1920" height="1080"></canvas>
            <audio ref={audioRef} crossOrigin="anonymous"/>
        </div>

    );


};


export default App;
