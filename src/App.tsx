import React, {useState, useEffect, useRef} from 'react';
import animateText from "./elements/animateText.ts";
import {animateCircles, ICircle, initializeCircles} from "./elements/circleAnimation.ts";
import {animateBackground, setBackgroundImage} from "./elements/backgroundAnimation.ts";
import {
    fontFile,
    loadFont,
    loadFromLocalstorage,
    saveToLocalstorage
} from "./elements/saveLoad.ts";
import AudioControls from "./components/AudioControls.tsx";
import defaultAudio from './assets/music.mp3';
import Recorder, {estimateFileSize} from "./components/Recorder.tsx";
import {
    drawMusicVisualization,
    MusicVisualizationSettings
} from "./elements/circleBarVisuaalization.ts";
import {drawBarVisualization, ISimpleBarSettings} from "./elements/barAnimation.ts";
import {
    IBackgroundSettings,
    ICircleSettings,
    IEnableVisuals,
    IRenderingSettings,
    ITextSettings
} from "./interfaces/settings.interface.ts";

const App: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);


    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioRef = useRef<HTMLAudioElement>(new Audio());
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);

    const animationFrameRef = useRef<number | null>(null);

    const resolutions = {
        "420p": {width: 640, height: 420},
        "HD": {width: 1280, height: 720},
        "FullHD": {width: 1920, height: 1080},
        "2K": {width: 2560, height: 1440}
    };


    const enableVisualsSettingsRef = useRef<IEnableVisuals>({
        simpleBar: true,
        circleBar: false,
        backgroundCircles: true,
        text: true,
    });

    const textSettingsRef = useRef<ITextSettings>({
        maxSizeMultiplier: 222,
        smoothness: 100,
        borderColor: '#000000',
        borderThickness: 1,
        fontSize: 44,
        fontColor: '#000000',
        textInput: 'Sample Text',
        selectedFont: 'Arial',
        x: resolutions.FullHD.width / 2,
        y: resolutions.FullHD.height / 4,
        fontFile: undefined
    });


    const circleAnimationSettingsRef = useRef<ICircleSettings>({
        circleSize: 5,
        circleSpeed: 1,
        circleColor: '#d3d3d3',
        numberOfCircles: 11,
        beatSpeedUp: 25,
        zigzagSmoothness: 1
    });

    const simpleBarSettingsRef = useRef<ISimpleBarSettings>(
        {
            barStyle: "top",
            spacing: 15,
            barLength: 1,
            barWidth: 15,
            beatMultiplier: 2,
            barColor: "white",
            numBars: 55,
            useFullWidth: false,
            xPos: 50,
            yPos: 100
        }
    );


    const backgroundSettingsRef = useRef<IBackgroundSettings>({
        backgroundColor: '#f59292',
        backgroundImage: '',
        shakeIntensity: 0
    });


    const renderingSettingsRef = useRef<IRenderingSettings>({
        bitRateInMb: 6,
    });

    const musicVisSettingsRef = useRef<MusicVisualizationSettings>({
        circle: {
            baseRadius: 22,
            growthFactor: 222,
            color: '#006400',
            imageX: resolutions.FullHD.width / 2,
            imageY: resolutions.FullHD.height / 2,
        },
        bars: {
            widthMultiplier: 155,
            lengthMultiplier: 2,
            color: (i) => `rgb(${i * 2}, ${200 - i * 2}, ${50 + i * 2})`
        }
    });


    const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value} = e.target;
        const [category, key] = name.split('.');
        musicVisSettingsRef.current[category][key] = isNaN(value) ? value : Number(value);
    };

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
        simpleBar: boolean;
    }

    const [settingsVisibility, setSettingsVisibility] = useState<ISettingsVisibility>({
        text: false,
        font: false,
        circle: false,
        background: false,
        render: false,
        musicVisualization: false,
        simpleBar: false,
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
            textSettingsRef.current.fontFile = files[0];
             loadFont(files[0], textSettingsRef);
        }
    };

    const handleFontChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        textSettingsRef.current.selectedFont = event.target.value;
    };


    const fetchDefaultAudioFile = async () => {
        try {
            const response = await fetch(defaultAudio);
            const blob = await response.blob();
            const defaultFile = new File([blob], 'defaultMusic.mp3', {type: 'audio/mpeg'});
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
        } else {
            const defaultFile = await fetchDefaultAudioFile();
            audioRef.current.src = defaultAudio;
            setFile(null);
            setFile(defaultFile);
        }


        setTimeout(() => {
            console.log(renderingSettingsRef.current.bitRateInMb, audioRef.current.duration)
            setEstimatedFileSize(estimateFileSize(renderingSettingsRef.current.bitRateInMb, audioRef.current.duration))
        }, 222)

    };


    const handleSave = () => {
        saveToLocalstorage({
            text: textSettingsRef.current,
            background: backgroundSettingsRef.current,
            circle: circleAnimationSettingsRef.current,
            rendering: renderingSettingsRef.current,
            enableVisuals: enableVisualsSettingsRef.current,
            simpleBars: simpleBarSettingsRef.current,
            extra: {}
        })
    }

    const handleLoad = async () => {
        const options = await loadFromLocalstorage();
        circleAnimationSettingsRef.current = options.circle;
        backgroundSettingsRef.current = options.background;
        textSettingsRef.current = options.text;
        enableVisualsSettingsRef.current = options.enableVisuals;
        renderingSettingsRef.current = options.rendering;
        simpleBarSettingsRef.current = options.simpleBars

        textSettingsRef.current.fontFile = fontFile


        if (fontFile){
            loadFont(fontFile, textSettingsRef);
        }
    }


    const handlePlay = async () => {
        if (!file) {
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

        audioRef.current.playbackRate = 1
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

    let circles: ICircle[] = []

    if (canvasRef.current) {
        circles = initializeCircles(canvasRef.current, circleAnimationSettingsRef.current);
    }


    const startAnimation = () => {
        if (!canvasRef.current) {
            return;
        }
        if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return;

        const ctx = canvasRef.current.getContext('2d');

        if (!ctx) return;

        const animate = () => {
            ctx.clearRect(0,0, canvasRef.current.width, canvasRef.current.height)
            if (backgroundSettingsRef.current.backgroundImage !== null && backgroundSettingsRef.current.backgroundImage !== "") {
                animateBackground(ctx, canvasRef.current, analyserRef.current, dataArrayRef.current, backgroundSettingsRef.current);
            } else {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                ctx.fillStyle = backgroundSettingsRef.current.backgroundColor;
                ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }


            if (enableVisualsSettingsRef.current.backgroundCircles) {
                animateCircles(ctx, circles, analyserRef.current, dataArrayRef.current, circleAnimationSettingsRef.current);
            }

            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = dataArrayRef.current //new Uint8Array(bufferLength);

            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

            if (enableVisualsSettingsRef.current.simpleBar) {
                drawBarVisualization(ctx, bufferLength, dataArray, simpleBarSettingsRef.current)
            }

            if (enableVisualsSettingsRef.current.circleBar) {
                drawMusicVisualization(ctx, bufferLength, dataArray, musicVisSettingsRef.current);
            }

            if (enableVisualsSettingsRef.current.text) {
                animateText(
                    ctx,
                    average,
                    textSettingsRef.current
                );
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };


        animate();
    };

    const handleBackgroundImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) {
            console.warn("no file selected")
            return;
        }
        const file = event.target.files[0];
        const imageUrl = URL.createObjectURL(file);

        setBackgroundImage(imageUrl);

        backgroundSettingsRef.current.backgroundImage = imageUrl;
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


    const [resolution, setResolution] = useState("FullHD");
    const [estimatedFileSize, setEstimatedFileSize] = useState("");
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas && resolutions[resolution]) {
            const {width, height} = resolutions[resolution];
            canvas.width = width;
            canvas.height = height;
            // may need to reinitialize or redraw your canvas content here
        }
    }, [resolution]);

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) {
            console.warn("no file selected")
            return;
        }

        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const newImage = new Image();
                newImage.onload = () => {
                    musicVisSettingsRef.current.circle.image = newImage;
                };
                newImage.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleResolutionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setResolution(event.target.value);
    };

    const canvasWidth = canvasRef.current?.width || 0;
    const canvasHeight = canvasRef.current?.height || 0;

    return (
        <div className="container">
            <div style={{textAlign: 'right', margin: '10px'}}>

                <button onClick={handleSave}>Save</button>
                <button onClick={handleLoad} style={{margin: '5px'}}>Load</button>
            </div>


            <div className="control-group">
                Audio file: <input type="file" onChange={handleFileChange} accept="audio/*"/>
                <div className="container">
                    {/* ... other components and content */}
                    <AudioControls audioRef={audioRef}/>

                    {/*{file && <Recorder key={file.name} audioRef={audioRef} settings={renderingSettingsRef} canvasRef={canvasRef}/>}*/}
                    {/* ... other components and content */}
                </div>
                {/*{file && !isPlaying && <button onClick={handlePlay}>Play</button>}*/}
                <button onClick={handlePlay}>Start & visualize</button>
            </div>


            <div className="group-header" onClick={() => toggleSettings("render")}>
                Render / Export
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
                    <label>
                        Bitrate:
                        <input type="number" defaultValue="6"
                               onChange={(e) => {
                                   renderingSettingsRef.current.bitRateInMb = parseFloat(e.target.value);
                                   console.log(estimateFileSize(renderingSettingsRef.current.bitRateInMb, audioRef.current.duration))
                                   setEstimatedFileSize(estimateFileSize(renderingSettingsRef.current.bitRateInMb, audioRef.current.duration))
                               }}/>MB
                    </label>
                    <hr/>
                    Estimated video file size is: {estimatedFileSize}
                    <label>
                        {file && <Recorder key={file.name} audioRef={audioRef} settings={renderingSettingsRef}
                                           canvasRef={canvasRef}/>}
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
                        Text X Coordinate:
                        <input
                            type="range"
                            name="text.x"
                            min="0"
                            max={canvasWidth}
                            defaultValue="0"
                            onChange={(e) => textSettingsRef.current.x = parseInt(e.target.value)}
                        />
                    </label>
                    <label>
                        Text Y Coordinate:
                        <input
                            type="range"
                            name="text.y"
                            min="0"
                            max={canvasHeight}
                            defaultValue="0"
                            onChange={(e) => textSettingsRef.current.y = parseInt(e.target.value)}
                        />
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


            <div className="group-header" onClick={() => toggleSettings("musicVisualization")}>
                Circle with bars Settings
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
                    <label>
                        Circle Image:
                        <input type="file" onChange={handleImageChange} accept="image/*"/>
                    </label>
                    <label>
                        X Coordinate:
                        <input
                            type="range"
                            name="circle.imageX"
                            min="0"
                            max={canvasWidth}
                            defaultValue={canvasWidth / 2}
                            onChange={handleSettingChange}
                        />
                    </label>
                    <label>
                        Y Coordinate:
                        <input
                            type="range"
                            name="circle.imageY"
                            min="0"
                            max={canvasHeight}
                            defaultValue={musicVisSettingsRef.current.circle.imageY}
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


            <div className="group-header" onClick={() => toggleSettings("simpleBar")}>
                Simple Bar Settings
            </div>
            {settingsVisibility.simpleBar && (
                <div className="settings-group">
                    <label>
                        Bar Style:
                        <select defaultValue="bottom"
                                onChange={e => simpleBarSettingsRef.current.barStyle = e.target.value}>
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                            <option value="both">Both</option>
                        </select>
                    </label>
                    <label>
                        Spacing:
                        <input type="number" defaultValue="11"
                               onChange={e => simpleBarSettingsRef.current.spacing = parseInt(e.target.value)}/>
                    </label>
                    <label>
                        Bar Width:
                        <input type="number" defaultValue="22"
                               onChange={e => simpleBarSettingsRef.current.barWidth = parseInt(e.target.value)}/>
                    </label>
                    <label>
                        Beat Multiplier:
                        <input type="number" defaultValue="2"
                               onChange={e => simpleBarSettingsRef.current.beatMultiplier = parseFloat(e.target.value)}/>
                    </label>
                    <label>
                        Bar Color:
                        <input type="color" defaultValue="#ffffff"
                               onChange={e => simpleBarSettingsRef.current.barColor = e.target.value}/>
                    </label>
                    <label>
                        Number of Bars:
                        <input type="number" defaultValue="11"
                               onChange={e => simpleBarSettingsRef.current.numBars = parseInt(e.target.value)}/>
                    </label>
                    <label>
                        Use Full Width:
                        <input type="checkbox"
                               defaultChecked={simpleBarSettingsRef.current.useFullWidth}
                               onChange={e => simpleBarSettingsRef.current.useFullWidth = e.target.checked}/>
                    </label>

                    <label>
                        X Position (%):
                        <input
                            type="range"
                            min="0"
                            max="100"
                            defaultValue="50"
                            onChange={e => simpleBarSettingsRef.current.xPos = parseInt(e.target.value)}
                        />
                        {simpleBarSettingsRef.current.xPos}%
                    </label>

                    <label>
                        Y Position (%):
                        <input
                            type="range"
                            min="0"
                            max="100"
                            defaultValue="50"
                            onChange={e => simpleBarSettingsRef.current.yPos = parseInt(e.target.value)}
                        />
                        {simpleBarSettingsRef.current.yPos}%
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


            <div className="visuals-settings">
                <label>
                    Enable Simple Bar:
                    <input
                        type="checkbox"
                        defaultChecked={enableVisualsSettingsRef.current.simpleBar}
                        onChange={(e) => enableVisualsSettingsRef.current.simpleBar = e.target.checked}
                    />
                </label>

                <label>
                    Enable Circle Bar:
                    <input
                        type="checkbox"
                        defaultChecked={enableVisualsSettingsRef.current.circleBar}
                        onChange={(e) => enableVisualsSettingsRef.current.circleBar = e.target.checked}
                    />
                </label>

                <label>
                    Enable Background Circles:
                    <input
                        type="checkbox"
                        defaultChecked={enableVisualsSettingsRef.current.backgroundCircles}
                        onChange={(e) => enableVisualsSettingsRef.current.backgroundCircles = e.target.checked}
                    />
                </label>

                <label>
                    Enable Text:
                    <input
                        type="checkbox"
                        defaultChecked={enableVisualsSettingsRef.current.text}
                        onChange={(e) => enableVisualsSettingsRef.current.text = e.target.checked}
                    />
                </label>
            </div>


            <canvas ref={canvasRef} style={{width: "80%", height: "auto"}} width="1920" height="1080"></canvas>
            <audio ref={audioRef} crossOrigin="anonymous"/>
        </div>

    );


};


export default App;
