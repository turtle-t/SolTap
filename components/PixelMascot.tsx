'use client';

import { useEffect, useState } from 'react';

interface PixelMascotProps {
  messages: string[];
}

export default function PixelMascot({ messages }: PixelMascotProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [showBubble, setShowBubble] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowBubble(false);
      setTimeout(() => {
        setMessageIndex((i) => (i + 1) % messages.length);
        setShowBubble(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, [messages.length]);

  if (messages.length === 0) return null;

  return (
    <div style={styles.walker}>
      {showBubble && (
        <div className="pixel-font" style={styles.bubble}>
          {messages[messageIndex]}
          <span style={styles.bubbleTail} />
        </div>
      )}
      <div style={styles.character}>
        <div style={styles.head}>
          <div style={{ ...styles.eye, left: '4px' }} />
          <div style={{ ...styles.eye, right: '4px' }} />
        </div>
        <div style={styles.body} />
        <div style={styles.legs}>
          <div style={styles.leg} />
          <div style={styles.leg} />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
 walker: {
  position: 'fixed',
  bottom: '86px',
  left: 0,
  width: '100%',
  height: '70px',
  pointerEvents: 'none',
  zIndex: 400,
  animation: 'walkAcross 50s linear infinite', // was 9s — slowed down
},
  character: {
  width: '36px',
  animation: 'bob 0.15s ease-in-out infinite', // was 0.5s
},
  head: {
    width: '28px',
    height: '20px',
    background: 'var(--coin-gold)',
    border: '3px solid #a8791e',
    borderRadius: '2px',
    position: 'relative',
    margin: '0 auto',
  },
  eye: {
    position: 'absolute',
    top: '7px',
    width: '4px',
    height: '4px',
    background: '#1a1408',
  },
  body: {
    width: '22px',
    height: '14px',
    background: 'var(--coin-teal)',
    border: '3px solid #0d8f5c',
    margin: '-2px auto 0',
  },
  legs: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '-2px',
  },
  leg: {
    width: '6px',
    height: '8px',
    background: '#3d3866',
  },
  bubble: {
    position: 'absolute',
    top: '-46px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--surface)',
    border: '3px solid var(--border)',
    borderRadius: '4px',
    padding: '8px 10px',
    fontSize: '8px',
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    boxShadow: '3px 3px 0 rgba(0,0,0,0.4)',
    transition: 'opacity 0.3s ease',
  },
  bubbleTail: {
    position: 'absolute',
    bottom: '-8px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '8px solid var(--border)',
  },
};