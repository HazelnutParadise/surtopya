"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

export function HeroThreeBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof window === "undefined") return

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) return

    const isMobile = window.matchMedia("(max-width: 768px)").matches
    const pointCount = isMobile ? 220 : 480

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100)
    camera.position.z = 6

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)

    const positions = new Float32Array(pointCount * 3)
    for (let i = 0; i < pointCount; i++) {
      const i3 = i * 3
      positions[i3] = (Math.random() - 0.5) * 10
      positions[i3 + 1] = (Math.random() - 0.5) * 6
      positions[i3 + 2] = (Math.random() - 0.5) * 6
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))

    const material = new THREE.PointsMaterial({
      size: isMobile ? 0.026 : 0.03,
      color: "#8b5cf6",
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    let rafId = 0
    let disposed = false

    const resize = () => {
      if (disposed || !canvas.parentElement) return
      const width = canvas.parentElement.clientWidth
      const height = canvas.parentElement.clientHeight
      if (width <= 0 || height <= 0) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    const animate = () => {
      if (disposed) return
      if (document.visibilityState === "visible") {
        points.rotation.y += 0.0009
        points.rotation.x += 0.00035
        renderer.render(scene, camera)
      }
      rafId = requestAnimationFrame(animate)
    }

    resize()
    animate()
    window.addEventListener("resize", resize)

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", resize)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      scene.clear()
    }
  }, [])

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
}
