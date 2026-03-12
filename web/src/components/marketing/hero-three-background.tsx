"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

type HeroSceneProps = {
  allowPointerInteraction: boolean
  nearCount: number
  farCount: number
  isMobile: boolean
}

const POINT_SIZE_SCALE = 1.35

const createLayerPositions = ({
  count,
  spreadX,
  spreadY,
  spreadZ,
}: {
  count: number
  spreadX: number
  spreadY: number
  spreadZ: number
}) => {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3
    positions[i3] = (Math.random() - 0.5) * spreadX
    positions[i3 + 1] = (Math.random() - 0.5) * spreadY
    positions[i3 + 2] = (Math.random() - 0.5) * spreadZ
  }
  return positions
}

function HeroScene({ allowPointerInteraction, nearCount, farCount, isMobile }: HeroSceneProps) {
  const { camera } = useThree()
  const nearGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        createLayerPositions({
          count: nearCount,
          spreadX: 16,
          spreadY: 9,
          spreadZ: 10,
        }),
        3
      )
    )
    return geometry
  }, [nearCount])

  const farGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        createLayerPositions({
          count: farCount,
          spreadX: 22,
          spreadY: 12,
          spreadZ: 14,
        }),
        3
      )
    )
    return geometry
  }, [farCount])

  const nearPointsRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null>(null)
  const farPointsRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null>(null)
  const nearMaterialRef = useRef<THREE.PointsMaterial | null>(null)
  const farMaterialRef = useRef<THREE.PointsMaterial | null>(null)

  const pointerTarget = useRef(new THREE.Vector2(0, 0))
  const pointerCurrent = useRef(new THREE.Vector2(0, 0))
  const rotationalVelocity = useRef(new THREE.Vector2(0, 0))
  const lastPointer = useRef(new THREE.Vector2(0, 0))
  const hasPointerSample = useRef(false)

  useEffect(() => {
    camera.position.z = 7.2
  }, [camera])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!allowPointerInteraction) return

      const width = window.innerWidth || 1
      const height = window.innerHeight || 1
      const nx = (event.clientX / width) * 2 - 1
      const ny = -((event.clientY / height) * 2 - 1)
      pointerTarget.current.set(nx, ny)

      if (hasPointerSample.current) {
        const dx = nx - lastPointer.current.x
        const dy = ny - lastPointer.current.y
        rotationalVelocity.current.x = THREE.MathUtils.clamp(rotationalVelocity.current.x + dx * 0.09, -0.06, 0.06)
        rotationalVelocity.current.y = THREE.MathUtils.clamp(rotationalVelocity.current.y + dy * 0.09, -0.06, 0.06)
      }

      lastPointer.current.set(nx, ny)
      hasPointerSample.current = true
    }

    const handlePointerLeave = () => {
      pointerTarget.current.set(0, 0)
      hasPointerSample.current = false
    }

    if (allowPointerInteraction) {
      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerleave", handlePointerLeave)
    }

    return () => {
      if (allowPointerInteraction) {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerleave", handlePointerLeave)
      }
    }
  }, [allowPointerInteraction])

  useEffect(() => {
    return () => {
      nearGeometry.dispose()
      farGeometry.dispose()
    }
  }, [nearGeometry, farGeometry])

  useFrame((state) => {
    if (document.visibilityState !== "visible") return

    const elapsed = state.clock.getElapsedTime()
    pointerCurrent.current.lerp(pointerTarget.current, 0.045)
    rotationalVelocity.current.multiplyScalar(0.92)

    const nearPoints = nearPointsRef.current
    const farPoints = farPointsRef.current

    if (nearPoints) {
      nearPoints.rotation.y += 0.0012 + rotationalVelocity.current.x * 0.7
      nearPoints.rotation.x += 0.00055 + rotationalVelocity.current.y * 0.7
      nearPoints.position.x = pointerCurrent.current.x * 0.22
      nearPoints.position.y = pointerCurrent.current.y * 0.15
    }

    if (farPoints) {
      farPoints.rotation.y += -0.00045 + rotationalVelocity.current.x * 0.24
      farPoints.rotation.x += 0.00025 + rotationalVelocity.current.y * 0.24
      farPoints.position.x = pointerCurrent.current.x * -0.1
      farPoints.position.y = pointerCurrent.current.y * -0.08
    }

    if (nearMaterialRef.current) {
      nearMaterialRef.current.opacity = 0.72 + Math.sin(elapsed * 1.2) * 0.08
    }
    if (farMaterialRef.current) {
      farMaterialRef.current.opacity = 0.36 + Math.cos(elapsed * 0.8) * 0.06
    }

    camera.position.x = pointerCurrent.current.x * 0.42
    camera.position.y = pointerCurrent.current.y * 0.3
    camera.lookAt(0, 0, 0)
  })

  return (
    <>
      <points ref={nearPointsRef} geometry={nearGeometry}>
        <pointsMaterial
          ref={nearMaterialRef}
          size={(isMobile ? 0.04 : 0.05) * POINT_SIZE_SCALE}
          color="#a78bfa"
          transparent
          opacity={0.8}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={farPointsRef} geometry={farGeometry}>
        <pointsMaterial
          ref={farMaterialRef}
          size={(isMobile ? 0.026 : 0.034) * POINT_SIZE_SCALE}
          color="#22d3ee"
          transparent
          opacity={0.42}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  )
}

export function HeroThreeBackground() {
  const [isReady, setIsReady] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [allowPointerInteraction, setAllowPointerInteraction] = useState(false)

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const mobile = window.matchMedia("(max-width: 768px)").matches
    const pointerFine = window.matchMedia("(pointer: fine)").matches

    setPrefersReducedMotion(reducedMotion)
    setIsMobile(mobile)
    setAllowPointerInteraction(pointerFine && !mobile)
    setIsReady(true)
  }, [])

  if (!isReady || prefersReducedMotion) {
    return null
  }

  return (
    <Canvas
      className="h-full w-full"
      aria-hidden
      dpr={[1, 2]}
      camera={{ fov: 55, near: 0.1, far: 100, position: [0, 0, 7.2] }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      }}
    >
      <HeroScene
        allowPointerInteraction={allowPointerInteraction}
        nearCount={isMobile ? 260 : 820}
        farCount={isMobile ? 140 : 420}
        isMobile={isMobile}
      />
    </Canvas>
  )
}
