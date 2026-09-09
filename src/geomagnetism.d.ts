declare module 'geomagnetism' {
  const geomagnetism: { model(date?: Date): { point(position: number[]): { decl: number } } };
  export default geomagnetism;
}
