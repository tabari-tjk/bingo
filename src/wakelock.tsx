import React, { useEffect, useState } from "react";

export default function WakeLock() {
    const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
    useEffect(() => {
        if ("wakeLock" in window.navigator && wakeLock !== null) {
            document.addEventListener("visibilitychange", () => {
                if (wakeLock !== null && document.visibilityState === "visible") {
                    window.navigator.wakeLock.request("screen").then(setWakeLock);
                }
            });
            window.navigator.wakeLock.request("screen").then(setWakeLock);
        }
        return () => {
            wakeLock?.release().then(() => {
                setWakeLock(null);
            });
        };
    }, [wakeLock]);
    return <></>;
}