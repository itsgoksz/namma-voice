export const getFastLocation = async (): Promise<{ lat: number, lng: number }> => {
  return new Promise((resolve) => {
    // 1. Try cache first for instant resolution if we've successfully got it before
    const cachedLat = localStorage.getItem('namma_lat');
    const cachedLng = localStorage.getItem('namma_lng');
    if (cachedLat && cachedLng) {
      resolve({ lat: parseFloat(cachedLat), lng: parseFloat(cachedLng) });
      return;
    }

    // Default JP Nagar
    const fallback = { lat: 12.9063, lng: 77.5857 };

    if (typeof window === 'undefined') {
      resolve(fallback);
      return;
    }

    let isResolved = false;
    
    // 2. Hard JS Timeout fallback (1.5 seconds maximum wait!)
    // This absolutely guarantees Chrome cannot freeze or hang the app waiting for CoreLocation
    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        console.warn("GPS Timeout! Using Fallback.");
        resolve(fallback);
      }
    }, 1500);

    // 3. Try native GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timer);
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            localStorage.setItem('namma_lat', lat.toString());
            localStorage.setItem('namma_lng', lng.toString());
            resolve({ lat, lng });
          }
        },
        () => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timer);
            resolve(fallback);
          }
        },
        { enableHighAccuracy: false, timeout: 1500, maximumAge: 600000 } // Super short timeout
      );
    } else {
      isResolved = true;
      clearTimeout(timer);
      resolve(fallback);
    }
  });
};
