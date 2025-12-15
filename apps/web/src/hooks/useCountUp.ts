import { useState, useEffect, useRef } from "react";

/**
 * Hook that animates a number counting up to a target value
 * @param targetValue - The value to animate towards
 * @param duration - Animation duration in ms (default 500ms)
 * @param enabled - Whether animation is enabled (default true)
 */
export function useCountUp(
  targetValue: number,
  duration = 500,
  enabled = true
): number {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const previousValue = useRef(targetValue);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // If disabled or value decreased, snap immediately
    if (!enabled || targetValue < previousValue.current) {
      setDisplayValue(targetValue);
      previousValue.current = targetValue;
      return;
    }

    // If value is the same, no animation needed
    if (targetValue === previousValue.current) {
      return;
    }

    const startValue = previousValue.current;
    const difference = targetValue - startValue;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + difference * easeOut);

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousValue.current = targetValue;
      }
    };

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration, enabled]);

  // Update previous value ref when disabled
  useEffect(() => {
    if (!enabled) {
      previousValue.current = targetValue;
    }
  }, [enabled, targetValue]);

  return displayValue;
}
