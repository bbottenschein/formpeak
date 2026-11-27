"use client";

import dynamic from "next/dynamic";

/** Chat nur im Browser rendern (Verlauf liegt im sessionStorage). */
export const CoachChatClient = dynamic(() => import("./coach-chat").then((m) => m.CoachChat), { ssr: false });
