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
    const allowPointerInteraction = window.matchMedia("(pointer: fine)").matches && !isMobile
    const nearCount = isMobile ? 260 : 820
    const farCount = isMobile ? 140 : 420

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100)
    camera.position.z = 7.2

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)

    const createLayer = ({
      count,
      spreadX,
      spreadY,
      spreadZ,
      size,
      color,
      opacity,
    }: {
      count: number
      spreadX: number
      spreadY: number
      spreadZ: number
      size: number
      color: string
      opacity: number
    }) => {
      const positions = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        positions[i3] = (Math.random() - 0.5) * spreadX
        positions[i3 + 1] = (Math.random() - 0.5) * spreadY
        positions[i3 + 2] = (Math.random() - 0.5) * spreadZ
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
      const material = new THREE.PointsMaterial({
        size,
        color,
        transparent: true,
        opacity,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })

      const points = new THREE.Points(geometry, material)
      scene.add(points)
      return { geometry, material, points }
    }

    const nearLayer = createLayer({
      count: nearCount,
      spreadX: 16,
      spreadY: 9,
      spreadZ: 10,
      size: isMobile ? 0.04 : 0.05,
      color: "#a78bfa",
      opacity: 0.8,
    })
    const farLayer = createLayer({
      count: farCount,
      spreadX: 22,
      spreadY: 12,
      spreadZ: 14,
      size: isMobile ? 0.026 : 0.034,
      color: "#22d3ee",
      opacity: 0.42,
    })

    const clock = new THREE.Clock()
    const pointerTarget = new THREE.Vector2(0, 0)
    const pointerCurrent = new THREE.Vector2(0, 0)
    const rotationalVelocity = new THREE.Vector2(0, 0)
    const lastPointer = new THREE.Vector2(0, 0)
    let hasPointerSample = false

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

    const handlePointerMove = (event: PointerEvent) => {
      if (!allowPointerInteraction || disposed) return
      const width = window.innerWidth || 1
      const height = window.innerHeight || 1
      const nx = (event.clientX / width) * 2 - 1
      const ny = -((event.clientY / height) * 2 - 1)
      pointerTarget.set(nx, ny)

      if (hasPointerSample) {
        const dx = nx - lastPointer.x
        const dy = ny - lastPointer.y
        // Inertia impulse: rotation follows movement direction and decays over time.
        rotationalVelocity.x = THREE.MathUtils.clamp(rotationalVelocity.x + dx * 0.09, -0.06, 0.06)
        rotationalVelocity.y = THREE.MathUtils.clamp(rotationalVelocity.y + dy * 0.09, -0.06, 0.06)
      }

      lastPointer.set(nx, ny)
      hasPointerSample = true
    }

    const handlePointerLeave = () => {
      pointerTarget.set(0, 0)
      hasPointerSample = false
    }

    const animate = () => {
      if (disposed) return
      if (document.visibilityState === "visible") {
        const elapsed = clock.getElapsedTime()
        pointerCurrent.lerp(pointerTarget, 0.045)
        rotationalVelocity.multiplyScalar(0.92)

        nearLayer.points.rotation.y += 0.0012 + rotationalVelocity.x * 0.7
        nearLayer.points.rotation.x += 0.00055 + rotationalVelocity.y * 0.7
        farLayer.points.rotation.y += -0.00045 + rotationalVelocity.x * 0.24
        farLayer.points.rotation.x += 0.00025 + rotationalVelocity.y * 0.24

        nearLayer.points.position.x = pointerCurrent.x * 0.22
        nearLayer.points.position.y = pointerCurrent.y * 0.15
        farLayer.points.position.x = pointerCurrent.x * -0.1
        farLayer.points.position.y = pointerCurrent.y * -0.08

        nearLayer.material.opacity = 0.72 + Math.sin(elapsed * 1.2) * 0.08
        farLayer.material.opacity = 0.36 + Math.cos(elapsed * 0.8) * 0.06

        camera.position.x = pointerCurrent.x * 0.42
        camera.position.y = pointerCurrent.y * 0.3
        camera.lookAt(0, 0, 0)
        renderer.render(scene, camera)
      }
      rafId = requestAnimationFrame(animate)
    }

    resize()
    animate()
    window.addEventListener("resize", resize)
    if (allowPointerInteraction) {
      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerleave", handlePointerLeave)
    }

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", resize)
      if (allowPointerInteraction) {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerleave", handlePointerLeave)
      }
      nearLayer.geometry.dispose()
      nearLayer.material.dispose()
      farLayer.geometry.dispose()
      farLayer.material.dispose()
      renderer.dispose()
      scene.clear()
    }
  }, [])

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
}
