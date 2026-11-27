"use client";

import dynamic from "next/dynamic";

/**
 * Das Training liest seinen gespeicherten Stand aus dem Gerät (localStorage) – deshalb nur im
 * Browser rendern, nicht auf dem Server.
 */
export const TrainingFlowClient = dynamic(() => import("./training-flow").then((m) => m.TrainingFlow), { ssr: false });
