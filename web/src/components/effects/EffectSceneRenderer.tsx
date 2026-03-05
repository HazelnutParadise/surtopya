"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import { Line } from "@react-three/drei"
import * as THREE from "three"
import { getEffectDprCap, getTierTargetFps } from "./quality-tier"
import type { EffectQualityTier, EffectRouteKey, ThemePalette } from "./types"

interface EffectSceneRendererProps {
  routeKey: Exclude<EffectRouteKey, "none">
  tier: EffectQualityTier
  palette: ThemePalette
}

const createSeededRandom = (seed: number) => {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

const pickCountByTier = (tier: EffectQualityTier, high: number, medium: number, low: number) => {
  if (tier === "high") return high
  if (tier === "medium") return medium
  return low
}

const useAnimationGate = (tier: EffectQualityTier) => {
  const frameBudget = 1 / getTierTargetFps(tier)
  const accumulator = useRef(0)

  return (delta: number) => {
    accumulator.current += delta
    if (accumulator.current < frameBudget) {
      return false
    }
    accumulator.current = 0
    return true
  }
}

function HomeScene({ tier, palette }: { tier: EffectQualityTier; palette: ThemePalette }) {
  const groupRef = useRef<THREE.Group | null>(null)
  const nearMaterialRef = useRef<THREE.PointsMaterial | null>(null)
  const shouldAnimate = useAnimationGate(tier)

  const particleGeometry = useMemo(() => {
    const count = pickCountByTier(tier, 1150, 760, 420)
    const random = createSeededRandom(101)
    const positions = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3
      positions[offset] = (random() - 0.5) * 18
      positions[offset + 1] = (random() - 0.5) * 10
      positions[offset + 2] = (random() - 0.5) * 12
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    return geometry
  }, [tier])

  useEffect(() => {
    return () => {
      particleGeometry.dispose()
    }
  }, [particleGeometry])

  useFrame((state, delta) => {
    if (!shouldAnimate(delta)) return
    const elapsed = state.clock.elapsedTime
    const group = groupRef.current
    if (group) {
      group.rotation.y = elapsed * 0.09
      group.rotation.x = Math.sin(elapsed * 0.35) * 0.08
      group.position.x = state.pointer.x * 0.32
      group.position.y = state.pointer.y * 0.22
    }
    if (nearMaterialRef.current) {
      nearMaterialRef.current.opacity = 0.5 + Math.sin(elapsed * 0.9) * 0.08
    }
  })

  return (
    <group ref={groupRef}>
      <mesh position={[-1.6, 0.2, -1.7]} rotation={[0.2, 0.4, 0]}>
        <torusKnotGeometry args={[2.2, 0.08, 220, 24]} />
        <meshBasicMaterial color={palette.accentPrimary} transparent opacity={0.18} wireframe />
      </mesh>
      <mesh position={[1.4, -0.4, -0.8]} rotation={[-0.1, -0.5, 0.2]}>
        <torusKnotGeometry args={[1.4, 0.06, 180, 20]} />
        <meshBasicMaterial color={palette.accentSecondary} transparent opacity={0.16} wireframe />
      </mesh>
      <points geometry={particleGeometry}>
        <pointsMaterial
          ref={nearMaterialRef}
          color={palette.glow}
          size={tier === "low" ? 0.04 : 0.05}
          sizeAttenuation
          transparent
          opacity={0.52}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}

function ExploreScene({ tier, palette }: { tier: EffectQualityTier; palette: ThemePalette }) {
  const scanRef = useRef<THREE.Mesh | null>(null)
  const shouldAnimate = useAnimationGate(tier)
  const segments = pickCountByTier(tier, 56, 36, 24)

  const gridGeometry = useMemo(() => {
    return new THREE.PlaneGeometry(11, 7, segments, Math.floor(segments * 0.65))
  }, [segments])

  useEffect(() => {
    return () => {
      gridGeometry.dispose()
    }
  }, [gridGeometry])

  useFrame((state, delta) => {
    if (!shouldAnimate(delta)) return
    const elapsed = state.clock.elapsedTime
    const positions = gridGeometry.attributes.position as THREE.BufferAttribute

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index)
      const y = positions.getY(index)
      const waveA = Math.sin(x * 1.2 + elapsed * 0.75) * 0.22
      const waveB = Math.cos(y * 1.5 + elapsed * 0.48) * 0.18
      positions.setZ(index, waveA + waveB)
    }
    positions.needsUpdate = true

    if (scanRef.current) {
      scanRef.current.position.y = ((elapsed * 0.34) % 8) - 4
      const material = scanRef.current.material as THREE.MeshBasicMaterial
      material.opacity = 0.14 + Math.sin(elapsed * 1.1) * 0.03
    }
  })

  return (
    <group>
      <mesh rotation={[-0.9, 0, 0]} position={[0, -0.3, -0.7]} geometry={gridGeometry}>
        <meshBasicMaterial color={palette.line} wireframe transparent opacity={0.26} />
      </mesh>
      <mesh ref={scanRef} position={[0, -3.8, 0.4]}>
        <planeGeometry args={[10.8, 0.09]} />
        <meshBasicMaterial color={palette.scan} transparent opacity={0.14} />
      </mesh>
    </group>
  )
}

function DatasetsScene({ tier, palette }: { tier: EffectQualityTier; palette: ThemePalette }) {
  const groupRef = useRef<THREE.Group | null>(null)
  const pointsMaterialRef = useRef<THREE.PointsMaterial | null>(null)
  const shouldAnimate = useAnimationGate(tier)

  const nodeCount = pickCountByTier(tier, 88, 58, 34)
  const { nodesGeometry, edgesGeometry } = useMemo(() => {
    const random = createSeededRandom(409)
    const nodePositions = new Float32Array(nodeCount * 3)

    for (let index = 0; index < nodeCount; index += 1) {
      const offset = index * 3
      nodePositions[offset] = (random() - 0.5) * 10.5
      nodePositions[offset + 1] = (random() - 0.5) * 6
      nodePositions[offset + 2] = (random() - 0.5) * 8
    }

    const edgeSegments = new Float32Array(nodeCount * 2 * 3)
    for (let index = 0; index < nodeCount; index += 1) {
      const source = index * 3
      const targetA = ((index + 3) % nodeCount) * 3
      edgeSegments[index * 6] = nodePositions[source]
      edgeSegments[index * 6 + 1] = nodePositions[source + 1]
      edgeSegments[index * 6 + 2] = nodePositions[source + 2]
      edgeSegments[index * 6 + 3] = nodePositions[targetA]
      edgeSegments[index * 6 + 4] = nodePositions[targetA + 1]
      edgeSegments[index * 6 + 5] = nodePositions[targetA + 2]
    }

    const nextNodesGeometry = new THREE.BufferGeometry()
    nextNodesGeometry.setAttribute("position", new THREE.BufferAttribute(nodePositions, 3))
    const nextEdgesGeometry = new THREE.BufferGeometry()
    nextEdgesGeometry.setAttribute("position", new THREE.BufferAttribute(edgeSegments, 3))

    return {
      nodesGeometry: nextNodesGeometry,
      edgesGeometry: nextEdgesGeometry,
    }
  }, [nodeCount])

  useEffect(() => {
    return () => {
      nodesGeometry.dispose()
      edgesGeometry.dispose()
    }
  }, [nodesGeometry, edgesGeometry])

  useFrame((state, delta) => {
    if (!shouldAnimate(delta)) return
    const elapsed = state.clock.elapsedTime
    if (groupRef.current) {
      groupRef.current.rotation.y = elapsed * 0.08
      groupRef.current.rotation.x = Math.sin(elapsed * 0.3) * 0.06
      groupRef.current.position.x = state.pointer.x * 0.34
      groupRef.current.position.y = state.pointer.y * 0.18
    }
    if (pointsMaterialRef.current) {
      pointsMaterialRef.current.size = (tier === "low" ? 0.065 : 0.075) + Math.sin(elapsed * 1.4) * 0.01
    }
  })

  return (
    <group ref={groupRef}>
      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial color={palette.line} transparent opacity={0.2} />
      </lineSegments>
      <points geometry={nodesGeometry}>
        <pointsMaterial
          ref={pointsMaterialRef}
          color={palette.accentPrimary}
          size={tier === "low" ? 0.065 : 0.075}
          sizeAttenuation
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}

function PricingScene({ tier, palette }: { tier: EffectQualityTier; palette: ThemePalette }) {
  const groupRef = useRef<THREE.Group | null>(null)
  const ringA = useRef<THREE.Mesh | null>(null)
  const ringB = useRef<THREE.Mesh | null>(null)
  const ringC = useRef<THREE.Mesh | null>(null)
  const shouldAnimate = useAnimationGate(tier)

  const orbitGeometry = useMemo(() => {
    const pointCount = pickCountByTier(tier, 84, 60, 38)
    const points = new Float32Array(pointCount * 3)
    for (let index = 0; index < pointCount; index += 1) {
      const theta = (index / pointCount) * Math.PI * 2
      const radius = 3.5 + Math.sin(index * 0.65) * 0.24
      const offset = index * 3
      points[offset] = Math.cos(theta) * radius
      points[offset + 1] = Math.sin(theta) * radius
      points[offset + 2] = Math.sin(theta * 2.4) * 0.35
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(points, 3))
    return geometry
  }, [tier])

  useEffect(() => {
    return () => {
      orbitGeometry.dispose()
    }
  }, [orbitGeometry])

  useFrame((state, delta) => {
    if (!shouldAnimate(delta)) return
    const elapsed = state.clock.elapsedTime
    if (groupRef.current) {
      groupRef.current.rotation.z = elapsed * 0.09
      groupRef.current.rotation.x = Math.sin(elapsed * 0.28) * 0.08
    }

    if (ringA.current) {
      const scale = 1 + Math.sin(elapsed * 0.8) * 0.04
      ringA.current.scale.setScalar(scale)
    }
    if (ringB.current) {
      const scale = 1 + Math.sin(elapsed * 0.95 + 1.3) * 0.05
      ringB.current.scale.setScalar(scale)
    }
    if (ringC.current) {
      const scale = 1 + Math.sin(elapsed * 1.12 + 2.1) * 0.035
      ringC.current.scale.setScalar(scale)
    }
  })

  return (
    <group ref={groupRef}>
      <mesh ref={ringA}>
        <torusGeometry args={[2.2, 0.04, 24, 220]} />
        <meshBasicMaterial color={palette.line} wireframe transparent opacity={0.28} />
      </mesh>
      <mesh ref={ringB} rotation={[0.7, 0.2, 0.2]}>
        <torusGeometry args={[2.9, 0.035, 20, 210]} />
        <meshBasicMaterial color={palette.accentSecondary} wireframe transparent opacity={0.2} />
      </mesh>
      <mesh ref={ringC} rotation={[0.25, 1.1, 0]}>
        <torusGeometry args={[3.6, 0.03, 18, 180]} />
        <meshBasicMaterial color={palette.glow} wireframe transparent opacity={0.18} />
      </mesh>
      <points geometry={orbitGeometry}>
        <pointsMaterial
          color={palette.accentPrimary}
          size={tier === "low" ? 0.05 : 0.06}
          sizeAttenuation
          transparent
          opacity={0.65}
          depthWrite={false}
        />
      </points>
    </group>
  )
}

function AboutScene({ tier, palette }: { tier: EffectQualityTier; palette: ThemePalette }) {
  const groupRef = useRef<THREE.Group | null>(null)
  const shouldAnimate = useAnimationGate(tier)

  const contourLines = useMemo(() => {
    const lineCount = pickCountByTier(tier, 16, 12, 8)
    return Array.from({ length: lineCount }, (_, lineIndex) => {
      const pointsPerLine = 72
      const points: [number, number, number][] = []
      const yBase = (lineIndex - lineCount / 2) * 0.45
      for (let pointIndex = 0; pointIndex < pointsPerLine; pointIndex += 1) {
        const ratio = pointIndex / (pointsPerLine - 1)
        const x = (ratio - 0.5) * 11
        const z = Math.sin(ratio * Math.PI * 3 + lineIndex * 0.45) * 0.22
        points.push([x, yBase + Math.sin(ratio * Math.PI * 2 + lineIndex * 0.6) * 0.08, z])
      }
      return points
    })
  }, [tier])

  useFrame((state, delta) => {
    if (!shouldAnimate(delta)) return
    if (!groupRef.current) return
    const elapsed = state.clock.elapsedTime
    groupRef.current.rotation.y = Math.sin(elapsed * 0.18) * 0.1
    groupRef.current.position.y = Math.sin(elapsed * 0.22) * 0.08
  })

  return (
    <group ref={groupRef}>
      {contourLines.map((points, index) => (
        <Line
          key={index}
          points={points}
          color={index % 2 === 0 ? palette.line : palette.accentPrimary}
          transparent
          opacity={index % 2 === 0 ? 0.22 : 0.16}
          lineWidth={1}
        />
      ))}
    </group>
  )
}

function LegalScene({ tier, palette }: { tier: EffectQualityTier; palette: ThemePalette }) {
  const lineRefs = useRef<Array<{ material?: { opacity?: number } }>>([])
  const shouldAnimate = useAnimationGate(tier)

  const lineSegments = useMemo(() => {
    const count = pickCountByTier(tier, 9, 7, 5)
    return Array.from({ length: count }, (_, index) => {
      const y = (index - count / 2) * 0.7
      return [
        [-6, y, 0] as [number, number, number],
        [6, y, 0] as [number, number, number],
      ]
    })
  }, [tier])

  useFrame((state, delta) => {
    if (!shouldAnimate(delta)) return
    const base = 0.12 + Math.sin(state.clock.elapsedTime * 0.4) * 0.03
    lineRefs.current.forEach((lineRef, index) => {
      if (!lineRef?.material) return
      lineRef.material.opacity = base + Math.sin(state.clock.elapsedTime * 0.32 + index * 0.65) * 0.025
    })
  })

  return (
    <group position={[0, 0, -0.6]}>
      {lineSegments.map((points, index) => (
        <Line
          key={index}
          ref={(line) => {
            if (!line) return
            lineRefs.current[index] = line
          }}
          points={points}
          color={index % 3 === 0 ? palette.accentSecondary : palette.line}
          transparent
          opacity={0.14}
          lineWidth={1}
        />
      ))}
    </group>
  )
}

function SceneSwitch({
  routeKey,
  tier,
  palette,
}: {
  routeKey: Exclude<EffectRouteKey, "none">
  tier: EffectQualityTier
  palette: ThemePalette
}) {
  if (routeKey === "home") return <HomeScene tier={tier} palette={palette} />
  if (routeKey === "explore") return <ExploreScene tier={tier} palette={palette} />
  if (routeKey === "datasets") return <DatasetsScene tier={tier} palette={palette} />
  if (routeKey === "pricing") return <PricingScene tier={tier} palette={palette} />
  if (routeKey === "about") return <AboutScene tier={tier} palette={palette} />
  return <LegalScene tier={tier} palette={palette} />
}

const cameraByRoute: Record<Exclude<EffectRouteKey, "none">, [number, number, number]> = {
  home: [0, 0, 8.5],
  about: [0, 0, 9],
  pricing: [0, 0, 8],
  terms: [0, 0, 8.8],
  privacy: [0, 0, 8.8],
  explore: [0, 0.5, 8.5],
  datasets: [0, 0, 8.2],
}

export function EffectSceneRenderer({ routeKey, tier, palette }: EffectSceneRendererProps) {
  const [isVisible, setIsVisible] = useState(true)
  const dprCap = getEffectDprCap(tier)

  useEffect(() => {
    const syncVisibility = () => {
      setIsVisible(document.visibilityState === "visible")
    }
    syncVisibility()
    document.addEventListener("visibilitychange", syncVisibility)
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <Canvas
        data-testid="site-webgl-canvas"
        className="h-full w-full"
        dpr={[1, dprCap]}
        frameloop={isVisible ? "always" : "never"}
        camera={{ position: cameraByRoute[routeKey], fov: routeKey === "terms" || routeKey === "privacy" ? 46 : 52 }}
        gl={{
          alpha: true,
          antialias: tier !== "low",
          powerPreference: "high-performance",
        }}
      >
        <fog attach="fog" args={[palette.base[0], 12, 26]} />
        <ambientLight intensity={0.35} />
        <pointLight position={[5, 6, 8]} intensity={0.42} color={palette.accentPrimary} />
        <pointLight position={[-6, -4, 5]} intensity={0.24} color={palette.accentSecondary} />
        <SceneSwitch routeKey={routeKey} tier={tier} palette={palette} />
        {routeKey === "home" ? (
          <EffectComposer multisampling={0}>
            <Bloom
              intensity={tier === "high" ? 0.2 : tier === "medium" ? 0.16 : 0.12}
              luminanceThreshold={0.2}
              luminanceSmoothing={0.45}
              mipmapBlur
            />
          </EffectComposer>
        ) : null}
      </Canvas>
    </div>
  )
}
