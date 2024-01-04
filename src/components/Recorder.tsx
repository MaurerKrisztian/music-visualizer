import React, {useState, useRef} from 'react';
import {IRenderingSettings} from "../elements/saveLoad.ts";


export function bpsToMbps(bps: number): number {
    return bps / (1024 * 1024);
}

export function mbpsToBps(mbps: number): number {
    return mbps * (1024 * 1024);
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



const Recorder = ({audioRef, canvasRef, settings}: {
    audioRef: React.MutableRefObject<HTMLAudioElement & {
        captureStream(...args): MediaStream;
    }>; canvasRef: React.RefObject<HTMLCanvasElement>;
    settings: React.RefObject<IRenderingSettings>
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);


    const startRecording = () => {

        const { bitRateInMb  } = settings.current || {bitRateInMb: 4};

        if (audioRef.current && canvasRef.current) {
            const audioStream = audioRef.current.captureStream(65);
            const canvasStream = canvasRef.current.captureStream(65); // Try 25 FPS

            console.log("Audio Stream Tracks:", audioStream.getTracks());
            console.log("Canvas Stream Tracks:", canvasStream.getTracks());

            const combinedStream = new MediaStream([...canvasStream.getTracks(), ...audioStream.getTracks()]);
            console.log("Combined Stream Tracks:", combinedStream.getTracks());

            console.log(`Recording bitrate is: ${bitRateInMb}MB`)
            console.log(bitRateInMb, audioRef.current.duration)
            console.log(`Recording estimate size is:  ${estimateFileSize(bitRateInMb, audioRef.current.duration)}  based on duration: ${audioRef.current.duration}s and framerate: ${bitRateInMb} MB`)
            mediaRecorderRef.current = new MediaRecorder(combinedStream, {
                mimeType: 'video/webm; codecs=H264',
                videoBitsPerSecond: mbpsToBps(bitRateInMb),
                bitsPerSecond: mbpsToBps(bitRateInMb)
            });

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };
        }


        recordedChunksRef.current = [];
        mediaRecorderRef.current.start();
        setIsRecording(true);
    };

    const stopRecording = () => {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        saveRecording()
    };

    const saveRecording = () => {
        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, {type: 'video/webm'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'recording.webm';
            a.click();
            URL.revokeObjectURL(url);
        };
    };

    return (
        <div className="recorder-controls">
            <button onClick={isRecording ? stopRecording : startRecording}>
                {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
        </div>
    );
};

export default Recorder;
