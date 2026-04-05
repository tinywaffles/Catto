declare module '@mapbox/point-geometry';
declare module 'mapbox__point-geometry';

interface Window {
  __CATTO_DESKTOP__?: import('@/lib/desktopBridge').CattoDesktopRuntime;
  __CATTO_LOCAL_CONTROL__?: import('@/lib/localControlTransport').CattoLocalControlBridge;
}
