import { useEffect, useRef, useCallback } from 'react';
import { useFlightStore } from '../store/flightStore';

export function useAnimation() {
  const lastTimeRef = useRef<number>(0);
  const animationIdRef = useRef<number | null>(null);
  
  const isPlaying = useFlightStore(state => state.isPlaying);
  const speedMultiplier = useFlightStore(state => state.speedMultiplier);
  const timeline = useFlightStore(state => state.timeline);
  const setCurrentTime = useFlightStore(state => state.setCurrentTime);
  const setPlaying = useFlightStore(state => state.setPlaying);
  
  const animate = useCallback(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    lastTimeRef.current = now;
    
    const newTime = timeline.current + delta * speedMultiplier;
    
    if (newTime < timeline.start) {
      setCurrentTime(timeline.start);
      setPlaying(false);
      return;
    }
    
    if (newTime > timeline.end) {
      setCurrentTime(timeline.end);
      setPlaying(false);
      return;
    }
    
    setCurrentTime(newTime);
    animationIdRef.current = requestAnimationFrame(animate);
  }, [timeline, speedMultiplier, setCurrentTime, setPlaying]);
  
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      animationIdRef.current = requestAnimationFrame(animate);
    } else {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    }
    
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [isPlaying, animate]);
  
  const play = useCallback(() => setPlaying(true), [setPlaying]);
  const pause = useCallback(() => setPlaying(false), [setPlaying]);
  const seekTo = useCallback((time: number) => setCurrentTime(time), [setCurrentTime]);
  const rewind = useCallback(() => setCurrentTime(timeline.start), [setCurrentTime, timeline.start]);
  
  return { play, pause, seekTo, rewind };
}
