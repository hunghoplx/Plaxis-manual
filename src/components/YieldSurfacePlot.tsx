import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Maximize2, Minimize2, Settings2, LineChart, Columns, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PlotParams {
  yield_stress?: number;
  friction_angle?: number;
  cohesion?: number;
  alpha?: number;
  k?: number;
  tension_cutoff?: number;
  pore_pressure?: number;
  sigma_x?: number;
  sigma_y?: number;
  tau_xy?: number;
  sci?: number;
  gsi?: number;
  mi?: number;
  d_factor?: number;
  sigma3_confining?: number;
}

type PlotType = 's1-s2' | 's1-s3' | 'p-q';

const MohrsCircle: React.FC<{ sigma_x: number, sigma_y: number, tau_xy: number, width?: number, height?: number }> = ({ sigma_x, sigma_y, tau_xy, width = 250, height = 250 }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const margin = 30;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const center = (sigma_x + sigma_y) / 2;
    const radius = Math.sqrt(Math.pow((sigma_x - sigma_y) / 2, 2) + Math.pow(tau_xy, 2));
    const s1 = center + radius;
    const s2 = center - radius;

    const maxVal = Math.max(Math.abs(s1), Math.abs(s2), radius) * 1.5 || 50;
    const xScale = d3.scaleLinear().domain([-maxVal, maxVal]).range([margin, width - margin]);
    const yScale = d3.scaleLinear().domain([-maxVal, maxVal]).range([height - margin, margin]);

    // Axes
    svg.append("line").attr("x1", margin).attr("y1", height / 2).attr("x2", width - margin).attr("y2", height / 2).attr("stroke", "#cbd5e1");
    svg.append("line").attr("x1", width / 2).attr("y1", margin).attr("x2", width / 2).attr("y2", height - margin).attr("stroke", "#cbd5e1");

    // Circle
    svg.append("circle")
      .attr("cx", xScale(center))
      .attr("cy", yScale(0))
      .attr("r", Math.abs(xScale(radius) - xScale(0)))
      .attr("fill", "rgba(79, 70, 229, 0.1)")
      .attr("stroke", "#4f46e5")
      .attr("stroke-width", 2);

    // Points
    svg.append("circle").attr("cx", xScale(sigma_x)).attr("cy", yScale(-tau_xy)).attr("r", 4).attr("fill", "#ef4444");
    svg.append("circle").attr("cx", xScale(sigma_y)).attr("cy", yScale(tau_xy)).attr("r", 4).attr("fill", "#ef4444");
    svg.append("line").attr("x1", xScale(sigma_x)).attr("y1", yScale(-tau_xy)).attr("x2", xScale(sigma_y)).attr("y2", yScale(tau_xy)).attr("stroke", "#ef4444").attr("stroke-dasharray", "4,4");

    // Labels
    svg.append("text").attr("x", width - 10).attr("y", height / 2 - 5).attr("text-anchor", "end").style("font-size", "10px").text("σ");
    svg.append("text").attr("x", width / 2 + 5).attr("y", 15).style("font-size", "10px").text("τ");

  }, [sigma_x, sigma_y, tau_xy, width, height]);

  return <svg ref={svgRef} width={width} height={height} className="bg-slate-50 rounded-xl border border-slate-100" />;
};

interface ModelConfig {
  id: string;
  params: PlotParams;
  color?: string;
  name?: string;
}

interface SinglePlotProps {
  configs: ModelConfig[];
  is3D: boolean;
  plotType: PlotType;
  width?: number;
  height?: number;
  stressState?: { s1: number, s2: number };
}

const SinglePlot: React.FC<SinglePlotProps> = ({ configs, is3D, plotType, width = 400, height = 400, stressState }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // 2D Plot Logic (D3)
  useEffect(() => {
    if (is3D || !svgRef.current) return;

    const margin = 50;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Initial scales
    let xScale = d3.scaleLinear().domain(plotType === 's1-s2' ? [-100, 100] : [-20, 100]).range([margin, width - margin]);
    let yScale = d3.scaleLinear().domain(plotType === 's1-s2' ? [-100, 100] : [-20, 150]).range([height - margin, margin]);

    const xAxisG = svg.append("g").attr("class", "x-axis");
    const yAxisG = svg.append("g").attr("class", "y-axis");
    const gridG = svg.append("g").attr("class", "grid-group");
    const contentG = svg.append("g").attr("class", "content-group");
    const labelsG = svg.append("g").attr("class", "labels-group");

    const draw = (currentXScale: any, currentYScale: any) => {
      gridG.selectAll("*").remove();
      contentG.selectAll("*").remove();
      labelsG.selectAll("*").remove();
      xAxisG.selectAll("*").remove();
      yAxisG.selectAll("*").remove();

      // Draw grid
      gridG.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0, ${currentYScale(0)})`)
        .call(d3.axisBottom(currentXScale).ticks(10).tickSize(-height + 2 * margin).tickFormat(() => ""))
        .style("stroke-dasharray", "2,2")
        .style("stroke", "#e2e8f0");

      gridG.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(${currentXScale(0)}, 0)`)
        .call(d3.axisLeft(currentYScale).ticks(10).tickSize(-width + 2 * margin).tickFormat(() => ""))
        .style("stroke-dasharray", "2,2")
        .style("stroke", "#e2e8f0");

      // Draw axes
      xAxisG.attr("transform", `translate(0, ${currentYScale(0)})`)
        .call(d3.axisBottom(currentXScale).ticks(5));

      yAxisG.attr("transform", `translate(${currentXScale(0)}, 0)`)
        .call(d3.axisLeft(currentYScale).ticks(5));

      // Draw models
      configs.forEach((config, idx) => {
        const points: [number, number][] = [];
        const { id: modelId, params, color = "#4f46e5" } = config;
        const sy = params.yield_stress || 50;

        if (plotType === 's1-s2') {
          if (modelId === 'von-mises') {
            for (let theta = 0; theta <= 2 * Math.PI; theta += 0.05) {
              const a = sy * Math.sqrt(2);
              const b = sy * Math.sqrt(2/3);
              const x = a * Math.cos(theta);
              const y = b * Math.sin(theta);
              const s1 = (x - y) / Math.sqrt(2);
              const s2 = (x + y) / Math.sqrt(2);
              points.push([currentXScale(s1), currentYScale(s2)]);
            }
          } else if (modelId === 'tresca') {
            const hexPoints: [number, number][] = [
              [sy, 0], [sy, sy], [0, sy], [-sy, 0], [-sy, -sy], [0, -sy], [sy, 0]
            ];
            hexPoints.forEach(p => points.push([currentXScale(p[0]), currentYScale(p[1])]));
          } else if (modelId === 'mohr-coulomb') {
            const phi = (params.friction_angle || 30) * Math.PI / 180;
            const c = params.cohesion || 20;
            const tc = params.tension_cutoff || -10;
            const pp = params.pore_pressure || 0;
            const effective_c = c;
            
            const k_mc = (1 + Math.sin(phi)) / (1 - Math.sin(phi));
            const sy_mc = 2 * effective_c * Math.sqrt(k_mc);
            
            const vertices: [number, number][] = [
              [sy_mc / k_mc, 0],
              [sy_mc / k_mc, sy_mc / k_mc],
              [0, sy_mc / k_mc],
              [-sy_mc, 0],
              [-sy_mc, -sy_mc],
              [0, -sy_mc],
              [sy_mc / k_mc, 0]
            ];
            
            const finalVertices = vertices.map(v => [
              Math.max(v[0] + pp, tc + pp),
              Math.max(v[1] + pp, tc + pp)
            ]);
            
            finalVertices.forEach(p => points.push([currentXScale(p[0]), currentYScale(p[1])]));
          } else if (modelId === 'drucker-prager') {
            const phi = (params.friction_angle || 30) * Math.PI / 180;
            const c = params.cohesion || 20;
            for (let theta = 0; theta <= 2 * Math.PI; theta += 0.1) {
              const r = (c * Math.cos(phi)) / (1 + Math.sin(phi) * Math.sin(theta));
              const s1 = r * Math.cos(theta);
              const s2 = r * Math.sin(theta);
              points.push([currentXScale(s1), currentYScale(s2)]);
            }
          }
        } else {
          // Failure Envelopes (s1-s3 or p-q)
          const s3_min = -20;
          const s3_max = 100;
          
          if (modelId === 'mohr-coulomb') {
            const phi = (params.friction_angle || 30) * Math.PI / 180;
            const c = params.cohesion || 20;
            const k = (1 + Math.sin(phi)) / (1 - Math.sin(phi));
            const sig_c = (2 * c * Math.cos(phi)) / (1 - Math.sin(phi));
            
            for (let s3 = s3_min; s3 <= s3_max; s3 += 2) {
              const s1 = s3 * k + sig_c;
              if (plotType === 's1-s3') {
                points.push([currentXScale(s3), currentYScale(s1)]);
              } else {
                points.push([currentXScale((s1 + s3) / 2), currentYScale((s1 - s3) / 2)]);
              }
            }
          } else if (modelId === 'hoek-brown') {
            const sci = params.sci || 30;
            const gsi = params.gsi || 50;
            const mi = params.mi || 10;
            const d = params.d_factor || 0;
            
            const mb = mi * Math.exp((gsi - 100) / (28 - 14 * d));
            const s = Math.exp((gsi - 100) / (9 - 3 * d));
            const a = 0.5 + (1/6) * (Math.exp(-gsi/15) - Math.exp(-20/3));
            
            for (let s3 = s3_min; s3 <= s3_max; s3 += 2) {
              const term = mb * (s3 / sci) + s;
              if (term >= 0) {
                const s1 = s3 + sci * Math.pow(term, a);
                if (plotType === 's1-s3') {
                  points.push([currentXScale(s3), currentYScale(s1)]);
                } else {
                  points.push([currentXScale((s1 + s3) / 2), currentYScale((s1 - s3) / 2)]);
                }
              }
            }
          }
        }

        const line = d3.line()
          .x(d => d[0])
          .y(d => d[1])
          .curve(plotType === 's1-s2' ? d3.curveLinearClosed : d3.curveLinear);

        contentG.append("path")
          .datum(points)
          .attr("fill", plotType === 's1-s2' ? (idx === 0 ? "rgba(79, 70, 229, 0.15)" : "rgba(16, 185, 129, 0.1)") : "none")
          .attr("stroke", color)
          .attr("stroke-width", 2)
          .attr("d", line as any);

        // Add failure point for s1-s3 or p-q
        if (plotType !== 's1-s2' && (modelId === 'mohr-coulomb' || modelId === 'hoek-brown')) {
          const s3 = params.sigma3_confining || 20;
          let s1 = 0;
          if (modelId === 'mohr-coulomb') {
            const phi = (params.friction_angle || 30) * Math.PI / 180;
            const c = params.cohesion || 20;
            const k = (1 + Math.sin(phi)) / (1 - Math.sin(phi));
            const sig_c = (2 * c * Math.cos(phi)) / (1 - Math.sin(phi));
            s1 = s3 * k + sig_c;
          } else {
            const sci = params.sci || 30;
            const gsi = params.gsi || 50;
            const mi = params.mi || 10;
            const d = params.d_factor || 0;
            const mb = mi * Math.exp((gsi - 100) / (28 - 14 * d));
            const s = Math.exp((gsi - 100) / (9 - 3 * d));
            const a = 0.5 + (1/6) * (Math.exp(-gsi/15) - Math.exp(-20/3));
            const term = mb * (s3 / sci) + s;
            if (term >= 0) s1 = s3 + sci * Math.pow(term, a);
          }

          if (s1 !== 0) {
            const px = plotType === 's1-s3' ? s3 : (s1 + s3) / 2;
            const py = plotType === 's1-s3' ? s1 : (s1 - s3) / 2;
            
            contentG.append("circle")
              .attr("cx", currentXScale(px))
              .attr("cy", currentYScale(py))
              .attr("r", 5)
              .attr("fill", color)
              .attr("stroke", "white")
              .attr("stroke-width", 2);

            if (plotType === 's1-s3' && idx === 0) {
              contentG.append("line")
                .attr("x1", currentXScale(s3))
                .attr("y1", currentYScale(-20))
                .attr("x2", currentXScale(s3))
                .attr("y2", currentYScale(120))
                .attr("stroke", "#94a3b8")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "4,4");
            }
          }
        }
      });

      // Stress State Point
      if (stressState && plotType === 's1-s2') {
        contentG.append("circle")
          .attr("cx", currentXScale(stressState.s1))
          .attr("cy", currentYScale(stressState.s2))
          .attr("r", 6)
          .attr("fill", "#ef4444")
          .attr("stroke", "white")
          .attr("stroke-width", 2);
      }

      // Labels
      if (plotType === 's1-s2') {
        labelsG.append("text").attr("x", width - 20).attr("y", currentYScale(0) - 5).attr("text-anchor", "end").style("font-size", "12px").text("σ1");
        labelsG.append("text").attr("x", currentXScale(0) + 5).attr("y", 20).style("font-size", "12px").text("σ2");
      } else if (plotType === 's1-s3') {
        labelsG.append("text").attr("x", width - 20).attr("y", currentYScale(0) - 5).attr("text-anchor", "end").style("font-size", "12px").text("σ3");
        labelsG.append("text").attr("x", currentXScale(0) + 5).attr("y", 20).style("font-size", "12px").text("σ1");
      } else {
        labelsG.append("text").attr("x", width - 20).attr("y", currentYScale(0) - 5).attr("text-anchor", "end").style("font-size", "12px").text("p");
        labelsG.append("text").attr("x", currentXScale(0) + 5).attr("y", 20).style("font-size", "12px").text("q");
      }
    };

    // Initial draw
    draw(xScale, yScale);

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 20])
      .on("zoom", (event) => {
        const newXScale = event.transform.rescaleX(xScale);
        const newYScale = event.transform.rescaleY(yScale);
        draw(newXScale, newYScale);
      });

    svg.call(zoom as any);

  }, [configs, is3D, plotType, width, height, stressState]);

  // 3D Plot Logic (Three.js)
  useEffect(() => {
    if (!is3D || !canvasRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(100, 100, 100);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    canvasRef.current.appendChild(renderer.domElement);
    
    const controls = new OrbitControls(camera, renderer.domElement);
    
    const axesHelper = new THREE.AxesHelper(120);
    scene.add(axesHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    configs.forEach((config, idx) => {
      const { id: modelId, params, color = "#4f46e5" } = config;
      const material = new THREE.MeshPhongMaterial({ 
        color: new THREE.Color(color), 
        transparent: true, 
        opacity: 0.5, 
        side: THREE.DoubleSide 
      });

      let geometry: THREE.BufferGeometry | null = null;

      if (modelId === 'von-mises') {
        const sy = params.yield_stress || 50;
        const radius = sy * Math.sqrt(2/3);
        geometry = new THREE.CylinderGeometry(radius, radius, 300, 32, 1, true);
        const mesh = new THREE.Mesh(geometry, material);
        const axis = new THREE.Vector3(1, 1, 1).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
        mesh.applyQuaternion(quaternion);
        scene.add(mesh);
      } else if (modelId === 'mohr-coulomb') {
        const phi = (params.friction_angle || 30) * Math.PI / 180;
        const c = params.cohesion || 20;
        const h = 300;
        const k_mc = (1 + Math.sin(phi)) / (1 - Math.sin(phi));
        const sy_mc = 2 * c * Math.sqrt(k_mc);
        const radius = h * Math.tan(phi) + sy_mc;
        geometry = new THREE.ConeGeometry(radius, h, 6, 1, true);
        const mesh = new THREE.Mesh(geometry, material);
        const axis = new THREE.Vector3(1, 1, 1).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
        mesh.applyQuaternion(quaternion);
        const vertexOffset = axis.clone().multiplyScalar(-h/2 + sy_mc/Math.tan(phi));
        mesh.position.add(vertexOffset);
        scene.add(mesh);
      } else if (modelId === 'drucker-prager') {
        const phi = (params.friction_angle || 30) * Math.PI / 180;
        const c = params.cohesion || 20;
        const alpha = (2 * Math.sin(phi)) / (Math.sqrt(3) * (3 - Math.sin(phi)));
        const k = (6 * c * Math.cos(phi)) / (Math.sqrt(3) * (3 - Math.sin(phi)));
        const h = 300;
        const radius = h * alpha + k;
        geometry = new THREE.ConeGeometry(radius, h, 32, 1, true);
        const mesh = new THREE.Mesh(geometry, material);
        const axis = new THREE.Vector3(1, 1, 1).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
        mesh.applyQuaternion(quaternion);
        const vertexOffset = axis.clone().multiplyScalar(-h/2 + k/alpha);
        mesh.position.add(vertexOffset);
        scene.add(mesh);
      }
    });

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      if (canvasRef.current) canvasRef.current.innerHTML = '';
    };
  }, [is3D, configs, width, height]);

  return (
    <div className="flex items-center justify-center p-4 min-h-[400px]">
      {is3D ? (
        <div ref={canvasRef} style={{ width, height }} />
      ) : (
        <svg ref={svgRef} width={width} height={height} className="max-w-full h-auto drop-shadow-sm" />
      )}
    </div>
  );
};

interface YieldSurfacePlotProps {
  modelId: string;
  parameters: any;
  compare_with?: {
    model_id: string;
    parameters?: any;
  };
}

export const YieldSurfacePlot: React.FC<YieldSurfacePlotProps> = ({ modelId, parameters: initialParameters, compare_with }) => {
  const [is3D, setIs3D] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isComparing, setIsComparing] = useState(!!compare_with);
  const [isOverlay, setIsOverlay] = useState(false);
  const [plotType, setPlotType] = useState<PlotType>('s1-s2');

  // Model 1 State
  const [model1Id, setModel1Id] = useState(modelId);
  const [params1, setParams1] = useState<PlotParams>({
    ...initialParameters,
    sci: initialParameters.sci || 30,
    gsi: initialParameters.gsi || 50,
    mi: initialParameters.mi || 10,
    d_factor: initialParameters.d_factor || 0,
    sigma3_confining: initialParameters.sigma3_confining || 20
  });

  // Model 2 State
  const [model2Id, setModel2Id] = useState(compare_with?.model_id || 'tresca');
  const [params2, setParams2] = useState<PlotParams>(compare_with?.parameters || { 
    yield_stress: 50, 
    friction_angle: 30, 
    cohesion: 20,
    sci: 30,
    gsi: 50,
    mi: 10,
    d_factor: 0,
    sigma3_confining: 20
  });

  // Stress State
  const [stressState, setStressState] = useState({
    sigma_x: initialParameters.sigma_x || 0,
    sigma_y: initialParameters.sigma_y || 0,
    tau_xy: initialParameters.tau_xy || 0
  });

  const calculatePrincipalStresses = (sx: number, sy: number, txy: number) => {
    const center = (sx + sy) / 2;
    const radius = Math.sqrt(Math.pow((sx - sy) / 2, 2) + Math.pow(txy, 2));
    return { s1: center + radius, s2: center - radius };
  };

  const principalStresses = calculatePrincipalStresses(stressState.sigma_x, stressState.sigma_y, stressState.tau_xy);

  const calculateShearStrength = (modelId: string, params: PlotParams) => {
    const s3 = params.sigma3_confining || 0;
    if (modelId === 'mohr-coulomb') {
      const phi = (params.friction_angle || 30) * Math.PI / 180;
      const c = params.cohesion || 20;
      const k = (1 + Math.sin(phi)) / (1 - Math.sin(phi));
      const sig_c = (2 * c * Math.cos(phi)) / (1 - Math.sin(phi));
      const s1 = s3 * k + sig_c;
      const tau = (s1 - s3) / 2 * Math.cos(phi);
      return { s1, tau };
    } else if (modelId === 'hoek-brown') {
      const sci = params.sci || 30;
      const gsi = params.gsi || 50;
      const mi = params.mi || 10;
      const d = params.d_factor || 0;
      const mb = mi * Math.exp((gsi - 100) / (28 - 14 * d));
      const s = Math.exp((gsi - 100) / (9 - 3 * d));
      const a = 0.5 + (1/6) * (Math.exp(-gsi/15) - Math.exp(-20/3));
      const term = mb * (s3 / sci) + s;
      if (term >= 0) {
        const s1 = s3 + sci * Math.pow(term, a);
        // q = (s1 - s3) / 2
        const q = (s1 - s3) / 2;
        return { s1, tau: q }; // Using q as a proxy for shear strength in HB
      }
    }
    return null;
  };

  const strength1 = calculateShearStrength(model1Id, params1);
  const strength2 = calculateShearStrength(model2Id, params2);

  useEffect(() => {
    setModel1Id(modelId);
    setParams1(initialParameters);
    if (initialParameters.sigma_x !== undefined) {
      setStressState({
        sigma_x: initialParameters.sigma_x,
        sigma_y: initialParameters.sigma_y || 0,
        tau_xy: initialParameters.tau_xy || 0
      });
    }
    if (compare_with) {
      setIsComparing(true);
      setModel2Id(compare_with.model_id);
      setParams2(compare_with.parameters || { yield_stress: 50, friction_angle: 30, cohesion: 20 });
    } else {
      setIsComparing(false);
    }
  }, [modelId, initialParameters, compare_with]);

  const renderControls = (modelIdx: 1 | 2, currentModelId: string, currentParams: PlotParams, setParams: React.Dispatch<React.SetStateAction<PlotParams>>, setModelId?: React.Dispatch<React.SetStateAction<string>>) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Model {modelIdx}</h4>
        {setModelId && (
          <select 
            value={currentModelId} 
            onChange={(e) => setModelId(e.target.value)}
            className="text-[10px] bg-white border border-slate-200 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="von-mises">von Mises</option>
            <option value="tresca">Tresca</option>
            <option value="drucker-prager">Drucker-Prager</option>
            <option value="mohr-coulomb">Mohr-Coulomb</option>
            <option value="hoek-brown">Hoek-Brown</option>
          </select>
        )}
      </div>
      
      {(currentModelId === 'von-mises' || currentModelId === 'tresca') && (
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500">Yield Stress (sy)</label>
          <input 
            type="range" min="10" max="100" value={currentParams.yield_stress || 50} 
            onChange={(e) => setParams({...currentParams, yield_stress: parseInt(e.target.value)})}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="text-[10px] text-right text-slate-400">{currentParams.yield_stress || 50} MPa</div>
        </div>
      )}

      {(currentModelId === 'mohr-coulomb' || currentModelId === 'drucker-prager') && (
        <>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500">Friction Angle (φ)</label>
            <input 
              type="range" min="0" max="60" value={currentParams.friction_angle || 30} 
              onChange={(e) => setParams({...currentParams, friction_angle: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="text-[10px] text-right text-slate-400">{currentParams.friction_angle || 30}°</div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500">Cohesion (c)</label>
            <input 
              type="range" min="0" max="100" value={currentParams.cohesion || 20} 
              onChange={(e) => setParams({...currentParams, cohesion: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="text-[10px] text-right text-slate-400">{currentParams.cohesion || 20} kPa</div>
          </div>
          {currentModelId === 'mohr-coulomb' && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">Tension Cutoff (T0)</label>
                <input 
                  type="range" min="-50" max="0" value={currentParams.tension_cutoff || -10} 
                  onChange={(e) => setParams({...currentParams, tension_cutoff: parseInt(e.target.value)})}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="text-[10px] text-right text-slate-400">{currentParams.tension_cutoff || -10} kPa</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">Pore Pressure (Pf)</label>
                <input 
                  type="range" min="0" max="100" value={currentParams.pore_pressure || 0} 
                  onChange={(e) => setParams({...currentParams, pore_pressure: parseInt(e.target.value)})}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="text-[10px] text-right text-slate-400">{currentParams.pore_pressure || 0} kPa</div>
              </div>
            </>
          )}
        </>
      )}
      {currentModelId === 'hoek-brown' && (
        <>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500">UCS (σci)</label>
            <input 
              type="range" min="1" max="200" value={currentParams.sci || 30} 
              onChange={(e) => setParams({...currentParams, sci: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="text-[10px] text-right text-slate-400">{currentParams.sci || 30} MPa</div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500">GSI</label>
            <input 
              type="range" min="0" max="100" value={currentParams.gsi || 50} 
              onChange={(e) => setParams({...currentParams, gsi: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="text-[10px] text-right text-slate-400">{currentParams.gsi || 50}</div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500">mi Parameter</label>
            <input 
              type="range" min="1" max="50" value={currentParams.mi || 10} 
              onChange={(e) => setParams({...currentParams, mi: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="text-[10px] text-right text-slate-400">{currentParams.mi || 10}</div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500">Disturbance (D)</label>
            <input 
              type="range" min="0" max="1" step="0.1" value={currentParams.d_factor || 0} 
              onChange={(e) => setParams({...currentParams, d_factor: parseFloat(e.target.value)})}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="text-[10px] text-right text-slate-400">{currentParams.d_factor || 0}</div>
          </div>
        </>
      )}
      {(currentModelId === 'mohr-coulomb' || currentModelId === 'hoek-brown') && (
        <div className="pt-2 border-t border-slate-200 mt-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-indigo-600">Confining Stress (σ'3)</label>
            <input 
              type="range" min="0" max="200" value={currentParams.sigma3_confining || 20} 
              onChange={(e) => setParams({...currentParams, sigma3_confining: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="text-[10px] text-right text-slate-400">{currentParams.sigma3_confining || 20} MPa</div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={cn(
      "flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transition-all duration-300",
      isComparing ? "max-w-6xl w-full" : "max-w-4xl w-full"
    )}>
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <LineChart size={16} className="text-indigo-600" />
              {isComparing ? "Model Comparison" : model1Id.replace('-', ' ')}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
              {is3D ? '3D Principal Stress Space' : '2D σ1-σ2 Plane & Mohr\'s Circle'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-lg mr-2">
            <button 
              onClick={() => setPlotType('s1-s2')}
              className={cn("px-2 py-1 rounded text-[10px] font-bold transition-all", plotType === 's1-s2' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              σ1-σ2
            </button>
            <button 
              onClick={() => setPlotType('s1-s3')}
              className={cn("px-2 py-1 rounded text-[10px] font-bold transition-all", plotType === 's1-s3' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              σ1-σ3
            </button>
            <button 
              onClick={() => setPlotType('p-q')}
              className={cn("px-2 py-1 rounded text-[10px] font-bold transition-all", plotType === 'p-q' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              p-q
            </button>
          </div>
          <button 
            onClick={() => {
              setIsComparing(!isComparing);
              if (!isComparing) setIsOverlay(false);
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm border",
              isComparing 
                ? "bg-indigo-600 text-white border-indigo-500" 
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {isComparing ? <X size={14} /> : <Columns size={14} />}
            {isComparing ? 'Close Comparison' : 'Compare Models'}
          </button>
          <button 
            onClick={() => {
              setIsOverlay(!isOverlay);
              if (!isOverlay) setIsComparing(false);
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm border",
              isOverlay 
                ? "bg-emerald-600 text-white border-emerald-500" 
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {isOverlay ? <X size={14} /> : <LineChart size={14} />}
            {isOverlay ? 'Close Overlay' : 'Overlay Models'}
          </button>
          <button 
            onClick={() => setShowControls(!showControls)}
            className={cn("p-2 rounded-lg transition-colors", showControls ? "bg-indigo-100 text-indigo-600" : "hover:bg-slate-200 text-slate-500")}
          >
            <Settings2 size={16} />
          </button>
          <button 
            onClick={() => setIs3D(!is3D)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            {is3D ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {is3D ? '2D View' : '3D View'}
          </button>
        </div>
      </div>

      <div className="relative flex flex-col">
        {showControls && (
          <div className="w-full p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-8">
            {renderControls(1, model1Id, params1, setParams1, setModel1Id)}
            {(isComparing || isOverlay) && renderControls(2, model2Id, params2, setParams2, setModel2Id)}
            
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Stress State</h4>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">σx</label>
                <input 
                  type="range" min="-100" max="100" value={stressState.sigma_x} 
                  onChange={(e) => setStressState({...stressState, sigma_x: parseInt(e.target.value)})}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <div className="text-[10px] text-right text-slate-400">{stressState.sigma_x} MPa</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">σy</label>
                <input 
                  type="range" min="-100" max="100" value={stressState.sigma_y} 
                  onChange={(e) => setStressState({...stressState, sigma_y: parseInt(e.target.value)})}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <div className="text-[10px] text-right text-slate-400">{stressState.sigma_y} MPa</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">τxy</label>
                <input 
                  type="range" min="-100" max="100" value={stressState.tau_xy} 
                  onChange={(e) => setStressState({...stressState, tau_xy: parseInt(e.target.value)})}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <div className="text-[10px] text-right text-slate-400">{stressState.tau_xy} MPa</div>
              </div>
            </div>
          </div>
        )}

        <div className={cn(
          "flex flex-col lg:flex-row items-stretch justify-center divide-y lg:divide-y-0 lg:divide-x divide-slate-100",
          isComparing ? "min-h-[400px]" : "min-h-[400px]"
        )}>
          <div className="flex-1 w-full flex flex-col items-center">
            {isComparing && <div className="pt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{model1Id}</div>}
            <SinglePlot 
              configs={
                isOverlay 
                  ? [
                      { id: model1Id, params: params1, color: "#4f46e5", name: model1Id },
                      { id: model2Id, params: params2, color: "#10b981", name: model2Id }
                    ]
                  : [{ id: model1Id, params: params1, color: "#4f46e5", name: model1Id }]
              } 
              is3D={is3D} 
              plotType={plotType} 
              width={isComparing ? 350 : 400} 
              height={isComparing ? 350 : 400} 
              stressState={principalStresses} 
            />
          </div>
          {isComparing && (
            <div className="flex-1 w-full flex flex-col items-center">
              <div className="pt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{model2Id}</div>
              <SinglePlot 
                configs={[{ id: model2Id, params: params2, color: "#10b981", name: model2Id }]} 
                is3D={is3D} 
                plotType={plotType} 
                width={350} 
                height={350} 
                stressState={principalStresses} 
              />
            </div>
          )}
          {!is3D && (
            <div className="w-full lg:w-80 bg-slate-50/30 p-6 flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l border-slate-100">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Mohr's Circle</h4>
              <MohrsCircle sigma_x={stressState.sigma_x} sigma_y={stressState.sigma_y} tau_xy={stressState.tau_xy} />
              <div className="mt-6 grid grid-cols-2 gap-4 w-full">
                <div className="p-2 bg-white rounded-lg border border-slate-100 text-center">
                  <div className="text-[8px] text-slate-400 uppercase font-bold">σ1</div>
                  <div className="text-xs font-bold text-indigo-600">{principalStresses.s1.toFixed(1)}</div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-100 text-center">
                  <div className="text-[8px] text-slate-400 uppercase font-bold">σ2</div>
                  <div className="text-xs font-bold text-indigo-600">{principalStresses.s2.toFixed(1)}</div>
                </div>
              </div>
              
              {(strength1 || strength2) && (
                <div className="mt-6 w-full space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Shear Strength Analysis</h4>
                  {strength1 && (
                    <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div className="text-[8px] text-indigo-400 uppercase font-bold mb-1">Model 1 ({model1Id})</div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Failure σ1:</span>
                        <span className="text-xs font-bold text-slate-700">{strength1.s1.toFixed(1)} MPa</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Shear Strength τ:</span>
                        <span className="text-xs font-bold text-indigo-600">{strength1.tau.toFixed(1)} MPa</span>
                      </div>
                    </div>
                  )}
                  {(isComparing || isOverlay) && strength2 && (
                    <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                      <div className="text-[8px] text-emerald-400 uppercase font-bold mb-1">Model 2 ({model2Id})</div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Failure σ1:</span>
                        <span className="text-xs font-bold text-slate-700">{strength2.s1.toFixed(1)} MPa</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Shear Strength τ:</span>
                        <span className="text-xs font-bold text-emerald-600">{strength2.tau.toFixed(1)} MPa</span>
                      </div>
                    </div>
                  )}
                  <p className="text-[9px] text-slate-400 italic">Calculated at σ'3 = {params1.sigma3_confining} MPa</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-3 bg-slate-900 text-[9px] font-mono text-slate-400 flex justify-between items-center">
        <div className="flex gap-4">
          <span>M1: {model1Id.toUpperCase()}</span>
          {(isComparing || isOverlay) && <span>M2: {model2Id.toUpperCase()}</span>}
        </div>
        <span>RENDER: {is3D ? 'THREE.JS' : 'D3.SVG'} | INTERACTIVE: {is3D ? 'ORBIT' : 'ZOOM/PAN'}</span>
      </div>
    </div>
  );
};
