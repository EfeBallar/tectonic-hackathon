// Maps the automatic JSX runtime onto the React UMD global.
const R = window.React;
const withKey = (props, key) => (key === undefined ? props : Object.assign({}, props, { key }));
export const Fragment = R.Fragment;
export function jsx(type, props, key) {
  return R.createElement(type, withKey(props, key));
}
export const jsxs = jsx;
