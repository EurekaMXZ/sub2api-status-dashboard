"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

const MIN_ANIMATION_DURATION_MS = 480
const MAX_ANIMATION_DURATION_MS = 1_280

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function easeOutExpo(progress: number) {
  if (progress >= 1) {
    return 1
  }

  return 1 - 2 ** (-10 * progress)
}

function getAnimationDurationMs(distance: number) {
  return clamp(
    520 + Math.log10(Math.max(distance, 1) + 1) * 170,
    MIN_ANIMATION_DURATION_MS,
    MAX_ANIMATION_DURATION_MS
  )
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches)
    }

    updatePreference()
    mediaQuery.addEventListener("change", updatePreference)

    return () => {
      mediaQuery.removeEventListener("change", updatePreference)
    }
  }, [])

  return prefersReducedMotion
}

export function AnimatedMetricValue({
  className,
  formatValue,
  value,
}: {
  className?: string
  formatValue: (value: number) => string
  value: number | null
}) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [displayValue, setDisplayValue] = useState<number | null>(value)
  const animationFrameRef = useRef<number | null>(null)
  const liveValueRef = useRef<number | null>(value)

  useEffect(() => {
    liveValueRef.current = displayValue
  }, [displayValue])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    const startValue = liveValueRef.current

    const commitValue = (nextValue: number | null) => {
      liveValueRef.current = nextValue
      setDisplayValue(nextValue)
      animationFrameRef.current = null
    }

    if (value === null || startValue === null || prefersReducedMotion || startValue === value) {
      animationFrameRef.current = window.requestAnimationFrame(() => {
        commitValue(value)
      })

      return () => {
        if (animationFrameRef.current !== null) {
          window.cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }

    const delta = value - startValue
    const durationMs = getAnimationDurationMs(Math.abs(delta))
    let startedAt = 0

    const animate = (timestamp: number) => {
      if (startedAt === 0) {
        startedAt = timestamp
      }

      const progress = Math.min((timestamp - startedAt) / durationMs, 1)
      const easedProgress = easeOutExpo(progress)
      const nextValue = startValue + delta * easedProgress

      liveValueRef.current = nextValue
      setDisplayValue(nextValue)

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(animate)
        return
      }

      commitValue(value)
    }

    animationFrameRef.current = window.requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [prefersReducedMotion, value])

  return (
    <div className={cn(className, value !== displayValue && "text-white/92")}>
      {displayValue === null ? "--" : formatValue(displayValue)}
    </div>
  )
}
