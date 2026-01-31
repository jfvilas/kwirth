import { useEffect, useState } from "react";

export function useEnvironment() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.indexOf(' electron/') > -1) {
      setIsElectron(true);
    }
  }, []);

  return { isElectron, isBrowser: !isElectron };
}