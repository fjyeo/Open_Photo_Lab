import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import Chart from "chart.js/auto";

interface HistogramData {
  red: number[];
  green: number[];
  blue: number[];
  lum: number[];
}

interface HistogramProps {
  imagePath: string;
}

const Histogram = ({ imagePath }: HistogramProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!imagePath || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Destroy any existing chart instance
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    invoke<HistogramData>("compute_histogram", { path: imagePath })
      .then((data) => {
        chartRef.current = new Chart(ctx, {
          type: "line",
          data: {
            labels: Array.from({ length: 256 }, (_, i) => i.toString()),
            datasets: [
              {
                label: "Lum",
                data: data.lum,
                backgroundColor: "rgba(200, 200, 200, 0.2)",
                borderColor: "rgba(200, 200, 200, 1)",
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 1.5,
              },
              {
                label: "Red",
                data: data.red,
                backgroundColor: "rgba(255, 0, 0, 0.2)",
                borderColor: "rgba(255, 0, 0, 1)",
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 1.5,
              },
              {
                label: "Green",
                data: data.green,
                backgroundColor: "rgba(0, 255, 0, 0.2)",
                borderColor: "rgba(0, 255, 0, 1)",
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 1.5,
              },
              {
                label: "Blue",
                data: data.blue,
                backgroundColor: "rgba(0, 128, 255, 0.2)",
                borderColor: "rgba(0, 128, 255, 1)",
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 1.5,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { display: false },
              y: { display: false },
            },
            plugins: {
              legend: { display: false },
            },
          },
        });
      })
      .catch((err) => console.error("Error computing histogram:", err));

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [imagePath]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default Histogram;
