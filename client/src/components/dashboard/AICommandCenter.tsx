import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Paperclip, Image, Send, X, FileText, Sparkles, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../ui/Button';

const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface AttachedFile {
  file: File;
  name: string;
  type: string;
  size: number;
}

interface AICommandCenterProps {
  onScheduleUpdated?: () => void;
}

export function AICommandCenter({ onScheduleUpdated }: AICommandCenterProps) {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const isWebSpeechSupported =
    typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const isMediaRecorderSupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';
  const isVoiceSupported = isWebSpeechSupported || isMediaRecorderSupported;

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [fileError, setFileError] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [pendingProposal, setPendingProposal] = useState<any>(null);
  const [aiStatus, setAiStatus] = useState<any>({ configured: false, connected: false });
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const baseTextRef = useRef('');
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    api.getAIStatus()
      .then((status) => setAiStatus(status))
      .catch(() => {});
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    if (isThinking) return;

    const userText = input.trim();
    setIsThinking(true);
    setAiResponse(null);
    setActionMessage(null);

    try {
      if (!aiStatus.configured) {
        setAiResponse({
          explanation: `Gemini API key is not yet configured in server/.env. LifeOS is ready to receive instructions as soon as you add GEMINI_API_KEY.`,
          isConfigError: true,
        });
        setIsThinking(false);
        return;
      }

      const res = await api.sendAICommand(userText);
      setAiResponse(res);
      if (res.proposal) {
        setPendingProposal(res.proposal);
      }
      setInput('');
      setAttachedFiles([]);
      if (onScheduleUpdated) onScheduleUpdated();
    } catch (err: any) {
      setAiResponse({
        explanation: err.message || 'Error communicating with Gemini API',
        isError: true,
      });
    } finally {
      setIsThinking(false);
    }
  }, [input, attachedFiles, isThinking, aiStatus, onScheduleUpdated]);

  const handleApproveProposal = async () => {
    if (!pendingProposal?.id) return;
    try {
      await api.acceptProposal(pendingProposal.id);
      setPendingProposal(null);
      setActionMessage('✓ Plan approved and tasks added to your schedule!');
      if (onScheduleUpdated) onScheduleUpdated();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDismissProposal = async () => {
    if (!pendingProposal?.id) return;
    try {
      await api.rejectProposal(pendingProposal.id);
      setPendingProposal(null);
    } catch {
      // Ignore dismiss error
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const startMediaRecorder = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setSpeechError('Microphone audio recording is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType =
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }

        const effectiveMime = mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: effectiveMime });
        if (blob.size === 0) return;

        setIsTranscribingAudio(true);
        setSpeechError(null);

        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64Data = (reader.result as string).split(',')[1];
            if (!base64Data) {
              setIsTranscribingAudio(false);
              return;
            }

            const res = await api.transcribeAudio({
              audioBase64: base64Data,
              mimeType: effectiveMime,
            });

            if (res.transcript) {
              setInput((prev) => (prev ? prev.trim() + ' ' : '') + res.transcript);
            }
          } catch (transcribeErr: any) {
            setSpeechError(transcribeErr.message || 'Error transcribing speech with AI.');
          } finally {
            setIsTranscribingAudio(false);
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      setIsRecording(true);
      setSpeechError(null);
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      setIsRecording(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setSpeechError(
          'Microphone permission blocked. Please check your browser site permissions AND ensure Windows Settings → Privacy & security → Microphone ("Let desktop apps access your microphone") is turned ON.'
        );
      } else if (err.name === 'NotFoundError') {
        setSpeechError('No microphone hardware detected. Please check your Windows Sound settings.');
      } else {
        setSpeechError(err.message || 'Could not access microphone.');
      }
    }
  }, []);

  const startWebSpeech = useCallback(() => {
    try {
      const SpeechRecognitionClass = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (!SpeechRecognitionClass) {
        startMediaRecorder();
        return;
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      baseTextRef.current = input ? input.trim() + ' ' : '';

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript;
        }
        setInput(baseTextRef.current + fullTranscript);
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission was denied. Please allow microphone access in your browser settings.');
        } else if (event.error === 'no-speech') {
          setSpeechError('No speech detected. Please make sure your microphone is working and speak clearly.');
        } else if (event.error === 'network') {
          console.info('Speech recognition network error, trying audio fallback...');
          startMediaRecorder();
        } else if (event.error === 'audio-capture') {
          if (navigator.mediaDevices?.enumerateDevices) {
            navigator.mediaDevices
              .enumerateDevices()
              .then((devices) => {
                const hasAudio = devices.some((d) => d.kind === 'audioinput');
                if (hasAudio) {
                  setSpeechError(
                    'Microphone detected, but Windows is blocking your browser. Open Windows Settings → Privacy & security → Microphone → turn ON "Let desktop apps access your microphone".'
                  );
                } else {
                  setSpeechError(
                    'No microphone input detected. Please verify your microphone is plugged in and enabled in Windows Sound Settings.'
                  );
                }
              })
              .catch(() => {
                setSpeechError(
                  'Cannot capture microphone audio. In Windows, check Settings → Privacy & security → Microphone → turn ON "Let desktop apps access your microphone".'
                );
              });
          } else {
            setSpeechError(
              'Cannot capture microphone audio. In Windows, check Settings → Privacy & security → Microphone → turn ON "Let desktop apps access your microphone".'
            );
          }
        } else {
          setSpeechError(`Voice input error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      setSpeechError(null);
    } catch (err: any) {
      console.warn('Web Speech start failed, falling back to MediaRecorder:', err);
      startMediaRecorder();
    }
  }, [input, startMediaRecorder]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
        mediaRecorderRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    setSpeechError(null);
    if (isWebSpeechSupported) {
      startWebSpeech();
    } else if (isMediaRecorderSupported) {
      startMediaRecorder();
    } else {
      setSpeechError('Voice recording is not supported in this browser environment.');
    }
  }, [isRecording, isWebSpeechSupported, isMediaRecorderSupported, startWebSpeech, startMediaRecorder]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!SUPPORTED_FILE_TYPES.includes(file.type)) {
        setFileError(`Unsupported file type: ${file.name}. Use PDF, DOCX, TXT, JPG, PNG, or WEBP.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`File too large: ${file.name}. Maximum size is 10 MB.`);
        continue;
      }
      setAttachedFiles((prev) => [
        ...prev,
        { file, name: file.name, type: file.type, size: file.size },
      ]);
    }
    e.target.value = '';
  }, []);

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return Image;
    return FileText;
  };

  return (
    <div className="space-y-3">
      {/* Configuration notice if API key is not configured */}
      {!aiStatus.configured && (
        <div className="flex items-start gap-2.5 px-4 py-3 bg-beige/60 border border-beige rounded-xl text-xs text-charcoal">
          <Info size={16} className="text-olive shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-charcoal">Google Gemini API: </span>
            <span>
              To activate natural-language planning and document understanding, add your free API key to{' '}
              <code className="px-1.5 py-0.5 rounded bg-paper font-mono text-[11px] border border-border-light">
                server/.env
              </code>{' '}
              under <code className="font-mono font-semibold">GEMINI_API_KEY</code>.
            </span>
          </div>
        </div>
      )}

      {/* Main Command Input Box */}
      <div className="bg-paper rounded-xl border border-border-light shadow-sm overflow-hidden transition-all focus-within:border-olive/50 focus-within:ring-2 focus-within:ring-olive/10">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell LifeOS what's happening today... (e.g. 'I woke up at 7:30 AM, have college until 2 PM, and want to study DSA for 2 hours')"
            rows={3}
            disabled={isThinking}
            className="w-full px-5 pt-4 pb-2 bg-transparent text-charcoal placeholder:text-muted-light/70 text-sm resize-none focus:outline-none disabled:opacity-50"
          />

          {/* Recording indicator */}
          {isRecording && (
            <div className="mx-5 mb-2 flex items-center justify-between px-3 py-1.5 bg-terracotta/10 border border-terracotta/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-terracotta animate-ping" />
                <span className="text-xs text-terracotta font-medium">Listening... Speak now</span>
              </div>
              <button
                type="button"
                onClick={toggleRecording}
                className="text-[11px] font-semibold text-terracotta hover:underline ml-2"
              >
                Done Speaking
              </button>
            </div>
          )}

          {/* Transcribing audio indicator */}
          {isTranscribingAudio && (
            <div className="mx-5 mb-2 flex items-center gap-2 px-3 py-1.5 bg-olive/10 border border-olive/30 rounded-lg">
              <Loader2 size={13} className="animate-spin text-olive shrink-0" />
              <span className="text-xs text-olive font-medium">Transcribing speech with AI...</span>
            </div>
          )}

          {/* Speech error banner */}
          {speechError && (
            <div className="mx-5 mb-2 flex items-center justify-between gap-2 px-3 py-1.5 bg-terracotta/10 border border-terracotta/30 rounded-lg text-xs text-terracotta">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertCircle size={14} className="shrink-0" />
                <span className="truncate">{speechError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSpeechError(null)}
                className="text-muted hover:text-charcoal p-0.5 shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Attached files */}
          {attachedFiles.length > 0 && (
            <div className="mx-5 mb-2 space-y-1.5">
              {attachedFiles.map((f, i) => {
                const FIcon = getFileIcon(f.type);
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-sage/20 rounded-lg">
                    <FIcon size={14} className="text-olive shrink-0" />
                    <span className="text-xs text-charcoal font-medium truncate flex-1">{f.name}</span>
                    <span className="text-[10px] text-muted">{formatFileSize(f.size)}</span>
                    <button onClick={() => removeFile(i)} className="p-0.5 hover:bg-sage/40 rounded">
                      <X size={12} className="text-muted" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {fileError && <p className="mx-5 mb-2 text-xs text-terracotta">{fileError}</p>}
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border-light bg-ivory/50">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleRecording}
              disabled={!isVoiceSupported || isThinking || isTranscribingAudio}
              className={`p-2 rounded-lg transition-all duration-150 ${
                isRecording
                  ? 'bg-terracotta/20 text-terracotta ring-2 ring-terracotta/40 animate-pulse'
                  : isTranscribingAudio
                  ? 'bg-olive/15 text-olive'
                  : isVoiceSupported
                  ? 'text-muted hover:bg-beige-light hover:text-charcoal'
                  : 'text-muted-light/50 cursor-not-allowed'
              }`}
              title={
                !isVoiceSupported
                  ? 'Voice input not supported in this browser'
                  : isRecording
                  ? 'Click to stop recording'
                  : isTranscribingAudio
                  ? 'Transcribing audio...'
                  : 'Start voice input (Speak your day)'
              }
            >
              {isTranscribingAudio ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isRecording ? (
                <MicOff size={18} />
              ) : (
                <Mic size={18} />
              )}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isThinking}
              className="p-2 rounded-lg text-muted hover:bg-beige-light hover:text-charcoal transition-colors disabled:opacity-50"
              title="Attach document (PDF, DOCX, TXT)"
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={isThinking}
              className="p-2 rounded-lg text-muted hover:bg-beige-light hover:text-charcoal transition-colors disabled:opacity-50"
              title="Attach image (JPG, PNG, WEBP)"
            >
              <Image size={18} />
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            <span className="text-[11px] text-muted-light ml-2 font-mono">
              Model: {aiStatus.model || 'gemini-2.5-flash'}
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={(!input.trim() && attachedFiles.length === 0) || isThinking}
            className="p-2.5 rounded-lg bg-olive text-paper hover:bg-olive-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm flex items-center gap-1.5"
            title="Send to LifeOS AI"
          >
            {isThinking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* AI Processing indicator */}
      {isThinking && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-sage/20 border border-sage/40 rounded-xl text-xs text-olive-dark animate-pulse">
          <Sparkles size={16} className="text-olive animate-spin" />
          <span>LifeOS is analyzing your request and structuring your day...</span>
        </div>
      )}

      {/* AI Response / Explanation Box */}
      {aiResponse && (
        <div
          className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2 ${
            aiResponse.isError
              ? 'bg-terracotta/10 border-terracotta/30 text-terracotta'
              : aiResponse.isConfigError
              ? 'bg-beige/40 border-beige text-charcoal'
              : 'bg-paper border-border-light text-charcoal shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-olive" />
            <span className="font-semibold uppercase tracking-wider text-[11px] text-olive">
              LifeOS AI Reasoning
            </span>
          </div>
          <p className="text-sm">{aiResponse.explanation}</p>

          {/* Pending Proposal Confirmation Card */}
          {pendingProposal && (() => {
            let parsed: any = null;
            try {
              parsed = JSON.parse(pendingProposal.proposalData);
            } catch {}

            // Specialized Data Reset Proposal Preview
            if (pendingProposal.proposalType === 'DATA_RESET') {
              const resetMode = parsed?.resetMode || 'CLEAR_MOCK_DATA';
              const preview = parsed?.preview || {};
              const toDelete = preview?.toDelete || {};
              const toPreserve = preview?.toPreserve || {};
              const isWorkspace = resetMode === 'RESET_WORKSPACE';

              return (
                <div className="mt-3 pt-3 border-t border-border-light space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-terracotta" />
                        <p className="font-semibold text-charcoal text-sm">
                          {isWorkspace
                            ? 'Confirmation Required: Reset Entire Workspace'
                            : 'Confirmation Required: Clear Demo & Mock Data'}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isWorkspace ? 'bg-terracotta/20 text-terracotta' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isWorkspace ? 'Mode B: Full Wipe' : 'Mode A: Mock Data'}
                        </span>
                      </div>
                      <p className="text-muted text-xs mt-0.5">
                        {preview.summary ||
                          (isWorkspace
                            ? 'Wipe all workspace data and initialize a clean slate.'
                            : 'Remove demonstration records while preserving real user data.')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={handleDismissProposal}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-terracotta hover:bg-terracotta/90 text-paper"
                        icon={CheckCircle2}
                        onClick={handleApproveProposal}
                      >
                        {isWorkspace ? 'Yes, Reset Workspace' : 'Yes, Delete Mock Data'}
                      </Button>
                    </div>
                  </div>

                  {/* Itemized Deletion Preview */}
                  <div className="bg-ivory/80 rounded-xl p-3 border border-border-light text-xs space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border-light text-muted">
                      <span className="font-semibold text-charcoal">Items Queued for Deletion:</span>
                      <span className="font-mono text-terracotta font-semibold">
                        {toDelete.totalItems || 0} total records
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="bg-paper p-2 rounded border border-border-light">
                        <span className="text-muted block">Subjects:</span>
                        <span className="font-semibold text-charcoal text-xs">{toDelete.subjects || 0}</span>
                      </div>
                      <div className="bg-paper p-2 rounded border border-border-light">
                        <span className="text-muted block">Tasks:</span>
                        <span className="font-semibold text-charcoal text-xs">{toDelete.tasks || 0}</span>
                      </div>
                      <div className="bg-paper p-2 rounded border border-border-light">
                        <span className="text-muted block">Goals:</span>
                        <span className="font-semibold text-charcoal text-xs">{toDelete.personalGoals || 0}</span>
                      </div>
                      <div className="bg-paper p-2 rounded border border-border-light">
                        <span className="text-muted block">Documents:</span>
                        <span className="font-semibold text-charcoal text-xs">{toDelete.documents || 0}</span>
                      </div>
                    </div>

                    {toDelete.sampleSubjects?.length > 0 && (
                      <p className="text-[11px] text-muted">
                        <span className="font-medium text-charcoal">Sample subjects to remove: </span>
                        {toDelete.sampleSubjects.join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Preservation Guarantees */}
                  <div className="bg-sage/20 border border-sage/40 rounded-xl p-3 text-xs space-y-1">
                    <p className="font-semibold text-olive-dark flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-olive" /> What will be preserved:
                    </p>
                    <p className="text-[11px] text-charcoal">
                      <strong>Account & Credentials: </strong> {toPreserve.userAccount}
                    </p>
                    <p className="text-[11px] text-charcoal">
                      <strong>Preferences & Routine: </strong> {toPreserve.settings}
                    </p>
                    {!isWorkspace && (
                      <p className="text-[11px] text-olive-dark font-medium">
                        ✓ {toPreserve.explanation} ({toPreserve.realSubjectsCount || 0} real subjects,{' '}
                        {toPreserve.realTasksCount || 0} real tasks preserved)
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            const activities = parsed?.scheduledActivities || [];
            const overflow = parsed?.overflowTasks || [];
            const isHolidayProposal =
              aiResponse?.intent === 'HOLIDAY_DECLARATION' ||
              aiResponse?.intent === 'SCHEDULE_OVERRIDE' ||
              parsed?.holidayOverrideDetected ||
              pendingProposal.proposalType === 'SCHEDULE_MODIFICATION';

            return (
              <div className="mt-3 pt-3 border-t border-border-light space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-charcoal text-sm">Proposed Schedule Adjustments</p>
                      {isHolidayProposal && (
                        <span className="px-2 py-0.5 rounded-full bg-sage/40 text-olive-dark font-medium text-[10px]">
                          Holiday Override
                        </span>
                      )}
                    </div>
                    <p className="text-muted text-[11px]">
                      {isHolidayProposal
                        ? 'College hours temporarily removed. Regular weekly timetable remains unchanged.'
                        : 'Review and confirm before changes are committed to your database'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleDismissProposal}>
                      Cancel Changes
                    </Button>
                    <Button size="sm" icon={CheckCircle2} onClick={handleApproveProposal}>
                      Approve & Save
                    </Button>
                  </div>
                </div>

                {/* Proposed Activities Timeline Preview */}
                {activities.length > 0 && (
                  <div className="bg-ivory/60 rounded-xl p-3 border border-border-light max-h-48 overflow-y-auto space-y-1.5">
                    <p className="text-[11px] font-semibold text-charcoal uppercase tracking-wider mb-1">
                      Proposed Daily Timeline:
                    </p>
                    {activities.map((act: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1 px-2 rounded bg-paper/80 border border-border-light text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[11px] text-muted shrink-0">
                            {act.startTime} – {act.endTime}
                          </span>
                          <span className="font-medium text-charcoal truncate">{act.title}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sage/30 text-olive-dark font-medium shrink-0">
                          {act.category}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Overflow tasks note if day had too much */}
                {overflow.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-beige/40 border border-beige/60 text-[11px] text-charcoal">
                    <span className="font-semibold">Preserving buffer: </span>
                    {overflow.length} task(s) deferred to tomorrow to prevent cognitive overload.
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {actionMessage && (
        <div className="px-4 py-2.5 bg-sage/30 border border-sage rounded-lg text-xs font-medium text-olive-dark flex items-center gap-2">
          <CheckCircle2 size={15} className="text-olive" />
          <span>{actionMessage}</span>
        </div>
      )}
    </div>
  );
}
