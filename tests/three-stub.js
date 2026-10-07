// A stand-in for three.js in node (no WebGL and no package): every name is a class, every value
// is an object, and every call gives an object back. A test of the drawing code (src/render/) runs
// with it and finds an error of the code itself, for example a name that is not defined. It does
// not test what the drawing shows.
const stub = new Proxy(function stub() {}, {
  get: (t, key) => (key === Symbol.toPrimitive ? () => 0 : key === 'then' ? undefined : stub),
  set: () => true,
  apply: () => stub,
  construct: () => stub,
});
export default stub;
