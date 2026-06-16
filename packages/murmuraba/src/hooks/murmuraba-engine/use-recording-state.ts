import { useState, useCallback } from 'react';
import { RecordingState, ProcessedChunk } from './types';

export interface UseRecordingStateReturn {
  recordingState: RecordingState;
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  addChunk: (chunk: ProcessedChunk) => void;
  toggleChunkPlayback: (chunkId: string, isPlaying: boolean, audioType?: 'processed' | 'original') => void;
  toggleChunkExpansion: (chunkId: string) => void;
  clearRecordings: () => void;
  updateRecordingTime: (time: number) => void;
}

export function useRecordingState(): UseRecordingStateReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    chunks: [],
    playingChunks: {},
    expandedChunk: null
  });

  const startRecording = useCallback(() => {
    setRecordingState(prev => ({
      ...prev,
      isRecording: true,
      isPaused: false,
      recordingTime: 0,
      chunks: []
    }));
  }, []);

  const stopRecording = useCallback(() => {
    setRecordingState(prev => ({
      ...prev,
      isRecording: false,
      isPaused: false,
      recordingTime: 0
    }));
  }, []);

  const pauseRecording = useCallback(() => {
    setRecordingState(prev => ({
      ...prev,
      isPaused: true
    }));
  }, []);

  const resumeRecording = useCallback(() => {
    setRecordingState(prev => ({
      ...prev,
      isPaused: false
    }));
  }, []);

  const addChunk = useCallback((chunk: ProcessedChunk) => {
    setRecordingState(prev => ({
      ...prev,
      chunks: [...prev.chunks, chunk]
    }));
  }, []);

  const toggleChunkPlayback = useCallback((chunkId: string, isPlaying: boolean, audioType?: 'processed' | 'original') => {
    setRecordingState(prev => ({
      ...prev,
      playingChunks: {
        ...prev.playingChunks,
        [chunkId]: isPlaying
      },
      chunks: prev.chunks.map(chunk =>
        chunk.id === chunkId 
          ? { 
              ...chunk, 
              isPlaying,
              currentlyPlayingType: isPlaying ? audioType : null
            } 
          : { 
              ...chunk, 
              isPlaying: false, // Stop other chunks when starting new one
              currentlyPlayingType: null 
            }
      )
    }));
  }, []);

  const toggleChunkExpansion = useCallback((chunkId: string) => {
    setRecordingState(prev => ({
      ...prev,
      expandedChunk: prev.expandedChunk === chunkId ? null : chunkId,
      chunks: prev.chunks.map(chunk =>
        chunk.id === chunkId ? { ...chunk, isExpanded: !chunk.isExpanded } : chunk
      )
    }));
  }, []);

  const clearRecordings = useCallback(() => {
    setRecordingState(prev => ({
      ...prev,
      chunks: []
    }));
  }, []);

  const updateRecordingTime = useCallback((time: number) => {
    setRecordingState(prev => ({
      ...prev,
      recordingTime: time
    }));
  }, []);

  return {
    recordingState,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    addChunk,
    toggleChunkPlayback,
    toggleChunkExpansion,
    clearRecordings,
    updateRecordingTime
  };
}