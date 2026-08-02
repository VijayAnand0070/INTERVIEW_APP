import React, { useEffect, useState } from "react";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";
import { supabase } from "../lib/supabase.js";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const LiveEvaluationChart = ({ sessionId }) => {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!sessionId) return;

    let socket;
    
    const initSocket = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";
      socket = io(`${baseURL}/interview`, {
        auth: { token }
      });

      socket.on("connect", () => {
        socket.emit("interview:getMetrics", { sessionId });
      });

      socket.on("interview:metrics", (data) => {
        setMetrics(data);
      });
      
      socket.on("interview:metricsUpdate", (data) => {
        setMetrics(data);
      });
    };

    initSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [sessionId]);

  if (!metrics || Object.keys(metrics.categories || {}).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center border rounded-2xl bg-slate-900/40 border-slate-700/50">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-16 h-16 mb-4 rounded-full bg-slate-800 flex items-center justify-center"
        >
          <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </motion.div>
        <h3 className="text-lg font-medium text-slate-200">Awaiting Evaluation Data</h3>
        <p className="mt-2 text-sm text-slate-400">Metrics will appear here in real-time as you answer.</p>
      </div>
    );
  }

  const labels = Object.keys(metrics.categories);
  const dataValues = Object.values(metrics.categories);

  const data = {
    labels,
    datasets: [
      {
        label: "Live Score",
        data: dataValues,
        backgroundColor: "rgba(99, 102, 241, 0.2)", // Indigo with opacity
        borderColor: "rgba(99, 102, 241, 1)", // Solid Indigo
        borderWidth: 2,
        pointBackgroundColor: "rgba(99, 102, 241, 1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgba(99, 102, 241, 1)",
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1000,
      easing: "easeOutQuart",
    },
    scales: {
      r: {
        angleLines: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        pointLabels: {
          color: "rgba(255, 255, 255, 0.7)",
          font: {
            family: "'Inter', sans-serif",
            size: 11,
            weight: 500,
          },
        },
        ticks: {
          display: false, // hide the scale numbers
          min: 0,
          max: 100,
          stepSize: 20,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.9)", // slate-900
        titleColor: "#fff",
        bodyColor: "rgba(255, 255, 255, 0.8)",
        borderColor: "rgba(51, 65, 85, 0.5)", // slate-700
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context) => `Score: ${context.raw}/100`,
        },
      },
    },
  };

  return (
    <div className="flex flex-col h-full overflow-hidden border rounded-2xl bg-slate-900/60 border-slate-700/50 backdrop-blur-md">
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          Live Evaluation
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Avg Score</span>
          <div className="bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full text-sm font-bold border border-indigo-500/30">
            {metrics.averageScore}
          </div>
        </div>
      </div>
      <div className="flex-1 relative p-4 min-h-[250px]">
        <AnimatePresence mode="wait">
          <motion.div
            key="chart"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full h-full"
          >
            <Radar data={data} options={options} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LiveEvaluationChart;

