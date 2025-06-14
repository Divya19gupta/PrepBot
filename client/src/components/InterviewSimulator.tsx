import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from 'react-markdown';

type QuestionFeedback = {
  question: string;
  answer: string;
  feedback: string;
  score: {
    clarity: number;
    relevance: number;
    structure: number;
    confidence: number;
  };
};

const TOTAL_QUESTIONS = 5;

const InterviewSimulator: React.FC = () => {
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(TOTAL_QUESTIONS).fill(""));
  const [feedback, setFeedback] = useState<(QuestionFeedback | null)[]>(Array(TOTAL_QUESTIONS).fill(null));
  const [isLoading, setIsLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const fetchQuestions = async () => {
      const res = await fetch("http://localhost:3001/api/questions");
      const data = await res.json();
      setQuestions(data.questions.slice(0, TOTAL_QUESTIONS));
    };
    fetchQuestions();
  }, []);

  const startRecording = async () => {
    setTranscript("");
    setFeedback((prev) => {
      const newFeedback = [...prev];
      newFeedback[currentIndex] = null;
      return newFeedback;
    });

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
  const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

  const reader = new FileReader();
  reader.onloadend = async () => {
    const base64Audio = reader.result;

    setIsLoading(true);
    try {
      // Transcribe using Whisper API
      const transcribeRes = await fetch("http://localhost:3001/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64Audio }),
      });
      const { transcript } = await transcribeRes.json();
      setTranscript(transcript);

      // Send to Gemini API for evaluation
      const evalRes = await fetch("http://localhost:3001/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questions[currentIndex],
          answer: transcript,
        }),
      });

      const evaluation = await evalRes.json();

      const updatedAnswers = [...answers];
      updatedAnswers[currentIndex] = transcript;

      const updatedFeedback = [...feedback];
      updatedFeedback[currentIndex] = {
        question: questions[currentIndex],
        answer: transcript,
        feedback: evaluation.feedback,
        score: evaluation.score,
      };

      setAnswers(updatedAnswers);
      setFeedback(updatedFeedback);
    } catch (err) {
      console.error("Error during evaluation:", err);
    } finally {
      setIsLoading(false);
    }
  };

  reader.readAsDataURL(audioBlob); // encodes blob to base64
};


    mediaRecorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleNext = () => {
    if (currentIndex < TOTAL_QUESTIONS - 1) {
      setCurrentIndex(currentIndex + 1);
      setTranscript("");
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setTranscript("");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      {questions.length === 0 ? (
        <p>Loading questions...</p>
      ) : (
        <>
          <h2>Question {currentIndex + 1} of {TOTAL_QUESTIONS}</h2>
          <p><strong>{questions[currentIndex]}</strong></p>

          {/* Recording Controls */}
          <div style={{ marginTop: "1rem" }}>
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={isLoading}
              style={{
                backgroundColor: recording ? "#e53935" : "#1e88e5",
                color: "#fff",
                padding: "0.5rem 1rem",
                marginRight: "1rem",
              }}
            >
              {recording ? "Stop Recording" : "Start Recording"}
            </button>

            <button onClick={handlePrevious} disabled={currentIndex === 0}>
              Previous
            </button>
            <button onClick={handleNext} disabled={currentIndex === TOTAL_QUESTIONS - 1}>
              Next
            </button>
          </div>

          {isLoading && <p>Processing...</p>}

          {/* Transcript */}
          {transcript && (
            <div style={{ marginTop: "1rem" }}>
              <h4>Transcript</h4>
              <p style={{ backgroundColor: "#f5f5f5", padding: "0.5rem" }}>{transcript}</p>
            </div>
          )}

          {/* Feedback */}


{feedback[currentIndex] && (
  <div
    style={{
      marginTop: "1.5rem",
      padding: "1.5rem",
      border: "1px solid #ddd",
      borderRadius: "10px",
      backgroundColor: "#fcfcfc",
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "1rem",
      lineHeight: "1.6",
    }}
  >
    <h3 style={{ marginBottom: "1rem", color: "#2c3e50" }}>Evaluation Feedback</h3>
    <ReactMarkdown>{feedback[currentIndex]!.feedback}</ReactMarkdown>
  </div>
)}

        </>
      )}
    </div>
  );
};

export default InterviewSimulator;
