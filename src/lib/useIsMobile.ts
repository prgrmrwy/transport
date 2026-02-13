const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;

const VR_UA = /OculusBrowser|Quest|Pico|HorizonOS/i;

/** UA-based device detection — evaluated once at module load, no re-renders */
export const isVR = VR_UA.test(navigator.userAgent);

// VR 头显用 PC 布局（大屏 + 鼠标/手柄指针），手机/平板用 Mobile 布局
export const isMobile = MOBILE_UA.test(navigator.userAgent) && !isVR;
