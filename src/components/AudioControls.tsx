import React, {useEffect, useState} from 'react';

const AudioControls = ({audioRef}: { audioRef: React.MutableRefObject<HTMLAudioElement> }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1); // Range from 0 to 1

    const togglePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = parseInt(e.target.value);
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        audioRef.current.volume = newVolume;
        setVolume(newVolume);
    };

    useEffect(() => {
        const interval = setInterval(() => {
            if (audioRef.current && isPlaying) {
                setCurrentTime(audioRef.current.currentTime);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isPlaying, audioRef]);

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    };

    return (
        <div className="audio-controls">
            <button onClick={togglePlayPause}>
                {isPlaying ? 'Pause' : 'Play'}
            </button>

            <div className="time-slider">
                <span className="current-time">{formatTime(currentTime)}</span>
                <input
                    type="range"
                    style={{width: '100%'}} // Set width to 100%
                    min="0"
                    max={audioRef.current?.duration || 100}
                    value={currentTime}
                    onChange={handleTimeChange}
                />
            </div>


            <img src="./assets/volume.svg" alt="Description of SVG" width={25} height={25}/> <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
        />
        </div>
    );
};
export default AudioControls;
