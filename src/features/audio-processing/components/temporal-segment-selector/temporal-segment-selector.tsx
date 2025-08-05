'use client';

import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSusurro } from '@susurro/core';
import type { CompleteAudioResult, StreamingSusurroChunk } from '@susurro/core';

export interface VoiceNotesOrganizerProps {
  onBack: () => void;
}

// Voice note interface
interface VoiceNote {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  category: string;
  priority: 'low' | 'medium' | 'high';
  result?: CompleteAudioResult;
  recorded: number;
  updated: number;
  status: 'recording' | 'processing' | 'completed' | 'error';
  duration?: number;
  error?: string;
}

// Organization categories
const CATEGORIES = [
  'Meeting Notes',
  'Ideas',
  'Reminders',
  'Journal',
  'Research',
  'Education',
  'Personal',
  'Work',
  'Project',
  'Other',
];

// Predefined tags
// const COMMON_TAGS = [
//   'urgent', 'important', 'followup', 'idea', 'meeting',
//   'todo', 'research', 'personal', 'work', 'project'
// ];

export const TemporalSegmentSelector: React.FC<VoiceNotesOrganizerProps> = ({ onBack }) => {
  // 🚀 CONSOLIDATED SUSURRO - Voice notes management system
  const {
    // File processing for uploaded notes
    processAndTranscribeFile,

    // Streaming recording for new notes
    startStreamingRecording,
    stopStreamingRecording,

    // Engine status
    isEngineInitialized,
    whisperReady,
    whisperProgress,
    initializeAudioEngine,
  } = useSusurro({
    chunkDurationMs: 2000,
    whisperConfig: {
      language: 'en',
    },
  });

  // Voice notes state
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [selectedNote, setSelectedNote] = useState<VoiceNote | null>(null);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Organization filters
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPriority] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'priority'>('date');

  // New note creation
  const [newNoteForm, setNewNoteForm] = useState({
    title: '',
    description: '',
    category: 'Ideas',
    priority: 'medium' as VoiceNote['priority'],
    tags: [] as string[],
  });
  const [showNewNoteForm, setShowNewNoteForm] = useState(false);

  // 🎤 CREATE NEW VOICE NOTE
  const startNewVoiceNote = useCallback(async () => {
    if (!isEngineInitialized || !whisperReady) {
      if (!isEngineInitialized) {
        try {
          await initializeAudioEngine();
        } catch (error) {
          setStatus(`[ERROR] Engine initialization failed: ${error}`);
          return;
        }
      }
      return;
    }

    // Validate form
    if (!newNoteForm.title.trim()) {
      setStatus('[ERROR] Please enter a title for your note');
      return;
    }

    const newNote: VoiceNote = {
      id: `note-${Date.now()}`,
      title: newNoteForm.title,
      description: newNoteForm.description,
      category: newNoteForm.category,
      priority: newNoteForm.priority,
      tags: newNoteForm.tags,
      recorded: Date.now(),
      updated: Date.now(),
      status: 'recording',
    };

    setNotes((prev) => [newNote, ...prev]);
    setSelectedNote(newNote);
    setIsRecording(true);
    setCurrentTranscription('');
    setStatus(`[RECORDING_NOTE] "${newNote.title}"`);

    // Real-time transcription
    const onChunkProcessed = (chunk: StreamingSusurroChunk) => {
      if (chunk.isVoiceActive && chunk.transcriptionText.trim()) {
        setCurrentTranscription((prev) => prev + ' ' + chunk.transcriptionText.trim());
      }
    };

    try {
      await startStreamingRecording(onChunkProcessed, {
        chunkDuration: 3, // Longer chunks for voice notes
        vadThreshold: 0.3,
        enableRealTimeTranscription: true,
        enableNoiseReduction: true,
      });
    } catch (error) {
      setIsRecording(false);
      setStatus(`[ERROR] ${error}`);
    }
  }, [
    isEngineInitialized,
    whisperReady,
    initializeAudioEngine,
    startStreamingRecording,
    newNoteForm,
  ]);

  const stopVoiceNote = useCallback(async () => {
    if (!selectedNote) return;

    try {
      const allChunks = await stopStreamingRecording();
      setIsRecording(false);

      // Create audio blob from chunks for processing
      if (allChunks.length > 0 && currentTranscription.trim()) {
        // Update note with processing status
        setNotes((prev) =>
          prev.map((note) =>
            note.id === selectedNote.id
              ? { ...note, status: 'processing', updated: Date.now() }
              : note
          )
        );

        setStatus(`[PROCESSING_NOTE] "${selectedNote.title}"`);

        // Simulate processing (in real implementation, would process actual audio)
        setTimeout(() => {
          const mockResult: CompleteAudioResult = {
            originalAudioUrl: URL.createObjectURL(new Blob()),
            processedAudioUrl: URL.createObjectURL(new Blob()),
            transcriptionText: currentTranscription,
            vadAnalysis: {
              averageVad: 0.75,
              vadScores: [],
              metrics: [],
              voiceSegments: [],
            },
            metadata: {
              duration: 30,
              sampleRate: 44100,
              channels: 1,
              fileSize: 1024,
              processedSize: 1024,
            },
            processingTime: 2000,
          };

          setNotes((prev) =>
            prev.map((note) =>
              note.id === selectedNote.id
                ? {
                    ...note,
                    status: 'completed',
                    result: mockResult,
                    duration: mockResult.metadata.duration,
                    updated: Date.now(),
                  }
                : note
            )
          );

          setStatus(
            `[NOTE_SAVED] "${selectedNote.title}" - ${currentTranscription.length} characters`
          );
          setSelectedNote(null);
          setCurrentTranscription('');

          // Reset form
          setNewNoteForm({
            title: '',
            description: '',
            category: 'Ideas',
            priority: 'medium',
            tags: [],
          });
          setShowNewNoteForm(false);
        }, 2000);
      } else {
        // No transcription, mark as error
        setNotes((prev) =>
          prev.map((note) =>
            note.id === selectedNote.id
              ? { ...note, status: 'error', error: 'No audio detected', updated: Date.now() }
              : note
          )
        );
        setStatus('[ERROR] No audio detected in recording');
      }
    } catch (error) {
      setStatus(`[ERROR] Failed to save note: ${error}`);
    }
  }, [selectedNote, stopStreamingRecording, currentTranscription]);

  // 📁 IMPORT AUDIO FILE AS NOTE
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const importedNote: VoiceNote = {
        id: `imported-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        category: 'Other',
        priority: 'medium',
        tags: ['imported'],
        recorded: Date.now(),
        updated: Date.now(),
        status: 'processing',
      };

      setNotes((prev) => [importedNote, ...prev]);
      setStatus(`[IMPORTING_NOTE] "${importedNote.title}"`);

      try {
        const result = await processAndTranscribeFile(file);

        setNotes((prev) =>
          prev.map((note) =>
            note.id === importedNote.id
              ? {
                  ...note,
                  status: 'completed',
                  result,
                  duration: result.metadata.duration,
                  updated: Date.now(),
                }
              : note
          )
        );

        setStatus(`[NOTE_IMPORTED] "${importedNote.title}"`);
      } catch (error) {
        setNotes((prev) =>
          prev.map((note) =>
            note.id === importedNote.id
              ? { ...note, status: 'error', error: 'Import failed', updated: Date.now() }
              : note
          )
        );
        setStatus(`[ERROR] Failed to import: ${error}`);
      }
    },
    [processAndTranscribeFile]
  );

  // 🏷️ TAG MANAGEMENT
  /* const addTagToNote = useCallback((noteId: string, tag: string) => {
    setNotes(prev => prev.map(note => 
      note.id === noteId 
        ? { ...note, tags: [...new Set([...note.tags, tag])], updated: Date.now() }
        : note
    ));
  }, []); */

  const removeTagFromNote = useCallback((noteId: string, tag: string) => {
    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId
          ? { ...note, tags: note.tags.filter((t) => t !== tag), updated: Date.now() }
          : note
      )
    );
  }, []);

  // 🔍 FILTERING AND SORTING
  const filteredNotes = notes
    .filter((note) => {
      const matchesCategory = filterCategory === 'all' || note.category === filterCategory;
      const matchesPriority = filterPriority === 'all' || note.priority === filterPriority;
      const matchesSearch =
        searchQuery === '' ||
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.result?.transcriptionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesCategory && matchesPriority && matchesSearch;
    })
    .sort((a, b) => {
      let priorityOrder: Record<string, number>;
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'priority':
          priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'date':
        default:
          return b.updated - a.updated;
      }
    });

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        color: '#00ff41',
        padding: '20px',
        background:
          'radial-gradient(ellipse at center, rgba(0, 20, 0, 0.9) 0%, rgba(0, 0, 0, 0.95) 100%)',
      }}
    >
      <button className="matrix-back-button" onClick={onBack}>
        [&lt; BACK_TO_MATRIX]
      </button>

      <div className="matrix-grid" />

      <div
        style={{
          maxWidth: '1400px',
          margin: '40px auto',
          background: 'rgba(0, 0, 0, 0.9)',
          border: '2px solid #00ff41',
          padding: '30px',
          backdropFilter: 'blur(15px)',
          boxShadow: '0 0 40px rgba(0, 255, 65, 0.3)',
        }}
      >
        {/* Header */}
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontSize: '2.5rem',
            marginBottom: '20px',
            textAlign: 'center',
            textShadow: '0 0 20px #00ff41',
            background: 'linear-gradient(45deg, #00ff41, #00cc33)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          &gt; SUSURRO_VOICE_NOTES &lt;
        </motion.h1>

        {/* Status */}
        {status && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`matrix-status ${status.includes('ERROR') ? 'error' : ''}`}
            style={{
              marginBottom: '20px',
              padding: '12px',
              background: status.includes('ERROR')
                ? 'rgba(255, 0, 0, 0.1)'
                : isRecording
                  ? 'rgba(255, 255, 0, 0.1)'
                  : 'rgba(0, 255, 65, 0.1)',
              border: `1px solid ${status.includes('ERROR') ? '#ff0041' : isRecording ? '#ffff00' : '#00ff41'}`,
              textAlign: 'center',
            }}
          >
            &gt; {status}
          </motion.div>
        )}

        {/* Action Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '30px',
            flexWrap: 'wrap',
            gap: '15px',
          }}
        >
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => setShowNewNoteForm(!showNewNoteForm)}
              className="matrix-button"
              disabled={isRecording}
              style={{
                padding: '10px 20px',
                fontSize: '0.9rem',
                background: showNewNoteForm ? 'rgba(255, 255, 0, 0.2)' : 'rgba(0, 255, 65, 0.1)',
                borderColor: showNewNoteForm ? '#ffff00' : '#00ff41',
                color: showNewNoteForm ? '#ffff00' : '#00ff41',
                opacity: isRecording ? 0.5 : 1,
              }}
            >
              🎤 [NEW_VOICE_NOTE]
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="matrix-button"
              disabled={isRecording}
              style={{
                padding: '10px 20px',
                fontSize: '0.9rem',
                background: 'rgba(0, 100, 255, 0.1)',
                border: '1px solid #0064ff',
                color: '#0064ff',
                opacity: isRecording ? 0.5 : 1,
              }}
            >
              📁 [IMPORT_AUDIO]
            </button>
          </div>

          {/* Search and Filter */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid #00ff41',
                color: '#00ff41',
                padding: '8px 12px',
                fontSize: '0.9rem',
                width: '200px',
              }}
            />

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid #00ff41',
                color: '#00ff41',
                padding: '8px 12px',
                fontSize: '0.9rem',
              }}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'title' | 'priority')}
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid #00ff41',
                color: '#00ff41',
                padding: '8px 12px',
                fontSize: '0.9rem',
              }}
            >
              <option value="date">Sort by Date</option>
              <option value="title">Sort by Title</option>
              <option value="priority">Sort by Priority</option>
            </select>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />

        {!whisperReady && (
          <div style={{ marginBottom: '20px', textAlign: 'center', fontSize: '0.9rem' }}>
            [LOADING_WHISPER: {(whisperProgress * 100).toFixed(0)}%]
          </div>
        )}

        {/* New Note Form */}
        <AnimatePresence>
          {showNewNoteForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                background: 'rgba(255, 255, 0, 0.05)',
                border: '1px solid #ffff00',
                padding: '20px',
                marginBottom: '20px',
                color: '#ffff00',
              }}
            >
              <h3 style={{ marginBottom: '15px' }}>📝 CREATE_NEW_VOICE_NOTE</h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '15px',
                  marginBottom: '15px',
                }}
              >
                <input
                  type="text"
                  placeholder="Note title..."
                  value={newNoteForm.title}
                  onChange={(e) => setNewNoteForm((prev) => ({ ...prev, title: e.target.value }))}
                  style={{
                    background: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid #ffff00',
                    color: '#ffff00',
                    padding: '10px',
                    fontSize: '1rem',
                  }}
                />

                <select
                  value={newNoteForm.category}
                  onChange={(e) =>
                    setNewNoteForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                  style={{
                    background: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid #ffff00',
                    color: '#ffff00',
                    padding: '10px',
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                placeholder="Description (optional)..."
                value={newNoteForm.description}
                onChange={(e) =>
                  setNewNoteForm((prev) => ({ ...prev, description: e.target.value }))
                }
                style={{
                  width: '100%',
                  height: '60px',
                  background: 'rgba(0, 0, 0, 0.8)',
                  border: '1px solid #ffff00',
                  color: '#ffff00',
                  padding: '10px',
                  fontSize: '0.9rem',
                  marginBottom: '15px',
                  resize: 'none',
                }}
              />

              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <select
                  value={newNoteForm.priority}
                  onChange={(e) =>
                    setNewNoteForm((prev) => ({
                      ...prev,
                      priority: e.target.value as VoiceNote['priority'],
                    }))
                  }
                  style={{
                    background: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid #ffff00',
                    color: '#ffff00',
                    padding: '8px 12px',
                  }}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>

                <button
                  onClick={isRecording ? stopVoiceNote : startNewVoiceNote}
                  disabled={!whisperReady}
                  className="matrix-button"
                  style={{
                    padding: '12px 24px',
                    fontSize: '1rem',
                    background: isRecording ? 'rgba(255, 0, 0, 0.2)' : 'rgba(255, 255, 0, 0.1)',
                    borderColor: isRecording ? '#ff0041' : '#ffff00',
                    color: isRecording ? '#ff0041' : '#ffff00',
                    opacity: !whisperReady ? 0.5 : 1,
                  }}
                >
                  {isRecording ? '⏹️ [STOP_&_SAVE]' : '🎤 [START_RECORDING]'}
                </button>
              </div>

              {/* Live Transcription Preview */}
              {isRecording && currentTranscription && (
                <div
                  style={{
                    marginTop: '15px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 0, 0.3)',
                    padding: '12px',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '8px' }}>
                    LIVE_TRANSCRIPTION:
                  </div>
                  <div style={{ fontSize: '0.9rem' }}>
                    {currentTranscription}
                    <span
                      style={{
                        opacity: 0.7,
                        animation: 'blink 1s infinite',
                        marginLeft: '5px',
                      }}
                    >
                      █
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notes List */}
        <div
          style={{
            background: 'rgba(0, 255, 65, 0.05)',
            border: '1px solid #00ff41',
            padding: '20px',
          }}
        >
          <h3 style={{ marginBottom: '15px' }}>
            📚 VOICE_NOTES_LIBRARY ({filteredNotes.length} notes)
          </h3>

          {filteredNotes.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                opacity: 0.7,
                fontSize: '1.1rem',
              }}
            >
              {notes.length === 0
                ? 'No voice notes yet. Create your first note!'
                : 'No notes match your current filters.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '15px' }}>
              <AnimatePresence>
                {filteredNotes.map((note) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    style={{
                      background: 'rgba(0, 255, 65, 0.05)',
                      border: `1px solid ${
                        note.status === 'completed'
                          ? '#00ff41'
                          : note.status === 'error'
                            ? '#ff0041'
                            : note.status === 'processing'
                              ? '#ffff00'
                              : 'rgba(0, 255, 65, 0.3)'
                      }`,
                      padding: '20px',
                      position: 'relative',
                    }}
                  >
                    {/* Note Header */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start',
                        marginBottom: '15px',
                      }}
                    >
                      <div>
                        <h4 style={{ fontSize: '1.2rem', marginBottom: '5px', color: '#00ff41' }}>
                          {note.title}
                        </h4>
                        <div
                          style={{ display: 'flex', gap: '15px', fontSize: '0.8rem', opacity: 0.7 }}
                        >
                          <span>[{note.category}]</span>
                          <span>Priority: {note.priority.toUpperCase()}</span>
                          <span>{new Date(note.recorded).toLocaleDateString()}</span>
                          {note.duration && <span>{note.duration.toFixed(1)}s</span>}
                        </div>
                      </div>

                      <div style={{ fontSize: '0.8rem', opacity: 0.8, textAlign: 'right' }}>
                        <div
                          style={{
                            color:
                              note.status === 'completed'
                                ? '#00ff41'
                                : note.status === 'error'
                                  ? '#ff0041'
                                  : note.status === 'processing'
                                    ? '#ffff00'
                                    : '#00ff41',
                          }}
                        >
                          [{note.status.toUpperCase()}]
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {note.description && (
                      <div style={{ marginBottom: '15px', fontSize: '0.9rem', opacity: 0.8 }}>
                        {note.description}
                      </div>
                    )}

                    {/* Tags */}
                    {note.tags.length > 0 && (
                      <div style={{ marginBottom: '15px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {note.tags.map((tag, index) => (
                            <span
                              key={index}
                              style={{
                                background: 'rgba(0, 100, 255, 0.1)',
                                border: '1px solid #0064ff',
                                color: '#0064ff',
                                padding: '3px 8px',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                              }}
                              onClick={() => removeTagFromNote(note.id, tag)}
                            >
                              #{tag} ×
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transcription */}
                    {note.result?.transcriptionText && (
                      <div
                        style={{
                          background: 'rgba(0, 0, 0, 0.5)',
                          border: '1px solid rgba(0, 255, 65, 0.3)',
                          padding: '15px',
                          marginTop: '15px',
                          maxHeight: '150px',
                          overflow: 'auto',
                        }}
                      >
                        <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '8px' }}>
                          TRANSCRIPTION:
                        </div>
                        <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                          {note.result.transcriptionText}
                        </div>
                      </div>
                    )}

                    {/* Error Display */}
                    {note.error && (
                      <div
                        style={{
                          background: 'rgba(255, 0, 0, 0.1)',
                          border: '1px solid #ff0041',
                          padding: '10px',
                          marginTop: '10px',
                          color: '#ff0041',
                          fontSize: '0.9rem',
                        }}
                      >
                        Error: {note.error}
                      </div>
                    )}

                    {/* Processing Indicator */}
                    {note.status === 'processing' && (
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        style={{
                          position: 'absolute',
                          top: '15px',
                          right: '15px',
                          width: '12px',
                          height: '12px',
                          background: '#ffff00',
                          borderRadius: '50%',
                        }}
                      />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div
          style={{
            marginTop: '30px',
            padding: '20px',
            background: 'rgba(0, 255, 65, 0.05)',
            fontSize: '0.9rem',
            opacity: 0.8,
            border: '1px solid rgba(0, 255, 65, 0.3)',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
            &gt; VOICE_NOTES_ORGANIZER_INSTRUCTIONS:
          </div>
          <div style={{ lineHeight: '1.6' }}>
            🎤 <strong>NEW NOTE:</strong> Create categorized voice notes with real-time
            transcription
            <br />
            📁 <strong>IMPORT:</strong> Upload existing audio files to add to your collection
            <br />
            🔍 <strong>ORGANIZE:</strong> Search, filter by category/priority, and sort your notes
            <br />
            🏷️ <strong>TAGS:</strong> Click tags to remove them, use search to find by content
            <br />
            <br />
            <span style={{ color: '#ffff00' }}>
              Perfect for meeting notes, ideas, reminders, and personal audio journaling!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
