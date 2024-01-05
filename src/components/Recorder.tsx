import React, { useState, useRef, useEffect } from 'react';

export function mbpsToBps(mbps) {
    return mbps * (1024 * 1024);
}

export function bpsToMbps(bps: number): number {
    return bps / (1024 * 1024);
}


export function estimateFileSize(bitrateMbps: number, videoLengthSeconds: number): string {

    // Convert bitrate to bits per second
    const bitrateBps = bitrateMbps * 1024 * 1024;

    // Calculate file size in bytes
    const fileSizeBytes = bitrateBps * videoLengthSeconds / 8; // Dividing by 8 to convert bits to bytes

    // Convert file size to gigabytes
    const fileSizeGB = fileSizeBytes / (1024 ** 3);

    if (fileSizeGB >= 1) {
        return `${fileSizeGB.toFixed(2)} GB`;
    } else {
        // Convert file size to megabytes if less than 1 GB
        const fileSizeMB = fileSizeBytes / (1024 ** 2);
        return `${fileSizeMB.toFixed(2)} MB`;
    }
}

const Recorder = ({ audioRef, canvasRef, settings }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [currentFileSize, setCurrentFileSize] = useState(0);
    const [audioProgress, setAudioProgress] = useState(0);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const progressIntervalRef = useRef(null);

    useEffect(() => {
        recordedChunksRef.current = [];
        setCurrentFileSize(0);
        setAudioProgress(0);
    }, [isRecording]);

    const startRecording = () => {
        if (audioRef.current && canvasRef.current) {
            const audioStream = audioRef.current.captureStream(60);
            const canvasStream = canvasRef.current.captureStream(60);
            const combinedStream = new MediaStream([...canvasStream.getTracks(), ...audioStream.getTracks()]);

            const bitRateInMb = settings.current.bitRateInMb || 4;
            mediaRecorderRef.current = new MediaRecorder(combinedStream, {
                mimeType: 'video/webm; codecs=vp9',
                videoBitsPerSecond: mbpsToBps(bitRateInMb),
                bitsPerSecond: mbpsToBps(bitRateInMb)
            });

            recordedChunksRef.current = [];
            setCurrentFileSize(0);

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                    setCurrentFileSize(currentFileSize => currentFileSize + event.data.size);
                }
            };

            mediaRecorderRef.current.start(1000); // Generate data every 1000ms
            setIsRecording(true);

            // Start updating audio progress
            progressIntervalRef.current = setInterval(() => {
                if (audioRef.current && audioRef.current.duration) {
                    setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
                }
            }, 1000); // Update every second

            audioRef.current.onended = () => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                    stopRecording();
                }
            };


            audioRef.current.play();
        }
    };


    const stopRecording = () => {

        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            clearInterval(progressIntervalRef.current); // Stop updating progress
            setIsRecording(false);
            saveRecording()
        }
    };


    const saveRecording = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'recording.webm';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    };

    useEffect(() => {
        if (!isRecording && recordedChunksRef.current.length > 0) {
            saveRecording();
        }
    }, [isRecording]);

    const formatFileSize = (size) => {
        if (size >= 1e6) {
            return `${(size / 1e6).toFixed(2)} MB`;
        } else if (size >= 1e3) {
            return `${(size / 1e3).toFixed(2)} KB`;
        } else {
            return `${size} bytes`;
        }
    };


    return (
        <div className="recorder-controls">
            <button onClick={isRecording ? stopRecording : startRecording}>
                {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
            {isRecording && (
                <>
                    <p>Current File Size: {formatFileSize(currentFileSize)}</p>
                    <p>Audio Progress: {audioProgress.toFixed(2)}%</p>
                </>
            )}
        </div>
    );
};

export default Recorder;
